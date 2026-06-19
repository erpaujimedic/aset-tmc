import asyncio
from app.database import supabase
from fastapi import BackgroundTasks

def insert_audit_log_sync(user_name: str, user_role: str, branch: str, action_type: str, module: str, description: str):
    """
    Synchronous helper to insert audit log.
    If you use BackgroundTasks, wrap this function inside `background_tasks.add_task(insert_audit_log_sync, ...)`
    """
    try:
        log_data = {
            "user_name": user_name or "System",
            "user_role": user_role or "System",
            "branch": branch or "System",
            "action_type": action_type,
            "module": module,
            "description": description
        }
        if supabase:
            supabase.table("audit_logs").insert(log_data).execute()
    except Exception as e:
        print(f"Error inserting audit log: {e}")

def log_audit(bg_tasks: BackgroundTasks, user_name: str, user_role: str, branch: str, action_type: str, module: str, description: str):
    """
    Convenience wrapper to safely queue audit log into FastAPI BackgroundTasks.
    """
    bg_tasks.add_task(
        insert_audit_log_sync, 
        user_name, user_role, branch, action_type, module, description
    )
