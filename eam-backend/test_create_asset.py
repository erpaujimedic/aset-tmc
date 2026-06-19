import urllib.request
import json
import uuid

asset_code = f"TEST-{str(uuid.uuid4())[:8]}"

data = {
    "asset_code": asset_code,
    "name": "Audit Test Asset",
    "category": "IT Equipment",
    "status": "Active",
    "branch": "TMC Ternate",
    "condition": "Good",
    "purchase_date": "2026-06-19",
    "purchase_price": 5000000.0,
    "current_value": 4500000.0
}

req = urllib.request.Request(
    'http://localhost:8000/assets',
    data=json.dumps(data).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)

try:
    with urllib.request.urlopen(req) as res:
        response = json.loads(res.read().decode())
        print("Create Asset Success:", response)
        # Store ID for deletion
        with open('test_asset_id.txt', 'w') as f:
            f.write(response['data'][0]['id'])
except Exception as e:
    print('Create Asset Error:', e)
    if hasattr(e, 'read'):
        print(e.read().decode())
