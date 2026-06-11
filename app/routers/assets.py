from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from app.database import supabase
from pydantic import BaseModel
from typing import Optional
from fastapi_cache.decorator import cache
import io
import openpyxl
import uuid

router = APIRouter(prefix="/assets", tags=["Assets"])

class AssetCreate(BaseModel):
    id: str
    name: str
    category: str
    branch: str
    department: str
    room: str
    condition: str
    photo_url: str
    brand: Optional[str] = None
    serial_number: Optional[str] = None
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    pr_number: Optional[str] = None
    placement_location: Optional[str] = None
    rack_number: Optional[str] = None
    calibration_doc_url: Optional[str] = None
    assignee: Optional[str] = None
    status: str = "Active"
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: Optional[str] = None
    is_labeled: bool = False

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    branch: Optional[str] = None
    department: Optional[str] = None
    room: Optional[str] = None
    condition: Optional[str] = None
    photo_url: Optional[str] = None
    brand: Optional[str] = None
    serial_number: Optional[str] = None
    user_name: Optional[str] = None
    user_phone: Optional[str] = None
    pr_number: Optional[str] = None
    placement_location: Optional[str] = None
    rack_number: Optional[str] = None
    calibration_doc_url: Optional[str] = None
    assignee: Optional[str] = None
    status: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: Optional[str] = None
    is_labeled: Optional[bool] = None

from fastapi_cache import FastAPICache

@router.get("")
@cache(expire=3600)
async def get_assets(branch: Optional[str] = None, status: Optional[str] = None):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        all_data = []
        page_size = 1000
        start = 0
        
        while True:
            query = supabase.table("assets").select("*")
            if branch and branch not in ("All Branches", "ALL", "ALL Branches"):
                query = query.eq("branch", branch)
            if status and status != "All Status":
                query = query.eq("status", status)
                
            res = query.range(start, start + page_size - 1).execute()
            
            if not res.data:
                break
                
            all_data.extend(res.data)
            
            if len(res.data) < page_size:
                break
                
            start += page_size
            
        return {"data": all_data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("")
async def create_asset(asset: AssetCreate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("assets").insert(asset.dict()).execute()
        await FastAPICache.clear()
        return {"message": "Asset created successfully", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{asset_id}")
async def update_asset(asset_id: str, asset: AssetUpdate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        update_data = {k: v for k, v in asset.dict().items() if v is not None}
        if not update_data:
            return {"message": "No data to update"}
        res = supabase.table("assets").update(update_data).eq("id", asset_id).execute()
        await FastAPICache.clear()
        return {"message": "Asset updated successfully", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{asset_id}")
async def delete_asset(asset_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("assets").delete().eq("id", asset_id).execute()
        await FastAPICache.clear()
        return {"message": "Asset deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/import-template")
def get_import_template():
    wb = openpyxl.Workbook()
    
    # Sheet 1: Import Bulk Data
    ws1 = wb.active
    ws1.title = "Import Bulk Data"
    headers = [
        "Kode Asset (Opsional)", "Nama Asset (Wajib)", "Merk Barang", "Serial Number", "Nama User", "No. HP User",
        "Lokasi", "Department", "Kategori Asset", "No PR", "Lokasi Penempatan",
        "Nomor Rak", "Ruangan", "Kondisi", "Lampiran Foto Asset", "Lampiran Kalibrasi"
    ]
    ws1.append(headers)
    
    # Optional styling for headers
    for cell in ws1[1]:
        cell.font = openpyxl.styles.Font(bold=True)
    
    # Sheet 2: Information
    ws2 = wb.create_sheet(title="Information")
    info_data = [
        ["Informasi Pengisian Bulk Import"],
        [],
        ["KODE ASSET", "Jika dikosongkan, sistem otomatis membuat ID baru. Jika Anda memiliki kode aset sendiri, ketikkan di kolom pertama."],
        [],
        ["KATEGORI ASSET", "Kode", "Deskripsi"],
        ["", "FFF", "Furniture"],
        ["", "ELK", "Elektronik Non Alat Kesehatan"],
        ["", "ALK", "Elektronik Alat Kesehatan"],
        ["", "VH2", "Kendaraan Roda 2"],
        ["", "VH4", "Kendaraan Roda 4"],
        ["", "HRW", "Hardware"],
        ["", "LGL", "Surat Berharga"],
        ["", "PRK", "Perkakas"],
        [],
        ["KONDISI ASSET"],
        ["", "BAGUS & DIGUNAKAN"],
        ["", "BAGUS & TIDAK DIGUNAKAN"],
        ["", "RUSAK & PERLU PERGANTIAN"],
        ["", "RUSAK & PERLU DIMUSNAHKAN"],
        [],
        ["LOKASI PENEMPATAN & NOMOR RAK"],
        ["Khusus untuk Head Office, wajib mengisi Lokasi Penempatan (cth: Lantai 1, Lantai 2, Gudang)."],
        ["Jika Lokasi Penempatan adalah 'Gudang' atau 'Warehouse', wajib mengisi Nomor Rak."]
    ]
    for row in info_data:
        ws2.append(row)
        
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    
    return StreamingResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=Asset_Import_Template.xlsx"}
    )

@router.post("/import")
async def import_assets(file: UploadFile = File(...)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    
    if not file.filename.endswith('.xlsx'):
        raise HTTPException(status_code=400, detail="Only .xlsx files are supported")
        
    try:
        contents = await file.read()
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        ws = wb["Import Bulk Data"]
        
        # Read headers
        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 2:
            raise HTTPException(status_code=400, detail="No data found in sheet")
            
        assets_to_insert = []
        import datetime
        current_year = datetime.datetime.now().year
        
        # Fetch master branches to normalize casing
        branches_res = supabase.table("branches").select("name").execute()
        valid_branches = {b["name"].lower(): b["name"] for b in branches_res.data} if branches_res.data else {}
        
        for idx, row in enumerate(rows[1:], start=2):
            # Skip empty rows
            if not row[1]:
                continue
                
            provided_id_raw = str(row[0]).strip() if row[0] else ""
            if provided_id_raw.lower() in ('none', '#n/a', 'n/a', 'null', '-') or provided_id_raw.startswith('#'):
                provided_id = None
            else:
                provided_id = provided_id_raw if provided_id_raw else None
            name = str(row[1]).strip() if row[1] else ""
            brand = str(row[2]).strip() if len(row) > 2 and row[2] else None
            serial_number = str(row[3]).strip() if len(row) > 3 and row[3] else None
            user_name = str(row[4]).strip() if len(row) > 4 and row[4] else "Unassigned"
            user_phone = str(row[5]).strip() if len(row) > 5 and row[5] else None
            branch_raw = str(row[6]).strip() if len(row) > 6 and row[6] else "Unknown Branch"
            branch = valid_branches.get(branch_raw.lower(), branch_raw)
            department = str(row[7]).strip().upper() if len(row) > 7 and row[7] else "-"
            category_code = str(row[8]).strip() if len(row) > 8 and row[8] else "UNC"
            pr_number = str(row[9]).strip() if len(row) > 9 and row[9] else None
            placement_location = str(row[10]).strip() if len(row) > 10 and row[10] else None
            rack_number = str(row[11]).strip() if len(row) > 11 and row[11] else None
            room = str(row[12]).strip() if len(row) > 12 and row[12] else "-"
            condition = str(row[13]).strip() if len(row) > 13 and row[13] else "BAGUS & DIGUNAKAN"
            photo_url = str(row[14]).strip() if len(row) > 14 and row[14] else ""
            calibration_doc_url = str(row[15]).strip() if len(row) > 15 and row[15] else None
            
            if provided_id:
                asset_id = provided_id
            else:
                asset_id = f"AST-{current_year}-{category_code}-{str(uuid.uuid4()).split('-')[0].upper()}"
            
            asset_data = {
                "id": asset_id,
                "name": name,
                "category": category_code,
                "branch": branch,
                "department": department,
                "room": room,
                "condition": condition,
                "photo_url": photo_url,
                "brand": brand,
                "serial_number": serial_number,
                "assignee": user_name,
                "user_phone": user_phone,
                "pr_number": pr_number,
                "placement_location": placement_location,
                "rack_number": rack_number,
                "calibration_doc_url": calibration_doc_url,
                "is_labeled": False,
                "status": "Active"
            }
            assets_to_insert.append(asset_data)
            
        if assets_to_insert:
            res = supabase.table("assets").insert(assets_to_insert).execute()
            await FastAPICache.clear()
            return {"message": f"Successfully imported {len(assets_to_insert)} assets", "data": res.data}
        else:
            return {"message": "No valid data to import"}
            
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")
