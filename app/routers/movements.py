from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional
from app.database import supabase
from app.services.drive_service import upload_file_to_drive
import uuid
from datetime import datetime

router = APIRouter(prefix="/movements", tags=["Asset Movements"])

@router.get("")
def get_all_movements():
    """Mengambil semua transaksi pengiriman aset yang aktif/riwayat"""
    res = supabase.table("asset_movements").select("*, assets(name)").order("created_at", desc=True).execute()
    return {"data": res.data}

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
    proof_image: UploadFile = File(...)
):
    """Mencatat pengiriman aset (Dispatch) secara bulk dan upload bukti ke GDrive"""
    try:
        import json
        asset_id_list = json.loads(asset_ids)

        # 1. Upload foto ke Google Drive
        filename = f"{tracking_code}_SenderProof_{proof_image.filename}"
        proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type)
        if not proof_url:
            raise HTTPException(status_code=500, detail="Gagal mengupload foto ke Google Drive")

        # Determine if approval is needed based on role
        is_admin_or_ga = any(r in sender_role.lower() for r in ['master admin', 'admin', 'ga', 'support'])
        initial_status = "In Transit" if is_admin_or_ga else "Pending Approval"
        
        created_movements = []

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
            supabase.table("movement_logs").insert(log_data).execute()

        return {"message": "Asset berhasil dikirim" if is_admin_or_ga else "Permintaan pengiriman butuh persetujuan", "data": created_movements[0] if created_movements else None}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/receive")
async def receive_asset(
    tracking_code: str = Form(...),
    receiver_name: str = Form(...),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...)
):
    """Mencatat penerimaan aset dan upload bukti ke GDrive"""
    try:
        # Cari movement id dari tracking code
        mov = supabase.table("asset_movements").select("*").eq("tracking_code", tracking_code).execute()
        if not mov.data:
            raise HTTPException(status_code=404, detail="Tracking Code tidak ditemukan")
        
        movements = mov.data

        # 1. Upload foto penerima ke GDrive
        filename = f"{tracking_code}_ReceiverProof_{proof_image.filename}"
        proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type)
        if not proof_url:
            raise HTTPException(status_code=500, detail="Gagal mengupload foto penerima ke Google Drive")

        for movement in movements:
            # 2. Update status asset_movements menjadi Received / Completed
            supabase.table("asset_movements").update({
                "status": "Received",
                "receiver_name": receiver_name,
                "receiver_proof_url": proof_url
            }).eq("id", movement['id']).execute()

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
            supabase.table("movement_logs").insert(log_data).execute()

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
