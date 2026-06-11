from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os
from app.routers import auth, users, permissions, assets, deliveries, dashboard, movements, calibrations, tickets, setup
from app.database import supabase

from contextlib import asynccontextmanager
from redis import asyncio as aioredis
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.backends.inmemory import InMemoryBackend

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
    yield

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

# Extreme Optimization: Compress JSON responses to save bandwidth and speed up load times
app.add_middleware(GZipMiddleware, minimum_size=500)

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
