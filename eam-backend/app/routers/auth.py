from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import bcrypt
from app.database import supabase, most_supabase
from app.core.security import create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    fullName: str
    email: str
    username: str
    role: str
    branch: str
    password: str

class ResetPasswordRequest(BaseModel):
    email: str

def verify_password(plain_password, hashed_password):
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

@router.post("/verify-login")
def verify_login(req: LoginRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
        
    if req.email == "dummy@eam.com" or req.email == "dummy_user":
        # Ensure dummy branch exists
        branch_res = most_supabase.table("branches").select("*").eq("name", "DUMMY_SANDBOX").execute()
        if not branch_res.data:
            try:
                most_supabase.table("branches").insert({
                    "name": "DUMMY_SANDBOX",
                    "branch_code": "DUMMY",
                    "region": "SANDBOX",
                    "lat": -6.2,
                    "lng": 106.8,
                    "sort_order": 999
                }).execute()
            except Exception:
                pass
                
        # Ensure dummy user exists
        dummy_res = most_supabase.table("users").select("*").eq("email", "dummy@eam.com").execute()
        if not dummy_res.data:
            try:
                hashed_pw = get_password_hash("dummy123")
                most_supabase.table("users").insert({
                    "full_name": "Sandbox Demo User",
                    "email": "dummy@eam.com",
                    "username": "dummy_user",
                    "role": "Sandbox Admin",
                    "branch": "DUMMY_SANDBOX",
                    "password_hash": hashed_pw
                }).execute()
            except Exception:
                pass

    # Check by email or username
    response = most_supabase.table("users").select("*").or_(f"email.eq.{req.email},username.eq.{req.email}").execute()
    users = response.data
    
    if not users:
        raise HTTPException(status_code=401, detail="Email atau Username tidak ditemukan!")
        
    user = users[0]
    
    db_hash = user.get("password_hash")
    if not db_hash:
        raise HTTPException(status_code=401, detail="Akun belum memiliki password EAM (Silakan masuk via MOST SSO)")
        
    if not verify_password(req.password, db_hash):
        raise HTTPException(status_code=401, detail="Password salah!")
        
    # Update last_login
    try:
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        most_supabase.table("users").update({"last_login": now_iso}).eq("id", user["id"]).execute()
    except Exception:
        pass

    # PENTING: Gunakan eam_role karena kita sekarang terhubung ke database MOST
    user_role = user.get("eam_role") or user.get("role")
    
    access_token = create_access_token(data={"sub": user["id"], "email": user["email"], "role": user_role})

    return {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "fullName": user["full_name"],
        "role": user_role,
        "branch": user.get("branch_code") or user.get("branch"),
        "token": access_token
    }

@router.post("/register")
def register(req: RegisterRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
        
    hashed_password = get_password_hash(req.password)
    
    from app.utils import normalize_branch_name
    normalized_branch = normalize_branch_name(req.branch)
    
    try:
        response = most_supabase.table("users").insert({
            "full_name": req.fullName,
            "email": req.email,
            "username": req.username,
            "eam_role": req.role,
            "role": "Guest EAM",
            "branch_code": normalized_branch,
            "password_hash": hashed_password,
            "status": "Pending"
        }).execute()
        
        return {"message": "Berhasil registrasi", "data": response.data}
    except Exception as e:
        # Menangkap error dari Supabase (misal: duplicate email/username)
        raise HTTPException(status_code=400, detail="Email atau username mungkin sudah digunakan.")

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest):
    return {"message": f"Link reset password dikirim ke {req.email}"}

class ChangePasswordRequest(BaseModel):
    user_id: str
    old_password: str
    new_password: str

@router.post("/change-password")
def change_password(req: ChangePasswordRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
        
    response = most_supabase.table("users").select("*").eq("id", req.user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
        
    user = response.data[0]
    if not verify_password(req.old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password lama salah!")
        
    hashed_password = get_password_hash(req.new_password)
    most_supabase.table("users").update({"password_hash": hashed_password}).eq("id", req.user_id).execute()
    return {"message": "Password berhasil diubah"}

class SSOLoginRequest(BaseModel):
    email: str
    sso_secret: str

@router.post("/sso-login")
def sso_login(req: SSOLoginRequest):
    import os
    if req.sso_secret != os.getenv("SSO_SECRET", "tmc-super-secret-sso-key-2026"):
        raise HTTPException(status_code=403, detail="Invalid SSO Secret")
    
    response = most_supabase.table("users").select("*").eq("email", req.email).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User tidak ditemukan di sistem SSO")
    
    user = response.data[0]
    user_role = user.get("eam_role") or user.get("role")
    access_token = create_access_token(data={"sub": user["id"], "email": user["email"], "role": user_role})
    
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "fullName": user["full_name"],
        "role": user_role,
        "branch": user.get("branch_code") or user.get("branch"),
        "token": access_token
    }
