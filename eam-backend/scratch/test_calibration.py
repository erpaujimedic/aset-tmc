import requests, json
url = 'http://127.0.0.1:8001/calibrations?branch=Head%20Office'
payload = {
    "asset_id": "HRW-0012439",
    "last_calibration_date": "2023-01-01",
    "next_calibration_date": "2024-01-01",
    "calibration_vendor": "VendorA",
    "status": "Valid"
}
resp = requests.post(url, json=payload)
print('Status:', resp.status_code)
print('Response:', resp.text)
