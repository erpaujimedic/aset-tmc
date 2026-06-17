import urllib.request, json
data=json.dumps({'status': 'In Progress', 'changed_by_name': 'TestUser', 'changed_by_role': 'Admin'}).encode()
req = urllib.request.Request('http://127.0.0.1:8000/tickets/6dbdfa48-1747-4ac6-adeb-8646f719ede2', data=data, headers={'Content-Type': 'application/json'}, method='PUT')
try:
  urllib.request.urlopen(req)
  print("Success")
except Exception as e:
  print(e.read().decode())
