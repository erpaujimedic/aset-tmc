from fastapi import APIRouter, HTTPException
from app.database import supabase
from typing import Optional

router = APIRouter(prefix="/public", tags=["Public"])

@router.get("/asset-info/{asset_id}")
def get_public_asset_info(asset_id: str):
    if not supabase:
        raise HTTPException(status_code=500, detail="Database connection error")

    # 1. Get Asset
    res_asset = supabase.table("assets").select("*").eq("id", asset_id).execute()
    if not res_asset.data:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset = res_asset.data[0]

    # 2. Get Movements
    res_movements = supabase.table("movements").select("*").eq("asset_id", asset_id).execute()
    movements = res_movements.data

    # 3. Get Tickets
    res_tickets = supabase.table("tickets").select("*").eq("asset_id", asset_id).execute()
    tickets = res_tickets.data

    # 4. Get Calibrations
    res_calibrations = supabase.table("calibrations").select("*").eq("asset_id", asset_id).execute()
    calibrations = res_calibrations.data

    # 5. Get Public Permissions
    res_perms = supabase.table("permissions").select("*").eq("role_name", "Public Access").execute()
    permissions = res_perms.data

    return {
        "asset": asset,
        "movements": movements,
        "tickets": tickets,
        "calibrations": calibrations,
        "permissions": permissions
    }
