import urllib.request
import json

try:
    with urllib.request.urlopen('http://localhost:8000/dashboard/stats') as res:
        data = json.loads(res.read().decode())
        print(f"Total Assets: {data.get('totalAssets')}")
        print(f"In Transit: {data.get('inTransit')}")
        print(f"Maintenance: {data.get('maintenance')}")
        print(f"Open Tickets: {data.get('openTickets')}")
except Exception as e:
    print('Error:', e)
