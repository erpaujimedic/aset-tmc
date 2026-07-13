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

# MOST Supabase Initialization (IdP & Branches)
most_supabase_url = os.getenv("MOST_SUPABASE_URL")
most_supabase_key = os.getenv("MOST_SUPABASE_KEY")

if most_supabase_url and most_supabase_key:
    most_supabase: Client = create_client(most_supabase_url, most_supabase_key, options=ClientOptions(postgrest_client_timeout=10))
else:
    most_supabase = None
    print("WARNING: MOST Supabase credentials not found.")

# Firebase Admin Initialization removed

import redis
redis_url = os.getenv("REDIS_URL")
if redis_url:
    try:
        redis_client = redis.from_url(redis_url)
    except Exception as e:
        print(f"WARNING: Redis connection failed: {e}")
        redis_client = None
else:
    redis_client = None
    print("WARNING: Redis credentials not found.")
