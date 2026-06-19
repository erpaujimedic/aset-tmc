import asyncio
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from typing import Optional, List
from app.database import supabase
import uuid
import os
import shutil
from datetime import datetime
from app.routers.settings import generate_filename
from app.services.async_upload import process_async_upload
from app.services.gdrive import upload_file_to_drive
from docxtpl import DocxTemplate
from fastapi.responses import StreamingResponse
import io

router = APIRouter(prefix="/movements", tags=["Asset Movements"])

@router.get("")
def get_all_movements(branch: Optional[str] = None, limit: Optional[int] = None):
    """Mengambil semua transaksi pengiriman aset yang aktif/riwayat"""
    all_data = []
    page_size = 1000
    start = 0
    
    while True:
        query = supabase.table("asset_movements").select("*, assets(name, branch), movement_logs(created_at, status_update, description, proof_url)").order("created_at", desc=True)
        if branch and branch not in ("All Branches", "ALL", "ALL Branches"):
            query = query.or_(f"from_location.eq.{branch},to_location.eq.{branch}")
        else:
            query = query.neq("from_location", "DUMMY_SANDBOX").neq("to_location", "DUMMY_SANDBOX")
            
        if limit:
            res = query.range(0, limit - 1).execute()
            all_data.extend(res.data)
            break
            
        res = query.range(start, start + page_size - 1).execute()
        if not res.data:
            break
        all_data.extend(res.data)
        if len(res.data) < page_size:
            break
        start += page_size
        
    return {"data": all_data}

@router.post("/dispatch")
def dispatch_asset(
    tracking_code: str = Form(...),
    asset_ids: str = Form(...),
    purpose: str = Form(...),
    from_location: str = Form(...),
    to_location: str = Form(...),
    sender_name: str = Form(...),
    sender_role: str = Form("Branch User"),
    movement_type: str = Form("Deployment"),
    purpose_detail: Optional[str] = Form(None),
    expected_return_date: Optional[str] = Form(None),
    proof_image: Optional[UploadFile] = File(None),
    background_tasks: BackgroundTasks = BackgroundTasks(), request: Request = None
):
    """Mencatat pengiriman aset (Dispatch) secara bulk dan upload bukti ke GDrive"""
    try:
        import json
        asset_id_list = json.loads(asset_ids)

        # Fetch first asset info for naming
        first_asset = None
        if asset_id_list:
            asset_res = supabase.table("assets").select("id, name, branch").eq("id", asset_id_list[0]).execute()
            if asset_res.data:
                first_asset = asset_res.data[0]

        ac = first_asset['id'] if first_asset else "UNKNOWN"
        an = first_asset['name'] if first_asset else "Asset"
        if len(asset_id_list) > 1:
            an += "_and_others"

        proof_url = ""
        filename = ""
        temp_path = ""
        updates_for_bg = []

        is_admin_or_ga = any(r in sender_role.lower() for r in ['master admin', 'admin', 'ga', 'support'])
        
        if proof_image and getattr(proof_image, 'filename', None):
            initial_status = "In Transit" if is_admin_or_ga else "Pending Approval"
            file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
            file_name_base = generate_filename("naming_format_dispatch", ac, proof_image.filename, sender_name, an)
            filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
            filename = filename.replace("/", "_").replace("\\", "_")

            temp_dir = "uploads/temp"
            os.makedirs(temp_dir, exist_ok=True)
            temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{filename}")
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(proof_image.file, buffer)
            
            proof_url = "UPLOADING..."
        else:
            initial_status = "Requested"

        created_movements = []

        for i, aid in enumerate(asset_id_list):
            # 2. Insert ke tabel asset_movements
            movement_data = {
                "tracking_code": f"{tracking_code}-{i+1}" if len(asset_id_list) > 1 else tracking_code,
                "asset_id": aid,
                "movement_type": movement_type,
                "purpose": purpose,
                "purpose_detail": purpose_detail,
                "from_location": from_location,
                "to_location": to_location,
                "sender_name": sender_name,
                "sender_proof_url": proof_url,
                "expected_return_date": expected_return_date,
                "status": initial_status
            }
            mov_res = supabase.table("asset_movements").insert(movement_data).execute()
            movement_id = mov_res.data[0]['id']
            created_movements.append(mov_res.data[0])

            if proof_url == "UPLOADING...":
                updates_for_bg.append({"table": "asset_movements", "id": movement_id, "column": "sender_proof_url"})

            # 3. Update status aset di tabel assets (only if not pending approval)
            if initial_status == "In Transit":
                supabase.table("assets").update({"status": "In Transit"}).eq("id", aid).execute()

            # 4. Insert log pertama (Dispatched / Pending Approval)
            if initial_status == "Requested":
                log_msg = "Requested"
                log_desc = f"Permintaan pengiriman oleh {sender_name} sedang menunggu upload dokumen yang telah ditandatangani."
            else:
                log_msg = "Dispatched" if initial_status == "In Transit" else "Menunggu Persetujuan (Pending Approval)"
                log_desc = f"Dikirim oleh {sender_name} dari {from_location} tujuan {to_location}." if initial_status == "In Transit" else f"Permintaan pengiriman oleh {sender_name} ({sender_role}) sedang menunggu persetujuan."
            
            log_data = {
                "movement_id": movement_id,
                "status_update": log_msg,
                "description": log_desc,
                "updated_by": sender_name,
                "proof_url": proof_url
            }
            log_res = supabase.table("movement_logs").insert(log_data).execute()
            
            if proof_url == "UPLOADING...":
                updates_for_bg.append({"table": "movement_logs", "id": log_res.data[0]['id'], "column": "proof_url"})

        if proof_url == "UPLOADING...":
            background_tasks.add_task(
                process_async_upload,
                temp_path, filename, proof_image.content_type, "Logistics & Tracking", updates_for_bg
            )

        return {"message": "Asset berhasil dikirim" if is_admin_or_ga and proof_url else "Permintaan pengiriman butuh dokumen/persetujuan", "data": created_movements[0] if created_movements else None}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/upload-proof")
def upload_document_proof(
    tracking_code: str = Form(...),
    sender_name: str = Form(...),
    proof_image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(), request: Request = None
):
    """Upload signed document for a pending movement request"""
    try:
        movs_res = supabase.table("asset_movements").select("*, assets(name, branch)").like("tracking_code", f"{tracking_code}%").eq("status", "Requested").execute()
        if not movs_res.data:
            raise HTTPException(status_code=404, detail="Tiket tidak ditemukan atau sudah diproses")
            
        movements = movs_res.data
        first_mov = movements[0]
        
        ac = first_mov['asset_id']
        an = first_mov['assets']['name'] if first_mov.get('assets') else "Asset"
        if len(movements) > 1:
            an += "_and_others"
            
        is_borrowing = first_mov['movement_type'] == "Borrowing"
        
        # Upload to Google Drive
        from app.services.gdrive import get_drive_service, get_or_create_folder
        service = get_drive_service()
        get_or_create_folder(service, "Logistics & Tracking")
        
        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        file_name_base = generate_filename("naming_format_borrow" if is_borrowing else "naming_format_dispatch", ac, proof_image.filename, sender_name, an)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        filename = filename.replace("/", "_").replace("\\", "_")

        temp_dir = "uploads/temp"
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{filename}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(proof_image.file, buffer)
            
        proof_url = "UPLOADING..."
        updates_for_bg = []
        
        new_status = "Pending Approval" if is_borrowing else "Pending Approval"

        for mov in movements:
            supabase.table("asset_movements").update({
                "sender_proof_url": proof_url,
                "status": new_status
            }).eq("id", mov['id']).execute()
            
            updates_for_bg.append({"table": "asset_movements", "id": mov['id'], "column": "sender_proof_url"})
            
            log_desc = f"Dokumen TTD berhasil diunggah oleh {sender_name}. Menunggu persetujuan."
            log_data = {
                "movement_id": mov['id'],
                "status_update": new_status,
                "description": log_desc,
                "updated_by": sender_name,
                "proof_url": proof_url
            }
            log_res = supabase.table("movement_logs").insert(log_data).execute()
            updates_for_bg.append({"table": "movement_logs", "id": log_res.data[0]['id'], "column": "proof_url"})

        background_tasks.add_task(
            process_async_upload,
            temp_path, filename, proof_image.content_type, "Logistics & Tracking", updates_for_bg
        )

        return {"message": "Dokumen berhasil diunggah. Menunggu persetujuan."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/receive")
def receive_asset(
    tracking_code: str = Form(...),
    receiver_name: str = Form(...),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(), request: Request = None
):
    """Mencatat penerimaan aset dan upload bukti ke GDrive"""
    try:
        # Cari movement id dari tracking code
        mov = supabase.table("asset_movements").select("*").like("tracking_code", f"{tracking_code}%").execute()
        if not mov.data:
            raise HTTPException(status_code=404, detail="Tracking Code tidak ditemukan")
        
        movements = mov.data

        # Fetch first asset info for naming
        first_asset = None
        if movements:
            asset_res = supabase.table("assets").select("id, name, branch").eq("id", movements[0]['asset_id']).execute()
            if asset_res.data:
                first_asset = asset_res.data[0]

        ac = first_asset['id'] if first_asset else "UNKNOWN"
        an = first_asset['name'] if first_asset else "Asset"
        br = first_asset['branch'] if first_asset else "Branch"
        
        if len(movements) > 1:
            an += "_and_others"

        # 1. Upload foto penerima ke GDrive
        from app.services.gdrive import get_drive_service, get_or_create_folder, upload_file_to_drive
        service = get_drive_service()
        folder_id = get_or_create_folder(service, "Logistics & Tracking")
        
        today_str = datetime.now().strftime("%Y-%m-%d")
        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        
        file_name_base = generate_filename("naming_format_receive", ac, proof_image.filename, receiver_name, an)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        filename = filename.replace("/", "_").replace("\\", "_")
        
        # Save temp file
        temp_dir = "uploads/temp"
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{filename}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(proof_image.file, buffer)

        # Set placeholder URL
        proof_url = "UPLOADING..."

        updates_for_bg = []

        for movement in movements:
            # 2. Update status asset_movements menjadi Received / Completed
            supabase.table("asset_movements").update({
                "status": "Completed",
                "receiver_name": receiver_name,
                "receiver_proof_url": proof_url
            }).eq("id", movement['id']).execute()
            updates_for_bg.append({"table": "asset_movements", "id": movement['id'], "column": "receiver_proof_url"})

            # 3. Update status aset menjadi Deployed / Active
            supabase.table("assets").update({
                "status": "Deployed",
                "branch": movement['to_location']
            }).eq("id", movement['asset_id']).execute()

            # 4. Catat ke log
            log_data = {
                "movement_id": movement['id'],
                "status_update": "Diterima / Received",
                "description": f"Diterima oleh {receiver_name}. Catatan: {notes or '-'}",
                "updated_by": receiver_name,
                "proof_url": proof_url
            }
            log_res = supabase.table("movement_logs").insert(log_data).execute()
            updates_for_bg.append({"table": "movement_logs", "id": log_res.data[0]['id'], "column": "proof_url"})

        background_tasks.add_task(
            process_async_upload,
            temp_path, filename, proof_image.content_type, "Logistics & Tracking", updates_for_bg
        )

        return {"message": "Asset berhasil diterima"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/history/{asset_id}")
def get_asset_history(asset_id: str):
    """Mendapatkan riwayat lengkap perjalanan sebuah aset"""
    try:
        # Ambil semua pergerakan untuk aset ini
        movs = supabase.table("asset_movements").select("*, movement_logs(*)").eq("asset_id", asset_id).order("created_at", desc=True).execute()
        return {"data": movs.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/pending-approvals")
def get_pending_approvals():
    """Mendapatkan daftar request pengiriman yang butuh persetujuan"""
    try:
        res = supabase.table("asset_movements").select("*, assets(name), movement_logs(created_at, status_update)").eq("status", "Pending Approval").order("created_at", desc=True).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

from pydantic import BaseModel
class ApprovalRequest(BaseModel):
    tracking_code: str
    approver_name: str
    reason: Optional[str] = None

@router.post("/approve")
def approve_dispatch(req: ApprovalRequest):
    """Menyetujui pengiriman aset"""
    try:
        movs = supabase.table("asset_movements").select("*").like("tracking_code", f"{req.tracking_code}%").eq("status", "Pending Approval").execute()
        if not movs.data:
            raise HTTPException(status_code=404, detail="Request tidak ditemukan atau sudah diproses")
            
        for mov in movs.data:
            # Update status to In Transit
            supabase.table("asset_movements").update({"status": "In Transit"}).eq("id", mov['id']).execute()
            supabase.table("assets").update({"status": "In Transit"}).eq("id", mov['asset_id']).execute()
            
            # Log
            log_data = {
                "movement_id": mov['id'],
                "status_update": "Dispatched",
                "description": f"Disetujui oleh {req.approver_name}. Aset mulai dikirim.",
                "updated_by": req.approver_name
            }
            supabase.table("movement_logs").insert(log_data).execute()
            
        return {"message": "Pengiriman berhasil disetujui"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/reject")
def reject_dispatch(req: ApprovalRequest):
    """Menolak pengiriman aset"""
    try:
        movs = supabase.table("asset_movements").select("*").like("tracking_code", f"{req.tracking_code}%").eq("status", "Pending Approval").execute()
        if not movs.data:
            raise HTTPException(status_code=404, detail="Request tidak ditemukan atau sudah diproses")
            
        for mov in movs.data:
            # Update status to Rejected
            supabase.table("asset_movements").update({"status": "Rejected"}).eq("id", mov['id']).execute()
            # Asset status remains what it was (presumably Deployed or Available)
            
            # Log
            log_data = {
                "movement_id": mov['id'],
                "status_update": "Rejected / Ditolak",
                "description": f"Ditolak oleh {req.approver_name}. Alasan: {req.reason or '-'}",
                "updated_by": req.approver_name
            }
            supabase.table("movement_logs").insert(log_data).execute()
            
        return {"message": "Pengiriman telah ditolak"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class PublicUpdatePayload(BaseModel):
    asset_id: str
    from_branch: str
    to_branch: str
    status: str
    purpose: str
    tracking_code: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    updater_name: Optional[str] = "Anonymous Scanner"

@router.post("/public-update")
def public_update_asset(payload: PublicUpdatePayload):
    from fastapi_cache import FastAPICache
    try:
        # Update assets table
        update_data = {
            "branch": payload.to_branch,
            "status": payload.status
        }
        if payload.lat is not None and payload.lng is not None:
            update_data["lat"] = payload.lat
            update_data["lng"] = payload.lng
            
        supabase.table("assets").update(update_data).eq("id", payload.asset_id).execute()

        # Insert movement record
        mov_data = {
            "tracking_code": payload.tracking_code,
            "asset_id": payload.asset_id,
            "movement_type": "Public Scan Update",
            "purpose": payload.purpose,
            "from_location": payload.from_branch,
            "to_location": payload.to_branch,
            "status": "Completed",
            "sender_name": payload.updater_name
        }
        res_mov = supabase.table("asset_movements").insert(mov_data).execute()
        movement_id = res_mov.data[0]['id']

        # Insert log
        log_data = {
            "movement_id": movement_id,
            "status_update": "Location Updated via QR Scan",
            "description": f"Location updated to {payload.to_branch}. Updater: {payload.updater_name}",
            "updated_by": payload.updater_name
        }
        supabase.table("movement_logs").insert(log_data).execute()

        # Clear cache so updates show up immediately in list & dashboard
        asyncio.run(FastAPICache.clear())

        return {"message": "Success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class MutateRequest(BaseModel):
    asset_id: str
    from_branch: str
    from_room: str
    to_branch: str
    to_room: str
    to_department: str
    reason: str
    mutated_by: str

@router.post("/mutate")
def mutate_asset(req: MutateRequest):
    try:
        tracking_code = f"MUT-{uuid.uuid4().hex[:8].upper()}"
        
        # 1. Update Asset Location
        supabase.table("assets").update({
            "branch": req.to_branch,
            "room": req.to_room,
            "department": req.to_department
        }).eq("id", req.asset_id).execute()

        # 2. Record Movement
        mov_data = {
            "tracking_code": f"{tracking_code}-{i+1}" if len(asset_id_list) > 1 else tracking_code,
            "asset_id": req.asset_id,
            "movement_type": "Mutation",
            "purpose": req.reason,
            "from_location": f"{req.from_branch} - {req.from_room}",
            "to_location": f"{req.to_branch} - {req.to_room}",
            "status": "Completed",
            "sender_name": req.mutated_by
        }
        res_mov = supabase.table("asset_movements").insert(mov_data).execute()
        movement_id = res_mov.data[0]['id']

        # 3. Insert Log
        log_data = {
            "movement_id": movement_id,
            "status_update": "Permanent Mutation",
            "description": f"Mutasi permanen dari {req.from_branch} ({req.from_room}) ke {req.to_branch} ({req.to_room}). Oleh: {req.mutated_by}. Alasan: {req.reason}",
            "updated_by": req.mutated_by
        }
        supabase.table("movement_logs").insert(log_data).execute()
        
        return {"message": "Mutasi berhasil"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/borrow")
def borrow_asset(
    tracking_code: str = Form(...),
    asset_ids: str = Form(...),
    purpose: str = Form(...),
    from_location: str = Form(...),
    to_location: str = Form(...),
    borrower_name: str = Form(...),
    expected_return_date: str = Form(...),
    proof_image: Optional[UploadFile] = File(None),
    background_tasks: BackgroundTasks = BackgroundTasks(), request: Request = None
):
    """Pengajuan Peminjaman Aset antar cabang"""
    try:
        import json
        asset_id_list = json.loads(asset_ids)
        
        if not asset_id_list:
            raise HTTPException(status_code=400, detail="No assets selected")

        # Check asset status
        for i, aid in enumerate(asset_id_list):
            asset_res = supabase.table("assets").select("status").eq("id", aid).execute()
            if not asset_res.data:
                raise HTTPException(status_code=404, detail=f"Asset {aid} not found")
            if asset_res.data[0]['status'] in ["Completed", "In Transit", "Maintenance", "Pending Approval"]:
                raise HTTPException(status_code=400, detail=f"Asset {aid} is not available for borrowing")

        # Fetch asset info for naming
        asset_info_res = supabase.table("assets").select("id, name, branch").eq("id", asset_id_list[0]).execute()
        first_asset = asset_info_res.data[0] if asset_info_res.data else None

        ac = first_asset['id'] if first_asset else "UNKNOWN"
        an = first_asset['name'] if first_asset else "Asset"
        if len(asset_id_list) > 1:
            an += "_and_others"
        
        proof_url = ""
        filename = ""
        temp_path = ""
        updates_for_bg = []
        
        initial_status = "Requested"
        if proof_image and getattr(proof_image, 'filename', None):
            initial_status = "Pending Approval"
            file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
            file_name_base = generate_filename("naming_format_borrow", ac, proof_image.filename, borrower_name, an)
            filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
            filename = filename.replace("/", "_").replace("\\", "_")

            temp_dir = "uploads/temp"
            os.makedirs(temp_dir, exist_ok=True)
            temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{filename}")
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(proof_image.file, buffer)
            
            proof_url = "UPLOADING..."

        # 2. Insert ke tabel asset_movements
        for i, aid in enumerate(asset_id_list):
            movement_data = {
                "tracking_code": f"{tracking_code}-{i+1}" if len(asset_id_list) > 1 else tracking_code,
                "asset_id": aid,
                "movement_type": "Borrowing",
                "purpose": purpose,
                "from_location": from_location,
                "to_location": to_location,
                "sender_name": borrower_name,
                "sender_proof_url": proof_url,
                "expected_return_date": expected_return_date,
                "status": initial_status
            }
            mov_res = supabase.table("asset_movements").insert(movement_data).execute()
            movement_id = mov_res.data[0]['id']

            if proof_url == "UPLOADING...":
                updates_for_bg.append({"table": "asset_movements", "id": movement_id, "column": "sender_proof_url"})

            # Update Asset Status (lock it)
            supabase.table("assets").update({"status": "Pending Approval"}).eq("id", aid).execute()

            # 3. Log
            log_data = {
                "movement_id": movement_id,
                "status_update": initial_status,
                "description": f"Request pinjam dari {to_location} oleh {borrower_name}. Alasan: {purpose}",
                "updated_by": borrower_name,
                "proof_url": proof_url
            }
            log_res = supabase.table("movement_logs").insert(log_data).execute()
            
            if proof_url == "UPLOADING...":
                updates_for_bg.append({"table": "movement_logs", "id": log_res.data[0]['id'], "column": "proof_url"})

        if proof_url == "UPLOADING...":
            background_tasks.add_task(
                process_async_upload,
                temp_path, filename, proof_image.content_type, "Logistics & Tracking", updates_for_bg
            )

        return {"message": "Permintaan peminjaman berhasil dikirim"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/approve_borrow")
def approve_borrow(req: ApprovalRequest):
    """Menyetujui peminjaman aset (mengubah status menjadi In Transit)"""
    try:
        movs = supabase.table("asset_movements").select("*").like("tracking_code", f"{req.tracking_code}%").eq("status", "Pending Approval").execute()
        if not movs.data:
            raise HTTPException(status_code=404, detail="Request tidak ditemukan atau sudah diproses")
            
        for mov in movs.data:
            supabase.table("asset_movements").update({"status": "In Transit"}).eq("id", mov['id']).execute()
            supabase.table("assets").update({"status": "In Transit"}).eq("id", mov['asset_id']).execute()
            
            log_data = {
                "movement_id": mov['id'],
                "status_update": "Approved - Dispatched",
                "description": f"Peminjaman disetujui oleh {req.approver_name}. Aset mulai dikirim ke peminjam. Catatan: {req.reason or '-'}",
                "updated_by": req.approver_name
            }
            supabase.table("movement_logs").insert(log_data).execute()
            
        return {"message": "Peminjaman berhasil disetujui"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/reject_borrow")
def reject_borrow(req: ApprovalRequest):
    """Menolak peminjaman aset"""
    try:
        movs = supabase.table("asset_movements").select("*").like("tracking_code", f"{req.tracking_code}%").eq("status", "Pending Approval").execute()
        if not movs.data:
            raise HTTPException(status_code=404, detail="Request tidak ditemukan atau sudah diproses")
            
        for mov in movs.data:
            supabase.table("asset_movements").update({"status": "Rejected"}).eq("id", mov['id']).execute()
            supabase.table("assets").update({"status": "Active"}).eq("id", mov['asset_id']).execute()
            
            log_data = {
                "movement_id": mov['id'],
                "status_update": "Rejected",
                "description": f"Peminjaman ditolak oleh {req.approver_name}. Alasan: {req.reason or 'Tidak ada alasan'}",
                "updated_by": req.approver_name
            }
            supabase.table("movement_logs").insert(log_data).execute()
            
        return {"message": "Peminjaman telah ditolak"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/cancel_borrow")
def cancel_borrow(req: ApprovalRequest):
    """Membatalkan pengajuan peminjaman oleh peminjam"""
    try:
        movs = supabase.table("asset_movements").select("*").like("tracking_code", f"{req.tracking_code}%").in_("status", ["Pending Approval", "Requested"]).execute()
        if not movs.data:
            raise HTTPException(status_code=404, detail="Request tidak ditemukan atau sudah diproses")
            
        for mov in movs.data:
            supabase.table("asset_movements").update({"status": "Cancelled"}).eq("id", mov['id']).execute()
            supabase.table("assets").update({"status": "Active"}).eq("id", mov['asset_id']).execute()
            
            log_data = {
                "movement_id": mov['id'],
                "status_update": "Cancelled",
                "description": f"Dibatalkan oleh peminjam ({req.approver_name}). Alasan: {req.reason or 'Dibatalkan sendiri'}",
                "updated_by": req.approver_name
            }
            supabase.table("movement_logs").insert(log_data).execute()
            
        return {"message": "Peminjaman telah dibatalkan"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/generate-form/{tracking_code}")
def generate_docx_form(tracking_code: str):
    """Generate Form Permintaan DOCX for a specific tracking code"""
    res = supabase.table("asset_movements").select("*, assets(*)").like("tracking_code", f"{tracking_code}%").execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Movement not found")
        
    movements = res.data
    first_mov = movements[0]
    
    from docxtpl import DocxTemplate, RichText
    
    # Setup context
    context = {
        "nomor_tiket": first_mov.get("tracking_code", "").replace("-", "\u2011"),
        "tanggal": first_mov.get("created_at", "")[:10] if first_mov.get("created_at") else "",
        "pic": first_mov.get("sender_name", "").replace(" ", "\u00A0"),
        "departemen": "",
        "cabang": first_mov.get("from_location", ""),
        
        "a": " ", "b": " ", "c": " ", "d": " ",
        "e": " ", "f": " ", "g": " ", "h": " ",
        "i": " ", "j": " ", "k": " ", "l": " ",
        
        "cabang_asal": first_mov.get("from_location", ""),
        "cabang_asal_peminjaman": "-",
        "cabang_peminjam": "-",
        "cabang_asal_pemindahan": "-",
        "cabang_pemindahan": "-",
        
        "pengiriman": first_mov.get("sender_name", ""),
        "diketahui": "",
        "diperiksa": "",
        "disetujui": "",
        
        "assets": []
    }
    
    m_type = first_mov.get("movement_type", "")
    if m_type == "Borrowing":
        context["b"] = "v"
        context["cabang_asal_peminjaman"] = RichText(first_mov.get("from_location", ""), bold=True)
        context["cabang_peminjam"] = RichText(first_mov.get("to_location", ""), bold=True)
    elif m_type == "Calibration":
        context["f"] = "v"
    else:
        context["d"] = "v"
        context["cabang_asal_pemindahan"] = RichText(first_mov.get("from_location", ""), bold=True)
        context["cabang_pemindahan"] = RichText(first_mov.get("to_location", ""), bold=True)
        
    for mov in movements:
        asset = mov.get("assets", {}) or {}
        purpose = mov.get('purpose') or ''
        detail = mov.get('purpose_detail') or ''
        
        if m_type == "Borrowing":
            kronologis = "-"
        else:
            kronologis = f"{purpose} {detail}".strip()
            if not kronologis:
                kronologis = "-"
                
        context["assets"].append({
            "nama_barang": asset.get("name", "-"),
            "code": asset.get("id", "-"),
            "merk": asset.get("brand", "-"),
            "sn": asset.get("serial_number", "-"),
            "qty": "1",
            "harga": "-",
            "kondisi": asset.get("condition", "-"),
            "tgl_perbaikan_sebelumnya": "-",
            "due_date_kalibrasi": asset.get("calibration_due_date", "-"),
            "kronologis": kronologis
        })
        
    try:
        tpl = DocxTemplate("templates/form_permintaan.docx")
        tpl.render(context)
        out = io.BytesIO()
        tpl.save(out)
        out.seek(0)
        
        return StreamingResponse(
            out,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f"attachment; filename=Form_Permintaan_{tracking_code}.docx",
                "Access-Control-Expose-Headers": "Content-Disposition",
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate template: {str(e)}")


@router.post("/receive_borrow")
def receive_borrow_asset(
    tracking_code: str = Form(...),
    movement_ids: str = Form(None),
    receiver_name: str = Form(...),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...)
):
    """Peminjam menerima aset (status -> Borrowed) secara parsial"""
    import json
    try:
        if movement_ids:
            ids = json.loads(movement_ids)
            mov = supabase.table("asset_movements").select("*").in_("id", ids).eq("status", "In Transit").execute()
        else:
            mov = supabase.table("asset_movements").select("*").like("tracking_code", f"{tracking_code}%").eq("status", "In Transit").execute()
            
        if not mov.data:
            raise HTTPException(status_code=404, detail="Tracking Code tidak ditemukan / status bukan In Transit atau aset tidak dipilih")

        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        file_name_base = generate_filename("naming_format_receive", tracking_code, proof_image.filename, receiver_name)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type)

        for movement in mov.data:
            supabase.table("asset_movements").update({
                "status": "Borrowed",
                "receiver_name": receiver_name,
                "receiver_proof_url": proof_url
            }).eq("id", movement['id']).execute()

            supabase.table("assets").update({"status": "Deployed"}).eq("id", movement['asset_id']).execute()

            log_data = {
                "movement_id": movement['id'],
                "status_update": "Received (Active)",
                "description": f"Aset diterima oleh peminjam {receiver_name}. Catatan: {notes or '-'}",
                "updated_by": receiver_name,
                "proof_url": proof_url
            }
            supabase.table("movement_logs").insert(log_data).execute()

        return {"message": "Asset berhasil diterima (Dipinjam)"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/return_borrow")
def return_borrow_asset(
    tracking_code: str = Form(...),
    movement_ids: str = Form(None),
    returner_name: str = Form(...),
    return_from: str = Form(...),
    return_to: str = Form(None),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(), request: Request = None
):
    """Peminjam mengembalikan aset ke cabang asal/lain secara parsial (status -> Pending Return Approval)"""
    import json
    try:
        # Resolve which movements to update
        if movement_ids:
            ids = json.loads(movement_ids)
            mov = supabase.table("asset_movements").select("*").in_("id", ids).eq("status", "Completed").execute()
        else:
            mov = supabase.table("asset_movements").select("*").like("tracking_code", f"{tracking_code}%").eq("status", "Completed").execute()
            
        if not mov.data:
            raise HTTPException(status_code=404, detail="Data peminjaman tidak valid atau tidak ada aset yang dipilih")

        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        file_name_base = generate_filename("naming_format_return", tracking_code, proof_image.filename, returner_name)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        filename = filename.replace("/", "_").replace("\\", "_")
        
        temp_dir = "uploads/temp"
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{filename}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(proof_image.file, buffer)
            
        proof_url = "UPLOADING..."
        updates_for_bg = []

        for movement in mov.data:
            is_roadshow = return_to and return_to != movement['from_location']
            
            update_data = {
                "status": "Return Pending Approval" if is_roadshow else "Return In Transit"
            }
            if is_roadshow:
                update_data["purpose_detail"] = f"ROADSHOW:{return_to}"

            supabase.table("asset_movements").update(update_data).eq("id", movement['id']).execute()

            # Update asset status
            if not is_roadshow:
                supabase.table("assets").update({"status": "In Transit"}).eq("id", movement['asset_id']).execute()

            log_msg = "Awaiting Transfer Approval" if is_roadshow else "Returned (In Return Transit)"
            log_desc_to = return_to or movement['from_location']
            log_desc = f"Aset dipindah ke {log_desc_to} oleh {returner_name}. Menunggu persetujuan." if is_roadshow else f"Aset dikembalikan oleh {returner_name} dari {return_from} tujuan {log_desc_to}. Catatan: {notes or '-'}"
            
            log_data = {
                "movement_id": movement['id'],
                "status_update": log_msg,
                "description": log_desc,
                "updated_by": returner_name,
                "proof_url": proof_url
            }
            supabase.table("movement_logs").insert(log_data).execute()

        return {"message": "Proses pengembalian parsial/keseluruhan berhasil"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/complete_return")
def complete_return_asset(
    tracking_code: str = Form(...),
    movement_ids: str = Form(None),
    receiver_name: str = Form(...),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...)
):
    """Cabang asal menerima kembali aset yang dipinjam (status -> Completed, Active) secara parsial"""
    import json
    try:
        if movement_ids:
            ids = json.loads(movement_ids)
            mov = supabase.table("asset_movements").select("*").in_("id", ids).eq("status", "Return In Transit").execute()
        else:
            mov = supabase.table("asset_movements").select("*").like("tracking_code", f"{tracking_code}%").eq("status", "Return In Transit").execute()
            
        if not mov.data:
            raise HTTPException(status_code=404, detail="Data pengembalian tidak valid atau tidak ada aset yang dipilih")

        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        file_name_base = generate_filename("naming_format_receive", tracking_code, proof_image.filename, receiver_name)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type)

        for movement in mov.data:
            supabase.table("asset_movements").update({
                "status": "Completed",
                "receiver_name": f"{movement.get('receiver_name', '')} & {receiver_name} (Returned)"
            }).eq("id", movement['id']).execute()

            supabase.table("assets").update({"status": "Active"}).eq("id", movement['asset_id']).execute()

            log_data = {
                "movement_id": movement['id'],
                "status_update": "Return Completed",
                "description": f"Aset telah diterima kembali di cabang asal oleh {receiver_name}. Catatan: {notes or '-'}",
                "updated_by": receiver_name,
                "proof_url": proof_url
            }
            supabase.table("movement_logs").insert(log_data).execute()

        return {"message": "Aset berhasil diterima kembali dan aktif"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

class ItemDecision(BaseModel):
    tracking_code: str
    status: str  # 'Approved' or 'Rejected'
    reason: Optional[str] = None

class ItemizedApprovalRequest(BaseModel):
    group_tracking_code: str
    approver_name: str
    decisions: List[ItemDecision]

@router.post("/process_approval")
def process_approval(
    group_tracking_code: str = Form(...),
    approver_name: str = Form(...),
    sender_name: Optional[str] = Form(None),
    decisions_json: str = Form(...),
    proof_image: Optional[UploadFile] = File(None)
):
    """Memproses persetujuan per item (tentative approval) beserta foto bukti kirim"""
    import json
    try:
        decisions = json.loads(decisions_json)
        movs = supabase.table("asset_movements").select("*").like("tracking_code", f"{group_tracking_code}%").in_("status", ["Pending Approval", "Pending Approval", "Return Pending Approval"]).execute()
        
        if not movs.data:
            raise HTTPException(status_code=404, detail="Tidak ada tiket yang menunggu persetujuan dengan kode tersebut.")

        mov_dict = {m['tracking_code']: m for m in movs.data}
        
        # Upload photo if any
        proof_url = None
        if proof_image and proof_image.filename:
            from app.services.gdrive import upload_file_to_drive
            file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
            file_name_base = generate_filename("naming_format_receive", group_tracking_code, proof_image.filename, sender_name or approver_name)
            filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
            proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type)

        processed_count = 0
        for decision in decisions:
            d_status = decision.get('status')
            d_tc = decision.get('tracking_code')
            d_reason = decision.get('reason')
            
            mov = mov_dict.get(d_tc)
            if not mov:
                continue

            if d_status == 'Approved':
                is_return = mov.get('status') == 'Return Pending Approval'
                
                new_status = "In Transit"
                asset_status = "In Transit"
                actual_sender = sender_name or approver_name
                log_desc = f"Disetujui. Aset telah dikirim oleh {actual_sender}."
                
                update_payload = {"status": new_status, "receiver_proof_url": proof_url if proof_url else None}
                
                if is_return:
                    pd = mov.get("purpose_detail", "")
                    if pd.startswith("ROADSHOW:"):
                        new_to_location = pd.split("ROADSHOW:")[1]
                        update_payload["from_location"] = mov.get("to_location")
                        update_payload["to_location"] = new_to_location
                        update_payload["purpose_detail"] = ""
                        log_desc = f"Pindah Cabang Disetujui. Aset sedang dikirim ke {new_to_location}."
                    else:
                        update_payload["status"] = "Return In Transit"
                        log_desc = f"Pengembalian Disetujui. Aset sedang dikirim balik."
                        
                supabase.table("asset_movements").update(update_payload).eq("id", mov['id']).execute()
            elif d_status == 'Rejected':
                new_status = "Rejected"
                asset_status = "Active"
                log_desc = f"Ditolak oleh {approver_name}. Alasan: {d_reason or '-'}"
                
                # Update movement
                supabase.table("asset_movements").update({"status": new_status}).eq("id", mov['id']).execute()
            else:
                continue

            # Update asset
            supabase.table("assets").update({"status": asset_status}).eq("id", mov['asset_id']).execute()
            
            # Insert log
            log_data = {
                "movement_id": mov['id'],
                "status_update": "Disetujui" if d_status == 'Approved' else "Rejected",
                "description": log_desc,
                "updated_by": approver_name,
                "proof_url": proof_url if d_status == 'Approved' else None
            }
            supabase.table("movement_logs").insert(log_data).execute()
            processed_count += 1
            
        return {"message": f"{processed_count} item berhasil diproses."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{tracking_code}")
def delete_movement(tracking_code: str):
    """Menghapus data pergerakan (Admin Only)"""
    try:
        movs = supabase.table("asset_movements").select("id").like("tracking_code", f"{tracking_code}%").execute()
        if not movs.data:
            raise HTTPException(status_code=404, detail="Movement not found")
            
        mov_ids = [m['id'] for m in movs.data]
        
        # Delete logs first (foreign key might not cascade depending on Supabase setup)
        supabase.table("movement_logs").delete().in_("movement_id", mov_ids).execute()
        
        # Delete movements
        supabase.table("asset_movements").delete().in_("id", mov_ids).execute()
        
        asyncio.run(FastAPICache.clear())
        asyncio.run(FastAPICache.clear(namespace="assets"))
        return {"message": "Data berhasil dihapus"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
