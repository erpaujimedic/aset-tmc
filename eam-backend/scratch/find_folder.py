import os
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/drive']

def get_drive_service():
    creds = Credentials.from_service_account_file('credentials.json', scopes=SCOPES)
    return build('drive', 'v3', credentials=creds)

def find_root_folder():
    service = get_drive_service()
    
    # Query for the folder
    query = "name = '00 Asset Migration' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    
    try:
        results = service.files().list(
            q=query,
            fields="nextPageToken, files(id, name, shared)",
            spaces='drive'
        ).execute()
        
        items = results.get('files', [])
        if not items:
            print("No folder found.")
        else:
            print("Found folders:")
            for item in items:
                print(f"{item['name']} ({item['id']}) - Shared: {item.get('shared', False)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    find_root_folder()
