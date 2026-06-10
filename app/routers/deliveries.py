from fastapi import APIRouter, HTTPException
from app.database import supabase

router = APIRouter(prefix="/deliveries", tags=["Deliveries"])

@router.get("")
def get_deliveries():
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("deliveries").select("*").execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
