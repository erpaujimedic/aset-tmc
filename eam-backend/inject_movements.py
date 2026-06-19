with open('c:\\Web App Running TMC\\eam -asset\\eam-backend\\app\\routers\\movements.py', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, BackgroundTasks',
    'from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, BackgroundTasks, Request\nfrom app.services.audit import log_audit'
)

text = text.replace(
    'background_tasks: BackgroundTasks = BackgroundTasks()',
    'background_tasks: BackgroundTasks = BackgroundTasks(), request: Request = None'
)

text = text.replace(
    'return {"message": f"{len(ids)} aset berhasil dikirim"}',
    'if request:\n            user_name = request.headers.get("X-User-Name", sender_name)\n            user_role = request.headers.get("X-User-Role", "System")\n            user_branch = request.headers.get("X-User-Branch", from_location)\n            log_audit(background_tasks, user_name, user_role, user_branch, "DISPATCH", "Movements", f"Mengirim {len(ids)} aset ({tracking_code})")\n        return {"message": f"{len(ids)} aset berhasil dikirim"}'
)

text = text.replace(
    'def receive_asset(',
    'def receive_asset(\n    request: Request,'
)

text = text.replace(
    'return {"message": "Proses penerimaan parsial/keseluruhan berhasil"}',
    'user_name = request.headers.get("X-User-Name", receiver_name)\n        user_role = request.headers.get("X-User-Role", "System")\n        user_branch = request.headers.get("X-User-Branch", "System")\n        log_audit(background_tasks, user_name, user_role, user_branch, "RECEIVE", "Movements", f"Menerima aset ({tracking_code})")\n        return {"message": "Proses penerimaan parsial/keseluruhan berhasil"}'
)

with open('c:\\Web App Running TMC\\eam -asset\\eam-backend\\app\\routers\\movements.py', 'w', encoding='utf-8') as f:
    f.write(text)
