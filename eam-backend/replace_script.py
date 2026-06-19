import re
import os

with open(r'c:\Web App Running TMC\eam -asset\eam-backend\app\routers\movements.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
if 'from fastapi import BackgroundTasks' not in content:
    content = content.replace('from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form', 'from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, BackgroundTasks')
if 'from app.services.async_upload import process_async_upload' not in content:
    content = content.replace('from app.services.gdrive import upload_file_to_drive', 'from app.services.gdrive import upload_file_to_drive\nfrom app.services.async_upload import process_async_upload')
if 'import uuid' not in content:
    content = content.replace('import json', 'import json\n    import uuid\n    import os\n    import shutil')

old1 = """    return_to: str = Form(None),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...)
):"""
new1 = """    return_to: str = Form(None),
    notes: Optional[str] = Form(None),
    proof_image: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
):"""
content = content.replace(old1, new1)

old2 = """        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        file_name_base = generate_filename("naming_format_return", tracking_code, proof_image.filename, returner_name)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        proof_url = upload_file_to_drive(proof_image.file, filename, proof_image.content_type)

        for movement in mov.data:"""
new2 = """        file_ext = proof_image.filename.split(".")[-1] if "." in proof_image.filename else "jpg"
        file_name_base = generate_filename("naming_format_return", tracking_code, proof_image.filename, returner_name)
        filename = f"{file_name_base}.{file_ext}" if not file_name_base.endswith(f".{file_ext}") else file_name_base
        filename = filename.replace("/", "_").replace("\\\\", "_")
        
        temp_dir = "uploads/temp"
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{filename}")
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(proof_image.file, buffer)
            
        proof_url = "UPLOADING..."
        updates_for_bg = []

        for movement in mov.data:"""
content = content.replace(old2, new2)

old3 = """            log_data = {
                "movement_id": movement['id'],
                "status_update": log_msg,
                "description": log_desc,
                "updated_by": returner_name,
                "proof_url": proof_url
            }
            supabase.table("movement_logs").insert(log_data).execute()

        return {"message": "Return request submitted. Menunggu approval dari tujuan."}"""
new3 = """            log_data = {
                "movement_id": movement['id'],
                "status_update": log_msg,
                "description": log_desc,
                "updated_by": returner_name,
                "proof_url": proof_url
            }
            supabase.table("movement_logs").insert(log_data).execute()
            updates_for_bg.append({"table": "movement_logs", "id": log_data.get("id", ""), "column": "proof_url"})
            updates_for_bg.append({"table": "asset_movements", "id": movement['id'], "column": "sender_proof_url"})

        background_tasks.add_task(
            process_async_upload,
            temp_path,
            filename,
            proof_image.content_type,
            "",
            updates_for_bg
        )

        return {"message": "Return request submitted. Menunggu approval dari tujuan."}"""
content = content.replace(old3, new3)

with open(r'c:\Web App Running TMC\eam -asset\eam-backend\app\routers\movements.py', 'w', encoding='utf-8') as f:
    f.write(content)
