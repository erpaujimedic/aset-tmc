import os
from supabase import create_client, Client, ClientOptions
from dotenv import load_dotenv

load_dotenv()

# Supabase Initialization
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if supabase_url and supabase_key:
    supabase: Client = create_client(supabase_url, supabase_key, options=ClientOptions(postgrest_client_timeout=10, storage_client_timeout=10))
else:
    supabase = None
    print("WARNING: Supabase credentials not found.")

# Firebase Admin Initialization removed
