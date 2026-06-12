from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Union
from app.database import supabase
from app.routers.auth import get_password_hash
import datetime

router = APIRouter(prefix="/users", tags=["Users"])

class UserCreate(BaseModel):
    name: str
    email: str
    username: str
    role: str
    branch: Union[str, List[str]]
    password: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None
    workGroup: Optional[str] = None

class UserUpdate(BaseModel):
    name: str
    email: str
    username: str
    role: str
    branch: Union[str, List[str]]
    phone: Optional[str] = None
    status: Optional[str] = None
    department: Optional[str] = None
    workGroup: Optional[str] = None

class RoleCreate(BaseModel):
    role_name: str

@router.get("/roles")
def get_roles():
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    res = supabase.table("roles").select("name").execute()
    # Frontend expects an array of strings
    roles = [r["name"] for r in res.data]
    
    if "Public Access" not in roles:
        try:
            supabase.table("roles").insert({"name": "Public Access"}).execute()
            roles.append("Public Access")
        except:
            pass

    return {"data": roles}

@router.post("/roles")
def create_role(req: RoleCreate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    supabase.table("roles").insert({"name": req.role_name}).execute()
    # Return updated list
    res = supabase.table("roles").select("name").execute()
    roles = [r["name"] for r in res.data]
    return {"data": roles}

@router.delete("/roles/{role_name}")
def delete_role(role_name: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    supabase.table("roles").delete().eq("name", role_name).execute()
    res = supabase.table("roles").select("name").execute()
    roles = [r["name"] for r in res.data]
    return {"data": roles}

@router.get("")
def get_users(branch: Optional[str] = None):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
        
    query = supabase.table("users").select("*")
    if branch and branch not in ("All Branches", "ALL", "ALL Branches"):
        query = query.eq("branch", branch)
        
    res = query.execute()
    
    # Map to frontend expected format
    formatted_users = []
    for u in res.data:
        formatted_users.append({
            "id": u["id"],
            "name": u["full_name"],
            "email": u["email"],
            "username": u["username"],
            "branch": u["branch"],
            "role": u["role"],
            "status": "Active", # default for now
            "lastLogin": "Never"
        })
    return {"data": formatted_users}

@router.post("")
def create_user(req: UserCreate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    
    password = req.password if req.password else "admin123"
    hashed_password = get_password_hash(password)
    branch_val = req.branch[0] if isinstance(req.branch, list) and len(req.branch) > 0 else req.branch
    
    try:
        res = supabase.table("users").insert({
            "full_name": req.name,
            "email": req.email,
            "username": req.username,
            "role": req.role,
            "branch": branch_val if isinstance(branch_val, str) else str(branch_val),
            "password_hash": hashed_password
        }).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{user_id}")
def update_user(user_id: str, req: UserUpdate):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    branch_val = req.branch[0] if isinstance(req.branch, list) and len(req.branch) > 0 else req.branch
    
    try:
        res = supabase.table("users").update({
            "full_name": req.name,
            "email": req.email,
            "username": req.username,
            "role": req.role,
            "branch": branch_val if isinstance(branch_val, str) else str(branch_val)
        }).eq("id", user_id).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{user_id}")
def delete_user(user_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    supabase.table("users").delete().eq("id", user_id).execute()
    return {"message": "User deleted"}

@router.post("/{user_id}/reset-password")
def reset_user_password(user_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    hashed_password = get_password_hash("admin123")
    supabase.table("users").update({"password_hash": hashed_password}).eq("id", user_id).execute()
    return {"message": "Password reset to admin123"}
