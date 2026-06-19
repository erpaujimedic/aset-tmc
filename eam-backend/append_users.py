
@router.get("/pending")
def get_pending_users():
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    res = supabase.table("users").select("*").eq("is_active", False).execute()
    return {"data": res.data}

@router.post("/{user_id}/approve")
def approve_user(user_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    res = supabase.table("users").update({"is_active": True}).eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User approved successfully"}

@router.post("/{user_id}/reject")
def reject_user(user_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    res = supabase.table("users").delete().eq("id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User rejected successfully"}
