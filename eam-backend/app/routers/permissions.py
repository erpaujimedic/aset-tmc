from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.database import supabase

router = APIRouter(prefix="/permissions", tags=["Permissions"])

DEFAULT_MODULES = {
    "Dashboard": ["View"],
    "Asset Management": ["View", "Create", "Edit", "Delete", "Import", "Export", "Print BA"],
    "Deliveries & Tracking": ["View", "Create", "Receive"],
    "Calibration Schedules": ["View", "Create", "Edit", "Delete"],
    "Ticketing": ["View", "Create", "Resolve"],
    "User Managements - Roles": ["View", "Create", "Edit", "Delete"],
    "User Managements - Profile Configurations": ["View", "Edit"],
    "User Managements - Users": ["View", "Create", "Edit", "Delete"],
    "Settings - File Naming Config": ["View", "Edit"],
    "Settings - SLA Setting": ["View", "Edit"],
    "Public QR Portal": ["Update Lokasi", "Mutasi Permanen", "Pinjamkan Alat", "Terima Aset", "Lapor Rusak"]
}

class ActionItem(BaseModel):
    name: str
    enabled: bool

class PermissionGroup(BaseModel):
    module: str
    actions: List[ActionItem]

class UpdatePermissionsRequest(BaseModel):
    permissions: List[PermissionGroup]

@router.get("/{role_name}")
def get_permissions(role_name: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
        
    # Grant full permissions automatically to Sandbox Admin without DB lookup
    if role_name == "Sandbox Admin":
        response_data = []
        for module, actions in DEFAULT_MODULES.items():
            module_actions = [{"name": action, "enabled": True} for action in actions]
            response_data.append({
                "module": module,
                "actions": module_actions
            })
        return {"data": response_data}

    res = supabase.table("role_permissions").select("*").eq("role_name", role_name).execute()
    existing_perms = res.data
    
    # Format existing perms into a lookup dictionary
    perm_lookup = {}
    for p in existing_perms:
        if p["module"] not in perm_lookup:
            perm_lookup[p["module"]] = {}
        perm_lookup[p["module"]][p["action"]] = p["enabled"]

    # Build response array based on DEFAULT_MODULES
    response_data = []
    for module, actions in DEFAULT_MODULES.items():
        module_actions = []
        for action in actions:
            enabled = False
            if module in perm_lookup and action in perm_lookup[module]:
                enabled = perm_lookup[module][action]
            
            module_actions.append({"name": action, "enabled": enabled})
            
        response_data.append({
            "module": module,
            "actions": module_actions
        })
        
    return {"data": response_data}

@router.put("/{role_name}")
def update_permissions(role_name: str, req: UpdatePermissionsRequest):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")
    
    # Upsert each permission
    for group in req.permissions:
        for action in group.actions:
            supabase.table("role_permissions").upsert({
                "role_name": role_name,
                "module": group.module,
                "action": action.name,
                "enabled": action.enabled
            }, on_conflict="role_name,module,action").execute()
            
    return {"message": "Permissions updated successfully"}
