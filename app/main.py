from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
import os
from app.routers import auth, users, permissions, assets, deliveries, dashboard, movements, calibrations, tickets, setup
from app.database import supabase

load_dotenv()

app = FastAPI(
    title="TMC EAM System API",
    description="Backend API for Enterprise Asset Management System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
