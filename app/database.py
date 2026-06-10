import os
from supabase import create_client, Client
import firebase_admin
from dotenv import load_dotenv

load_dotenv()

# Supabase Initialization
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_KEY")

if supabase_url and supabase_key:
    supabase: Client = create_client(supabase_url, supabase_key)
else:
    supabase = None
    print("WARNING: Supabase credentials not found.")

# Firebase Admin Initialization
# Typically requires a serviceAccountKey.json. 
# We initialize it without credentials to use application default credentials if available.
if not firebase_admin._apps:
    try:
        firebase_admin.initialize_app()
    except Exception as e:
        print(f"Firebase Admin Initialization Error: {e}")
