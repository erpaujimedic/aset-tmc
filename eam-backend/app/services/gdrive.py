import os
import io
from google.oauth2.credentials import Credentials as OAuthCredentials
from google.oauth2.service_account import Credentials as ServiceAccountCredentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

SCOPES = ['https://www.googleapis.com/auth/drive']
# The root folder "00 Asset Migration"
ROOT_FOLDER_ID = "1bD5S3WzwYers1KA_iPcxNBD-4zSZKlUZ"

def get_drive_service():
    token_path = os.path.join(os.getcwd(), 'token.json')
    if os.path.exists(token_path):
        creds = OAuthCredentials.from_authorized_user_file(token_path, SCOPES)
        return build('drive', 'v3', credentials=creds, cache_discovery=False)
        
    creds_path = os.path.join(os.getcwd(), 'credentials.json')
    creds = ServiceAccountCredentials.from_service_account_file(creds_path, scopes=SCOPES)
    return build('drive', 'v3', credentials=creds, cache_discovery=False)

def get_or_create_folder(service, folder_name: str, parent_id: str = ROOT_FOLDER_ID) -> str:
    """Finds a folder by name in the parent folder. If not exists, creates it."""
    query = f"name = '{folder_name}' and '{parent_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    
    results = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)'
    ).execute()
    
    items = results.get('files', [])
    if items:
        # Return the first match
        return items[0]['id']
    
    # Not found, create it
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }
    
    folder = service.files().create(
        body=file_metadata,
        fields='id'
    ).execute()
    
    return folder.get('id')

def upload_file_to_drive(file_obj, filename: str, mime_type: str, folder_id: str) -> str:
    """Uploads a file to Google Drive and makes it readable by anyone with the link."""
    service = get_drive_service()
    
    file_metadata = {
        'name': filename,
        'parents': [folder_id]
    }
    
    media = MediaIoBaseUpload(file_obj, mimetype=mime_type, resumable=True)
    
    uploaded_file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, webViewLink'
    ).execute()
    
    file_id = uploaded_file.get('id')
    
    # Make the file public (anyone with the link can view)
    permission = {
        'type': 'anyone',
        'role': 'reader',
    }
    service.permissions().create(
        fileId=file_id,
        body=permission,
        fields='id'
    ).execute()
    
    return uploaded_file.get('webViewLink')
