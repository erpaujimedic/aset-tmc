import os

with open(r"c:\Web App Running TMC\eam -asset\eam-backend\app\main.py", "r", encoding="utf-8") as f:
    content = f.read()

# Imports to add
imports = """from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

"""

# Config to add after app = FastAPI(...)
config = """
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
"""

if "SlowAPIMiddleware" not in content:
    # Add imports at the top
    content = content.replace("from fastapi import FastAPI\n", "from fastapi import FastAPI\n" + imports)
    
    # Add config after app = FastAPI(...)
    content = content.replace("app.add_middleware(\n", config, 1)

    with open(r"c:\Web App Running TMC\eam -asset\eam-backend\app\main.py", "w", encoding="utf-8") as f:
        f.write(content)
    print("Added SlowAPI successfully!")
else:
    print("SlowAPI already configured.")
