from app.database import supabase

mapping = {
    "Menunggu Dokumen TTD": "Requested",
    "Pending Borrow Approval": "Pending Approval",
    "Borrowed": "Received",
    "Pending Return Approval": "Return Pending Approval",
    "Returning": "Return In Transit",
    "Received": "Completed",
    "Canceled": "Cancelled"
}

print("Starting migration...")

# 1. Update asset_movements table
for old_status, new_status in mapping.items():
    res = supabase.table("asset_movements").update({"status": new_status}).eq("status", old_status).execute()
    print(f"asset_movements: Updated {len(res.data)} rows from '{old_status}' to '{new_status}'")

# 2. Update assets table
for old_status, new_status in mapping.items():
    # Assets status only uses some of these
    if old_status in ["Pending Borrow Approval", "Borrowed", "Pending Return Approval", "Returning", "Canceled"]:
        res = supabase.table("assets").update({"status": new_status}).eq("status", old_status).execute()
        print(f"assets: Updated {len(res.data)} rows from '{old_status}' to '{new_status}'")

print("Migration completed successfully.")
