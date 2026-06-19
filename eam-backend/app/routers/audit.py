from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional
from app.database import supabase

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])

@router.get("")
def get_audit_logs(
    role: str = Query(...),
    branch: str = Query(...),
    user_name: str = Query(...),
    module: Optional[str] = None,
    action_type: Optional[str] = None,
    limit: int = Query(1000)
):
    """
    Get audit logs based on role-based filtering.
    """
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")

    try:
        query = supabase.table("audit_logs").select("*").order("created_at", desc=True)
        
        # Apply Role-based filtering
        role_lower = role.lower()
        if role_lower in ["master admin", "admin system"]:
            # Admin sees everything, no branch filter
            pass
        elif role_lower == "branch manager":
            # Branch manager sees only their branch
            query = query.eq("branch", branch)
        elif role_lower == "branch staff":
            # Branch staff sees only their branch AND their own user_name
            query = query.eq("branch", branch).eq("user_name", user_name)
        else:
            # Fallback for any other custom role, restrict to their own
            query = query.eq("branch", branch).eq("user_name", user_name)

        # Apply module & action filters if provided
        if module and module != "All":
            query = query.eq("module", module)
        if action_type and action_type != "All":
            query = query.eq("action_type", action_type)

        res = query.limit(limit).execute()
        return {"data": res.data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
