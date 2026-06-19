import re

def process_tickets():
    with open('c:\\Web App Running TMC\\eam -asset\\eam-backend\\app\\routers\\tickets.py', 'r', encoding='utf-8') as f:
        text = f.read()

    text = text.replace(
        'from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, BackgroundTasks',
        'from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, BackgroundTasks, Request\nfrom app.services.audit import log_audit'
    )
    
    # create_ticket
    text = text.replace('def create_ticket(tck: TicketCreate):', 'def create_ticket(tck: TicketCreate, request: Request, background_tasks: BackgroundTasks):')
    text = text.replace(
        'return {"message": "Tiket berhasil dibuat", "data": res.data}',
        'user_name = request.headers.get("X-User-Name", tck.reporter_name)\n        user_role = request.headers.get("X-User-Role", "System")\n        user_branch = request.headers.get("X-User-Branch", "System")\n        log_audit(background_tasks, user_name, user_role, user_branch, "CREATE", "Tickets", f"Membuat tiket baru: {tck.title}")\n        return {"message": "Tiket berhasil dibuat", "data": res.data}'
    )

    # update_ticket
    text = text.replace('def update_ticket(ticket_id: str, tck: TicketUpdate):', 'def update_ticket(ticket_id: str, tck: TicketUpdate, request: Request, background_tasks: BackgroundTasks):')
    text = text.replace(
        'return {"message": "Tiket berhasil diupdate", "data": res.data}',
        'user_name = request.headers.get("X-User-Name", "System")\n        user_role = request.headers.get("X-User-Role", "System")\n        user_branch = request.headers.get("X-User-Branch", "System")\n        log_audit(background_tasks, user_name, user_role, user_branch, "UPDATE", "Tickets", f"Mengubah tiket: {ticket_id}")\n        return {"message": "Tiket berhasil diupdate", "data": res.data}'
    )

    # delete_ticket
    text = text.replace('def delete_ticket(ticket_id: str):', 'def delete_ticket(ticket_id: str, request: Request, background_tasks: BackgroundTasks):')
    text = text.replace(
        'return {"message": "Tiket berhasil dihapus"}',
        'user_name = request.headers.get("X-User-Name", "System")\n        user_role = request.headers.get("X-User-Role", "System")\n        user_branch = request.headers.get("X-User-Branch", "System")\n        log_audit(background_tasks, user_name, user_role, user_branch, "DELETE", "Tickets", f"Menghapus tiket: {ticket_id}")\n        return {"message": "Tiket berhasil dihapus"}'
    )

    with open('c:\\Web App Running TMC\\eam -asset\\eam-backend\\app\\routers\\tickets.py', 'w', encoding='utf-8') as f:
        f.write(text)

process_tickets()
