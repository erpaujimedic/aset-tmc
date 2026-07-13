from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os
from app.database import redis_client

router = APIRouter(prefix="/settings", tags=["Settings"])

DEFAULT_SETTINGS = {
    "naming_format_asset_photo": "AssetPhoto_{asset_code}_{original_filename}",
    "naming_format_calibration": "Calibration_{asset_code}_{original_filename}",
    "naming_format_borrow": "Borrow_{asset_code}_{original_filename}",
    "naming_format_return": "Return_{asset_code}_{original_filename}",
    "naming_format_dispatch": "Dispatch_{asset_code}_{original_filename}",
    "naming_format_receive": "Receive_{asset_code}_{original_filename}"
}

class SettingsUpdate(BaseModel):
    settings: dict

@router.get("")
def get_settings():
    return {"data": _load_settings()}

def _load_settings():
    if not redis_client:
        return DEFAULT_SETTINGS
    try:
        data_str = redis_client.get("system_settings")
        if data_str:
            data = json.loads(data_str)
            return {**DEFAULT_SETTINGS, **data}
        return DEFAULT_SETTINGS
    except Exception as e:
        print(f"Error loading settings from Redis: {e}")
        return DEFAULT_SETTINGS

import datetime
def generate_filename(setting_key: str, asset_code: str, original_filename: str, user: str = "System", asset_name: str = "") -> str:
    settings = _load_settings()
    fmt = settings.get(setting_key, DEFAULT_SETTINGS.get(setting_key, "{original_filename}"))
    now = datetime.datetime.now()
    
    # Replace variables
    fname = fmt.replace("{asset_code}", asset_code or "")
    fname = fname.replace("{asset_id}", asset_code or "")
    fname = fname.replace("{asset_name}", asset_name or "")
    fname = fname.replace("{date}", now.strftime("%Y-%m-%d"))
    fname = fname.replace("{time}", now.strftime("%H%M%S"))
    fname = fname.replace("{user}", user or "System")
    fname = fname.replace("{original_filename}", original_filename or "")
    
    # Clean up multiple underscores or spaces if variables were empty
    fname = fname.replace("  ", " ").replace("__", "_")
    return fname

@router.post("")
def update_settings(payload: SettingsUpdate):
    if not redis_client:
        raise HTTPException(status_code=500, detail="Redis connection error")
    try:
        redis_client.set("system_settings", json.dumps(payload.settings))
        return {"message": "Settings saved successfully", "data": payload.settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
