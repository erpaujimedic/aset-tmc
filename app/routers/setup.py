from fastapi import APIRouter, HTTPException
from app.database import supabase
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/setup", tags=["Setup Management"])

@router.get("/departments")
def get_departments():
    if not supabase:
        return {"data": []}
    try:
        # Fetch data, if table doesn't exist it will error, so we catch it
        res = supabase.table("departments").select("*").execute()
        return {"data": res.data}
    except Exception as e:
        print(f"Error fetching departments (table might not exist): {e}")
        return {"data": []}

@router.get("/vendors")
def get_vendors():
    if not supabase:
        return {"data": []}
    try:
        res = supabase.table("vendors").select("*").execute()
        return {"data": res.data}
    except Exception as e:
        print(f"Error fetching vendors (table might not exist): {e}")
        return {"data": []}
