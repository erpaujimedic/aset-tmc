import urllib.request
import json

try:
    with urllib.request.urlopen('http://localhost:8000/assets') as res:
        data = json.loads(res.read().decode())
        print(f"Total Assets: {len(data.get('data', []))}")
except Exception as e:
    print('Error:', e)
