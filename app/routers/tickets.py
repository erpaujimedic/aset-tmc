from fastapi import APIRouter, HTTPException, UploadFile, File
from app.database import supabase
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
import shutil
import uuid
import tempfile
from fastapi.responses import FileResponse
from docxtpl import DocxTemplate

router = APIRouter(prefix="/tickets", tags=["Ticketing"])

class TicketCreate(BaseModel):
    title: str
    description: Optional[str] = None
    branch: str
    asset_id: Optional[str] = None
    ticket_type: str
    priority: str = "Medium"
    status: str = "Open"
    created_by: Optional[str] = None
    department: Optional[str] = None
    vendor_name: Optional[str] = None
    photo_url: Optional[str] = None
    component_id: Optional[str] = None

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    branch: Optional[str] = None
    asset_id: Optional[str] = None
    ticket_type: Optional[str] = None
    priority: Optional[str] = None
    changed_by_name: Optional[str] = None
    changed_by_role: Optional[str] = None
    notes: Optional[str] = None
    action: Optional[str] = None
    component_id: Optional[str] = None

@router.get("/{ticket_id}/download-iso-form")
def download_iso_form(ticket_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("tickets").select("*").eq("id", ticket_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Ticket not found")
        
        ticket = res.data[0]
        t_type = ticket.get("ticket_type", "")
        
        # Map variables for docxtpl
        context = {
            "nomor_tiket": ticket.get("ticket_number", "") or "-",
            "tanggal": ticket.get("created_at", "")[:10] if ticket.get("created_at") else "",
            "pic": ticket.get("created_by", "") or "-",
            "departemen": ticket.get("department", "") or "-",
            "cabang": ticket.get("branch", "") or "-",
            "a": "V" if t_type == "Repair" else "",
            "b": "", 
            "c": "", 
            "d": "", 
            "e": "V" if t_type == "Replacement" else "", 
            "f": "V" if t_type == "Calibration" else "", 
            "g": "",
            "h": "",
            "i": "",
            "j": "",
            "k": "",
            "l": "",
            "nama_barang": ticket.get("title", "") or "-",
            "code": ticket.get("asset_id", "") or "-",
            "merk": "",
            "sn": "",
            "qty": "1",
            "harga": "",
            "kondisi": ticket.get("description", "") or "-",
            "tgl_perbaikan_sebelumnya": "",
            "due_date_kalibrasi": "",
            "krnologis": ticket.get("description", "") or "-",
            "pengiriman": "",
            "diketahui": "",
            "diperiksa": "",
            "disetujui": ""
        }
        
        tpl_path = os.path.join("templates", "form_permintaan.docx")
        if not os.path.exists(tpl_path):
            raise HTTPException(status_code=404, detail="Template file not found on server")
            
        doc = DocxTemplate(tpl_path)
        doc.render(context)
        
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".docx")
        doc.save(tmp.name)
        tmp.close()
        
        return FileResponse(
            tmp.name, 
            filename=f"Form_Permintaan_{ticket.get('ticket_number') or ticket_id[:8]}.docx", 
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("")
def get_tickets(branch: Optional[str] = None):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        query = supabase.table("tickets").select("*, asset_components(id, name, serial_number)").order("created_at", desc=True)
        if branch and branch not in ("All Branches", "ALL", "ALL Branches"):
            query = query.eq("branch", branch)
            
        res = query.execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/upload")
async def upload_photo(file: UploadFile = File(...)):
    try:
        os.makedirs("uploads", exist_ok=True)
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        file_name = f"ticket_photo_{uuid.uuid4().hex}.{file_ext}"
        file_path = os.path.join("uploads", file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Return the public URL path
        return {"url": f"/uploads/{file_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

@router.post("")
def create_ticket(tck: TicketCreate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        data = tck.dict()
        import random
        data['ticket_number'] = f"TCK-{datetime.now().year}-{random.randint(1000,9999)}"
        
        res = supabase.table("tickets").insert(data).execute()
        if res.data:
            ticket_id = res.data[0]['id']
            # Insert history for creation
            history_data = {
                "ticket_id": ticket_id,
                "new_status": data.get("status", "Open"),
                "changed_by_name": data.get("created_by", "System"),
                "changed_by_role": "User",
                "action": "Create Ticket",
                "notes": "Ticket created and waiting for form upload"
            }
            try:
                supabase.table("ticket_history").insert(history_data).execute()
            except Exception as e:
                print("Failed to insert history", e)
                
        return {"message": "Ticket created successfully", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{ticket_id}/upload-signed-form")
async def upload_signed_form(ticket_id: str, file: UploadFile = File(...), user_name: str = "System"):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        os.makedirs(os.path.join("uploads", "forms"), exist_ok=True)
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "pdf"
        file_name = f"signed_form_{ticket_id}_{uuid.uuid4().hex[:6]}.{file_ext}"
        file_path = os.path.join("uploads", "forms", file_name)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        url = f"/uploads/forms/{file_name}"
        
        # Update database
        res = supabase.table("tickets").update({"signed_form_url": url}).eq("id", ticket_id).execute()
        
        # Log to history
        history_data = {
            "ticket_id": ticket_id,
            "new_status": res.data[0].get("status", "Open") if res.data else "Open",
            "changed_by_name": user_name,
            "changed_by_role": "User",
            "action": "Upload Form",
            "notes": "Uploaded signed Form Permintaan"
        }
        try:
            supabase.table("ticket_history").insert(history_data).execute()
        except Exception as e:
            print("Failed to insert history", e)
        
        return {"message": "Form uploaded successfully", "url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{ticket_id}")
def update_ticket(ticket_id: str, tck: TicketUpdate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        data_dict = tck.dict()
        
        # Extract history tracking info
        changed_by_name = data_dict.pop('changed_by_name', None)
        changed_by_role = data_dict.pop('changed_by_role', None)
        notes = data_dict.pop('notes', None)
        action = data_dict.pop('action', None)
        
        update_data = {k: v for k, v in data_dict.items() if v is not None}
        if not update_data:
            return {"message": "No data to update"}
            
        update_data['updated_at'] = datetime.utcnow().isoformat()
        
        # Get old status if status is being updated
        old_status = None
        if 'status' in update_data:
            old_ticket = supabase.table("tickets").select("status").eq("id", ticket_id).execute()
            if old_ticket.data:
                old_status = old_ticket.data[0].get("status")
            
        res = supabase.table("tickets").update(update_data).eq("id", ticket_id).execute()
        
        print(f"DEBUG History logic: status in update_data={'status' in update_data}, old_status={old_status}, new_status={update_data.get('status')}, changed_by={changed_by_name}")
        # Insert history if status changed
        if 'status' in update_data and old_status != update_data['status'] and changed_by_name:
            history_data = {
                "ticket_id": ticket_id,
                "old_status": old_status,
                "new_status": update_data['status'],
                "changed_by_name": changed_by_name,
                "changed_by_role": changed_by_role or "Unknown",
                "notes": notes,
                "action": action or f"Status changed to {update_data['status']}"
            }
            hist_res = supabase.table("ticket_history").insert(history_data).execute()
            print(f"DEBUG hist_res={hist_res.data}")
            
        return {"message": "Ticket updated successfully", "data": res.data}
    except Exception as e:
        print(f"DEBUG ERROR: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{ticket_id}/history")
def get_ticket_history(ticket_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("ticket_history").select("*").eq("ticket_id", ticket_id).order("created_at", desc=False).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{ticket_id}")
def delete_ticket(ticket_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("tickets").delete().eq("id", ticket_id).execute()
        return {"message": "Ticket deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
