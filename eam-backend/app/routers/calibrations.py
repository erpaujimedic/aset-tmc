from fastapi import APIRouter, HTTPException
from app.database import supabase
from pydantic import BaseModel
from typing import Optional
from datetime import date

router = APIRouter(prefix="/calibrations", tags=["Calibrations"])

class CalibrationCreate(BaseModel):
    asset_id: str
    last_calibration_date: date
    next_calibration_date: date
    calibration_vendor: str
    status: str = "Valid"
    certificate_url: Optional[str] = None
    notes: Optional[str] = None

class CalibrationUpdate(BaseModel):
    last_calibration_date: Optional[date] = None
    next_calibration_date: Optional[date] = None
    calibration_vendor: Optional[str] = None
    status: Optional[str] = None
    certificate_url: Optional[str] = None
    notes: Optional[str] = None

@router.get("")
def get_calibrations(branch: Optional[str] = None):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        query = supabase.table("calibrations").select("*, assets!inner(name, branch, status)")
        if branch and branch not in ("All Branches", "ALL", "ALL Branches"):
            query = query.eq("assets.branch", branch)
            
        res = query.execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("")
def create_calibration(cal: CalibrationCreate, branch: Optional[str] = None):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        # Verify asset belongs to requested branch (if branch provided)
        if branch:
            asset_res = supabase.table("assets").select("branch").eq("id", cal.asset_id).execute()
            if not asset_res.data:
                raise HTTPException(status_code=404, detail="Asset not found")
            asset_branch = asset_res.data[0].get("branch")
            if asset_branch != branch:
                raise HTTPException(status_code=403, detail="Asset does not belong to your branch")
        # Serialize dates to ISO strings
        data = cal.dict()
        data["last_calibration_date"] = data["last_calibration_date"].isoformat()
        data["next_calibration_date"] = data["next_calibration_date"].isoformat()
        
        # Remove None values to avoid schema issues where None is passed but column doesn't exist
        data = {k: v for k, v in data.items() if v is not None}
        
        # Insert calibration record
        res = supabase.table("calibrations").insert(data).execute()
        return {"message": "Calibration created successfully", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{cal_id}")
def update_calibration(cal_id: str, cal: CalibrationUpdate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        update_data = {k: v for k, v in cal.dict().items() if v is not None}
        if not update_data:
            return {"message": "No data to update"}
            
        if 'last_calibration_date' in update_data:
            update_data['last_calibration_date'] = update_data['last_calibration_date'].isoformat()
        if 'next_calibration_date' in update_data:
            update_data['next_calibration_date'] = update_data['next_calibration_date'].isoformat()
            
        res = supabase.table("calibrations").update(update_data).eq("id", cal_id).execute()
        return {"message": "Calibration updated successfully", "data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{cal_id}")
def delete_calibration(cal_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("calibrations").delete().eq("id", cal_id).execute()
        return {"message": "Calibration deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
