import sys
import os
# Fix sys.path for Vercel so absolute imports like 'from app.routers...' work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from app.routers import auth, users, permissions, assets, deliveries, dashboard, movements, calibrations, tickets, setup, settings, master_components, audit, public
from app.database import supabase
from app.dependencies import get_current_user
from fastapi import Depends
from app.dependencies import get_current_user
from fastapi import Depends

from contextlib import asynccontextmanager
from redis import asyncio as aioredis
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.backends.inmemory import InMemoryBackend
import asyncio
from app.services.cron_jobs import run_sla_enforcement, run_calibration_check

load_dotenv()

redis_url = os.getenv("REDIS_URL")

@asynccontextmanager
async def lifespan(app: FastAPI):
    if redis_url:
        try:
            # We must use decode_responses=False for fastapi-cache
            redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=False)
            FastAPICache.init(RedisBackend(redis), prefix="eam-cache")
            print("Upstash Redis cache successfully initialized!")
        except Exception as e:
            print(f"Failed to connect to Redis: {e}")
            FastAPICache.init(InMemoryBackend(), prefix="eam-cache")
    else:
        print("WARNING: REDIS_URL not set. Falling back to InMemory Cache.")
        FastAPICache.init(InMemoryBackend(), prefix="eam-cache")
        
    # Start background cron jobs (DISABLED FOR VERCEL SERVERLESS)
    # sla_task = asyncio.create_task(enforce_sla_loop())
    # calib_task = asyncio.create_task(check_calibration_loop())
    
    yield
    
    # Cancel tasks on shutdown
    # sla_task.cancel()
    # calib_task.cancel()

app = FastAPI(
    title="TMC EAM System API",
    description="Backend API for Enterprise Asset Management System",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"ERROR on {request.url}:\n{traceback.format_exc()}")
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

# Extreme Optimization: Compress JSON responses to save bandwidth and speed up load times
# app.add_middleware(GZipMiddleware, minimum_size=500)

import os
os.makedirs("uploads", exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to EAM System API"}

@app.get("/api/cron/sync")
def run_cron_sync(token: str = None):
    # In production, verify the cron secret token
    cron_secret = os.getenv("CRON_SECRET")
    if cron_secret and token != cron_secret:
        return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        
    sla_result = run_sla_enforcement()
    calib_result = run_calibration_check()
    return {
        "message": "Cron jobs executed successfully",
        "sla": sla_result,
        "calibration": calib_result
    }

@app.get("/api/master/setup-data")
def get_master_setup_data():
    if not supabase:
        return {"branches": []}
    
    try:
        # Fetch data and order by sort_order
        res = supabase.table("branches").select("id, name, branch_code, region, lat, lng").order("sort_order").execute()
        return {
            "branches": res.data
        }
    except Exception as e:
        print(f"Error fetching branches: {e}")
        return {"branches": []}

app.include_router(auth.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(users.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(permissions.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(assets.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(deliveries.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(dashboard.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(movements.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(calibrations.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(tickets.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(setup.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(settings.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(master_components.router, dependencies=[Depends(get_current_user)], prefix="/api")
app.include_router(audit.router, dependencies=[Depends(get_current_user)], prefix="/api")