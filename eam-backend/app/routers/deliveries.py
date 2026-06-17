from fastapi import APIRouter, HTTPException
from app.database import supabase

router = APIRouter(prefix="/deliveries", tags=["Deliveries"])

from typing import Optional

@router.get("")
def get_deliveries(limit: Optional[int] = None):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        all_data = []
        page_size = 1000
        start = 0
        
        while True:
            query = supabase.table("deliveries").select("*")
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
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
