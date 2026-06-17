import os
import random
import uuid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")

from supabase import create_client, Client
supabase: Client = create_client(supabase_url, supabase_key)

BRANCH_NAME = "DUMMY_SANDBOX"

categories = ["HARDWARE", "SOFTWARE", "VEHICLE", "FURNITURE"]
departments = ["IT SUPPORT", "HR", "FINANCE", "OPERATIONS", "MARKETING"]
rooms = ["Ruang Server", "Ruang Meeting A", "Ruang Staf Lt. 2", "Gudang", "Lobby"]
conditions = ["BAGUS & DIGUNAKAN", "RUSAK RINGAN", "DALAM PERBAIKAN", "CADANGAN"]
brands = ["Logitech", "Lenovo", "Dell", "HP", "Epson", "Honda", "Toyota", "IKEA"]
photo_urls = [
    "https://dummyimage.com/600x400/000/fff&text=Asset+Photo+1",
    "https://dummyimage.com/600x400/000/fff&text=Asset+Photo+2",
    "https://dummyimage.com/600x400/000/fff&text=Asset+Photo+3"
]

assets_to_insert = []

for i in range(1, 21):
    asset_id = f"DUMMY-AST-{random.randint(1000, 9999)}-{i}"
    category = random.choice(categories)
    
    if category == "HARDWARE":
        name = f"Laptop {random.choice(brands)} Pro"
    elif category == "SOFTWARE":
        name = f"Lisensi {random.choice(['Office', 'Adobe', 'Antivirus'])}"
    elif category == "VEHICLE":
        name = f"Mobil Operasional {random.choice(brands)}"
    else:
        name = f"Meja / Kursi {random.choice(brands)}"

    asset_data = {
        "id": asset_id,
        "name": name,
        "category": category,
        "branch": BRANCH_NAME,
        "department": random.choice(departments),
        "room": random.choice(rooms),
        "condition": random.choice(conditions),
        "photo_url": random.choice(photo_urls),
        "brand": random.choice(brands),
        "serial_number": f"SN-{uuid.uuid4().hex[:8].upper()}",
        "user_name": f"Dummy User {i}",
        "placement_location": f"Lokasi {random.randint(1, 5)}",
        "status": "Active",
        "is_labeled": random.choice([True, False]),
        "assignee": f"Dummy Assignee {i}",
        "created_at": datetime.now().isoformat()
    }
    assets_to_insert.append(asset_data)

try:
    print(f"Memasukkan {len(assets_to_insert)} aset dummy ke cabang {BRANCH_NAME}...")
    # Supabase allows bulk inserts
    res = supabase.table("assets").insert(assets_to_insert).execute()
    print("Berhasil memasukkan 20 aset dummy!")
except Exception as e:
    print(f"Error: {e}")
