import os
from app.services.gdrive import upload_file_to_drive, get_drive_service, get_or_create_folder
from app.database import supabase

def process_async_upload(
    file_path: str,
    file_name: str,
    content_type: str,
    folder_name: str,
    updates: list # List of dicts like [{"table": "asset_movements", "id": "123", "column": "sender_proof_url"}]
):
    try:
        service = get_drive_service()
        folder_id = get_or_create_folder(service, folder_name) if folder_name else None
        
        with open(file_path, "rb") as f:
            proof_url = upload_file_to_drive(f, file_name, content_type, folder_id)
        
        if proof_url:
            for update in updates:
                try:
                    supabase.table(update["table"]).update({update["column"]: proof_url}).eq("id", update["id"]).execute()
                except Exception as db_e:
                    print(f"Async upload DB update failed for {update['table']} id {update['id']}: {db_e}")
                    
    except Exception as e:
        print(f"Async upload failed: {e}")
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)
