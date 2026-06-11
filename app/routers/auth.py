from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import bcrypt
from app.database import supabase

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
        
    # Check by email or username
    response = supabase.table("users").select("*").or_(f"email.eq.{req.email},username.eq.{req.email}").execute()
    users = response.data
    
    if not users:
        raise HTTPException(status_code=401, detail="Email atau Username tidak ditemukan!")
        
    user = users[0]
    
    if not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Password salah!")
        
    # Sementara menggunakan dummy token. Idealnya pakai pyjwt
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "fullName": user["full_name"],
        "role": user["role"],
        "branch": user["branch"],
        "token": f"token-{user['id']}" 
    }

@router.post("/register")
def register(req: RegisterRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
        
    hashed_password = get_password_hash(req.password)
    
    try:
        response = supabase.table("users").insert({
            "full_name": req.fullName,
            "email": req.email,
            "username": req.username,
            "role": req.role,
            "branch": req.branch,
            "password_hash": hashed_password
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
        
    response = supabase.table("users").select("*").eq("id", req.user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
        
    user = response.data[0]
    if not verify_password(req.old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Password lama salah!")
        
    hashed_password = get_password_hash(req.new_password)
    supabase.table("users").update({"password_hash": hashed_password}).eq("id", req.user_id).execute()
    return {"message": "Password berhasil diubah"}
