import os
import asyncio
from dotenv import load_dotenv
from redis import asyncio as aioredis

load_dotenv()

async def clear():
    redis = aioredis.from_url(os.getenv('REDIS_URL'))
    await redis.flushdb()
    print("Redis cache cleared successfully!")

asyncio.run(clear())
