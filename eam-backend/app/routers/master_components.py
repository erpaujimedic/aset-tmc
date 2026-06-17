from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.database import supabase
from typing import List, Optional

router = APIRouter(
    prefix="/master-components",
    tags=["master_components"]
)

class MasterComponentCreate(BaseModel):
    name: str
    description: Optional[str] = None

class MasterComponentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class TemplateCreate(BaseModel):
    category_name: str
    master_component_id: str
    default_quantity: int = 1

class TemplateUpdate(BaseModel):
    category_name: Optional[str] = None
    master_component_id: Optional[str] = None
    default_quantity: Optional[int] = None

@router.get("/")
def get_master_components():
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("master_components").select("*").order("name").execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/")
def create_master_component(comp: MasterComponentCreate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("master_components").insert({"name": comp.name, "description": comp.description}).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{id}")
def delete_master_component(id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("master_components").delete().eq("id", id).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{id}")
def update_master_component(id: str, comp: MasterComponentUpdate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        update_data = {}
        if comp.name is not None:
            update_data["name"] = comp.name
        if comp.description is not None:
            update_data["description"] = comp.description
        res = supabase.table("master_components").update(update_data).eq("id", id).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/templates")
def get_all_templates():
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("category_component_templates").select("*, master_components(name)").order("category_name").execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/templates/{category_name}")
def get_templates_by_category(category_name: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("category_component_templates").select("*, master_components(name)").eq("category_name", category_name).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/templates")
def create_template(temp: TemplateCreate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        data = {
            "category_name": temp.category_name,
            "master_component_id": temp.master_component_id,
            "default_quantity": temp.default_quantity
        }
        res = supabase.table("category_component_templates").insert(data).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/templates/{id}")
def delete_template(id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        res = supabase.table("category_component_templates").delete().eq("id", id).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/templates/{id}")
def update_template(id: str, temp: TemplateUpdate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    try:
        update_data = {}
        if temp.category_name is not None:
            update_data["category_name"] = temp.category_name
        if temp.master_component_id is not None:
            update_data["master_component_id"] = temp.master_component_id
        if temp.default_quantity is not None:
            update_data["default_quantity"] = temp.default_quantity
        res = supabase.table("category_component_templates").update(update_data).eq("id", id).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
