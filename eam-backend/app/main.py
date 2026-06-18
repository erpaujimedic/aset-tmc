from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os
from app.routers import auth, users, permissions, assets, deliveries, dashboard, movements, calibrations, tickets, setup, settings, master_components
from app.database import supabase

from contextlib import asynccontextmanager
from redis import asyncio as aioredis
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.backends.inmemory import InMemoryBackend
import asyncio
from app.services.cron_jobs import enforce_sla_loop, check_calibration_loop

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
        
    # Start background cron jobs
    sla_task = asyncio.create_task(enforce_sla_loop())
    calib_task = asyncio.create_task(check_calibration_loop())
    
    yield
    
    # Cancel tasks on shutdown
    sla_task.cancel()
    calib_task.cancel()

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

import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    with open("error_log.txt", "a") as f:
        f.write(f"ERROR on {request.url}:\n")
        f.write(traceback.format_exc())
        f.write("\n")
    return {"detail": "Internal Server Error"}

# Extreme Optimization: Compress JSON responses to save bandwidth and speed up load times
# app.add_middleware(GZipMiddleware, minimum_size=500)

import os
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def read_root():
    return {"message": "Welcome to EAM System API"}

@app.get("/master/setup-data")
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

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(permissions.router)
app.include_router(assets.router)
app.include_router(deliveries.router)
app.include_router(dashboard.router)
app.include_router(movements.router)
app.include_router(calibrations.router)
app.include_router(tickets.router)
app.include_router(setup.router)
app.include_router(settings.router)
app.include_router(master_components.router)
