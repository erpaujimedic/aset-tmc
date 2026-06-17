import os
from dotenv import load_dotenv

load_dotenv()
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_KEY")

from supabase import create_client, Client
supabase: Client = create_client(supabase_url, supabase_key)

try:
    print("Testing certificate_url column...")
    res = supabase.table("calibrations").select("certificate_url").limit(1).execute()
    print("certificate_url column exists!")
except Exception as e:
    print(f"Error checking certificate_url column: {e}")

try:
    print("Testing notes column...")
    res = supabase.table("calibrations").select("notes").limit(1).execute()
    print("notes column exists!")
except Exception as e:
    print(f"Error checking notes column: {e}")
