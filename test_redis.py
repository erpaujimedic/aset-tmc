import asyncio
import os
from redis import asyncio as aioredis
from dotenv import load_dotenv

load_dotenv()

async def test():
    url = os.getenv('REDIS_URL')
    print("Testing URL:", url)
    r = aioredis.from_url(url, decode_responses=False)
    try:
        res = await r.ping()
        print("Ping success:", res)
    except Exception as e:
        print("Ping failed:", e)

asyncio.run(test())
