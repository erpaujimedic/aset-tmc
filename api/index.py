import sys
import os

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, 'eam-backend')

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(1, backend_dir)

from fastapi import FastAPI
import traceback

app = FastAPI()

try:
    from app.main import app as real_app
    # Override app if successful
    app.router = real_app.router
    app.middleware = real_app.middleware
    app.exception_handlers = real_app.exception_handlers
except Exception as e:
    error_detail = str(e)
    trace = traceback.format_exc()
    
    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE"])
    async def catch_all(path_name: str):
        return {"error": "IMPORT_ERROR", "detail": error_detail, "traceback": trace}
