from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from typing import Optional
from app.database import supabase
import uuid
import os
import shutil
from datetime import datetime
from app.routers.settings import generate_filename
from app.services.async_upload import process_async_upload

router = APIRouter(prefix="/movements", tags=["Asset Movements"])

@router.get("")
def get_all_movements(branch: Optional[str] = None, limit: Optional[int] = None):
    """Mengambil semua transaksi pengiriman aset yang aktif/riwayat"""
    all_data = []
    page_size = 1000
    start = 0
    
    while True:
        query = supabase.table("asset_movements").select("*, assets(name)").order("created_at", desc=True)
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
async def dispatch_asset(
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
    proof_image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
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
        br = first_asset['branch'] if first_asset else "Branch"
        
        if len(asset_id_list) > 1:
            an += "_and_others"

        # 1. Upload foto ke Google Drive
        from app.services.gdrive import get_drive_service, get_or_create_folder, upload_file_to_drive
        service = get_drive_service()
        folder_id = get_or_create_folder(service, "Logistics & Tracking")
        
        today_str = datetime.now().strftime("%Y-%m-%d")
        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        
        file_name_base = generate_filename("naming_format_dispatch", ac, proof_image.filename, sender_name, an)
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

        # Determine if approval is needed based on role
        is_admin_or_ga = any(r in sender_role.lower() for r in ['master admin', 'admin', 'ga', 'support'])
        initial_status = "In Transit" if is_admin_or_ga else "Pending Approval"
        
        created_movements = []
        updates_for_bg = []

        for aid in asset_id_list:
            # 2. Insert ke tabel asset_movements
            movement_data = {
                "tracking_code": tracking_code,
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
            updates_for_bg.append({"table": "asset_movements", "id": movement_id, "column": "sender_proof_url"})

            # 3. Update status aset di tabel assets (only if not pending approval)
            if initial_status == "In Transit":
                supabase.table("assets").update({"status": "In Transit"}).eq("id", aid).execute()

            # 4. Insert log pertama (Dispatched / Pending Approval)
            log_msg = "Dispatched / Sedang Dikirim" if initial_status == "In Transit" else "Menunggu Persetujuan (Pending Approval)"
            log_desc = f"Dikirim oleh {sender_name} dari {from_location} tujuan {to_location}." if initial_status == "In Transit" else f"Permintaan pengiriman oleh {sender_name} ({sender_role}) sedang menunggu persetujuan."
            
            log_data = {
                "movement_id": movement_id,
                "status_update": log_msg,
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

        return {"message": "Asset berhasil dikirim" if is_admin_or_ga else "Permintaan pengiriman butuh persetujuan", "data": created_movements[0] if created_movements else None}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/receive")
async def receive_asset(
    tracking_code: str = Form(...),
    receiver_name: str = Form(...),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """Mencatat penerimaan aset dan upload bukti ke GDrive"""
    try:
        # Cari movement id dari tracking code
        mov = supabase.table("asset_movements").select("*").eq("tracking_code", tracking_code).execute()
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
                "status": "Received",
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
        res = supabase.table("asset_movements").select("*, assets(name)").eq("status", "Pending Approval").order("created_at", desc=True).execute()
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
        movs = supabase.table("asset_movements").select("*").eq("tracking_code", req.tracking_code).eq("status", "Pending Approval").execute()
        if not movs.data:
            raise HTTPException(status_code=404, detail="Request tidak ditemukan atau sudah diproses")
            
        for mov in movs.data:
            # Update status to In Transit
            supabase.table("asset_movements").update({"status": "In Transit"}).eq("id", mov['id']).execute()
            supabase.table("assets").update({"status": "In Transit"}).eq("id", mov['asset_id']).execute()
            
            # Log
            log_data = {
                "movement_id": mov['id'],
                "status_update": "Dispatched / Sedang Dikirim",
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
        movs = supabase.table("asset_movements").select("*").eq("tracking_code", req.tracking_code).eq("status", "Pending Approval").execute()
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
async def public_update_asset(payload: PublicUpdatePayload):
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
        await FastAPICache.clear()

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
async def mutate_asset(req: MutateRequest):
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
            "tracking_code": tracking_code,
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
            "status_update": "Mutasi Permanen",
            "description": f"Mutasi permanen dari {req.from_branch} ({req.from_room}) ke {req.to_branch} ({req.to_room}). Oleh: {req.mutated_by}. Alasan: {req.reason}",
            "updated_by": req.mutated_by
        }
        supabase.table("movement_logs").insert(log_data).execute()
        
        return {"message": "Mutasi berhasil"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/borrow")
async def borrow_asset(
    tracking_code: str = Form(...),
    asset_id: str = Form(...),
    purpose: str = Form(...),
    from_location: str = Form(...),
    to_location: str = Form(...),
    borrower_name: str = Form(...),
    expected_return_date: str = Form(...),
    proof_image: UploadFile = File(...)
):
    """Pengajuan Peminjaman Aset antar cabang"""
    try:
        # Check asset status
        asset_res = supabase.table("assets").select("status").eq("id", asset_id).execute()
        if not asset_res.data:
            raise HTTPException(status_code=404, detail="Asset not found")
        if asset_res.data[0]['status'] in ["Borrowed", "In Transit", "Maintenance", "Pending Approval"]:
            raise HTTPException(status_code=400, detail="Asset is not available for borrowing")

        # 1. Upload foto ke Google Drive
        from app.services.gdrive import get_drive_service, get_or_create_folder, upload_file_to_drive
        service = get_drive_service()
        folder_id = get_or_create_folder(service, "Logistics & Tracking")
        
        # Fetch asset info for naming
        asset_info_res = supabase.table("assets").select("id, name, branch").eq("id", asset_id).execute()
        first_asset = asset_info_res.data[0] if asset_info_res.data else None

        ac = first_asset['id'] if first_asset else "UNKNOWN"
        an = first_asset['name'] if first_asset else "Asset"
        br = first_asset['branch'] if first_asset else "Branch"
        
        today_str = datetime.now().strftime("%Y-%m-%d")
        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        
        file_name_base = generate_filename("naming_format_borrow", ac, proof_image.filename, borrower_name, an)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        filename = filename.replace("/", "_").replace("\\", "_")

        proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type, folder_id)
        if not proof_url:
            raise HTTPException(status_code=500, detail="Gagal mengupload foto")

        # 2. Insert ke tabel asset_movements
        movement_data = {
            "tracking_code": tracking_code,
            "asset_id": asset_id,
            "movement_type": "Borrowing",
            "purpose": purpose,
            "from_location": from_location,
            "to_location": to_location,
            "sender_name": borrower_name,
            "sender_proof_url": proof_url,
            "expected_return_date": expected_return_date,
            "status": "Pending Borrow Approval"
        }
        mov_res = supabase.table("asset_movements").insert(movement_data).execute()
        movement_id = mov_res.data[0]['id']

        # Update Asset Status (lock it)
        supabase.table("assets").update({"status": "Pending Borrow Approval"}).eq("id", asset_id).execute()

        # 3. Log
        log_data = {
            "movement_id": movement_id,
            "status_update": "Menunggu Persetujuan Peminjaman",
            "description": f"Request pinjam dari {to_location} oleh {borrower_name}. Alasan: {purpose}",
            "updated_by": borrower_name,
            "proof_url": proof_url
        }
        supabase.table("movement_logs").insert(log_data).execute()

        return {"message": "Permintaan peminjaman berhasil dikirim"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/approve_borrow")
def approve_borrow(req: ApprovalRequest):
    """Menyetujui peminjaman aset (mengubah status menjadi In Transit)"""
    try:
        movs = supabase.table("asset_movements").select("*").eq("tracking_code", req.tracking_code).eq("status", "Pending Borrow Approval").execute()
        if not movs.data:
            raise HTTPException(status_code=404, detail="Request tidak ditemukan atau sudah diproses")
            
        for mov in movs.data:
            supabase.table("asset_movements").update({"status": "In Transit"}).eq("id", mov['id']).execute()
            supabase.table("assets").update({"status": "In Transit"}).eq("id", mov['asset_id']).execute()
            
            log_data = {
                "movement_id": mov['id'],
                "status_update": "Disetujui - Sedang Dikirim",
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
        movs = supabase.table("asset_movements").select("*").eq("tracking_code", req.tracking_code).eq("status", "Pending Borrow Approval").execute()
        if not movs.data:
            raise HTTPException(status_code=404, detail="Request tidak ditemukan atau sudah diproses")
            
        for mov in movs.data:
            supabase.table("asset_movements").update({"status": "Rejected"}).eq("id", mov['id']).execute()
            supabase.table("assets").update({"status": "Active"}).eq("id", mov['asset_id']).execute()
            
            log_data = {
                "movement_id": mov['id'],
                "status_update": "Ditolak",
                "description": f"Peminjaman ditolak oleh {req.approver_name}. Alasan: {req.reason or 'Tidak ada alasan'}",
                "updated_by": req.approver_name
            }
            supabase.table("movement_logs").insert(log_data).execute()
            
        return {"message": "Peminjaman telah ditolak"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/receive_borrow")
async def receive_borrow_asset(
    tracking_code: str = Form(...),
    receiver_name: str = Form(...),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...)
):
    """Peminjam menerima aset (status -> Borrowed)"""
    try:
        mov = supabase.table("asset_movements").select("*").eq("tracking_code", tracking_code).eq("status", "In Transit").execute()
        if not mov.data:
            raise HTTPException(status_code=404, detail="Tracking Code tidak ditemukan / status bukan In Transit")
        movement = mov.data[0]

        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        file_name_base = generate_filename("naming_format_receive", movement.get('asset_id', ''), proof_image.filename, receiver_name)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type)

        supabase.table("asset_movements").update({
            "status": "Borrowed",
            "receiver_name": receiver_name,
            "receiver_proof_url": proof_url
        }).eq("id", movement['id']).execute()

        supabase.table("assets").update({"status": "Borrowed"}).eq("id", movement['asset_id']).execute()

        log_data = {
            "movement_id": movement['id'],
            "status_update": "Diterima (Sedang Dipinjam)",
            "description": f"Aset diterima oleh peminjam {receiver_name}. Catatan: {notes or '-'}",
            "updated_by": receiver_name,
            "proof_url": proof_url
        }
        supabase.table("movement_logs").insert(log_data).execute()

        return {"message": "Asset berhasil diterima (Dipinjam)"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/return_borrow")
async def return_borrow_asset(
    tracking_code: str = Form(...),
    returner_name: str = Form(...),
    return_from: str = Form(...),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...)
):
    """Peminjam mengembalikan aset ke cabang asal (status -> Returning)"""
    try:
        mov = supabase.table("asset_movements").select("*").eq("tracking_code", tracking_code).eq("status", "Borrowed").execute()
        if not mov.data:
            raise HTTPException(status_code=404, detail="Data peminjaman tidak valid")
        movement = mov.data[0]

        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        file_name_base = generate_filename("naming_format_return", movement.get('asset_id', ''), proof_image.filename, returner_name)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type)

        supabase.table("asset_movements").update({
            "status": "Returning"
        }).eq("id", movement['id']).execute()

        supabase.table("assets").update({"status": "In Transit"}).eq("id", movement['asset_id']).execute()

        log_data = {
            "movement_id": movement['id'],
            "status_update": "Dikembalikan (Sedang Dikirim Balik)",
            "description": f"Aset dikembalikan oleh {returner_name} dari {return_from}. Catatan: {notes or '-'}",
            "updated_by": returner_name,
            "proof_url": proof_url
        }
        supabase.table("movement_logs").insert(log_data).execute()

        return {"message": "Proses pengembalian berhasil, aset sedang dalam perjalanan balik"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/complete_return")
async def complete_return_asset(
    tracking_code: str = Form(...),
    receiver_name: str = Form(...),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...)
):
    """Cabang asal menerima kembali aset yang dipinjam (status -> Completed, Active)"""
    try:
        mov = supabase.table("asset_movements").select("*").eq("tracking_code", tracking_code).eq("status", "Returning").execute()
        if not mov.data:
            raise HTTPException(status_code=404, detail="Data pengembalian tidak valid")
        movement = mov.data[0]

        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        file_name_base = generate_filename("naming_format_receive", movement.get('asset_id', ''), proof_image.filename, receiver_name)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type)

        supabase.table("asset_movements").update({
            "status": "Completed",
            "receiver_name": f"{movement.get('receiver_name', '')} & {receiver_name} (Returned)"
        }).eq("id", movement['id']).execute()

        supabase.table("assets").update({"status": "Active"}).eq("id", movement['asset_id']).execute()

        log_data = {
            "movement_id": movement['id'],
            "status_update": "Pengembalian Selesai",
            "description": f"Aset telah diterima kembali di cabang asal oleh {receiver_name}. Catatan: {notes or '-'}",
            "updated_by": receiver_name,
            "proof_url": proof_url
        }
        supabase.table("movement_logs").insert(log_data).execute()

        return {"message": "Aset berhasil diterima kembali dan aktif"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

