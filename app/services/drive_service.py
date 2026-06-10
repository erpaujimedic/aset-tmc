import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
import io

# Konfigurasi Google Drive
CREDENTIALS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'credentials.json')
SCOPES = ['https://www.googleapis.com/auth/drive.file']
FOLDER_ID = '1bD5S3WzwYers1KA_iPcxNBD-4zSZKlUZ'

def get_drive_service():
    """Inisialisasi koneksi ke Google Drive API."""
    creds = None
    if os.path.exists(CREDENTIALS_FILE):
        creds = service_account.Credentials.from_service_account_file(
            CREDENTIALS_FILE, scopes=SCOPES)
    else:
        print("Warning: credentials.json not found!")
    return build('drive', 'v3', credentials=creds) if creds else None

def upload_file_to_drive(file_obj, filename, mime_type='image/jpeg'):
    """
    Mengupload file ke folder Google Drive yang sudah ditentukan.
    Mengembalikan URL yang bisa diakses publik (jika folder di-set publik) atau Web View Link.
    """
    service = get_drive_service()
    if not service:
        return None

    file_metadata = {
        'name': filename,
        'parents': [FOLDER_ID]
    }
    
    media = MediaIoBaseUpload(file_obj, mimetype=mime_type, resumable=True)
    
    try:
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink, webContentLink'
        ).execute()
        
        # Kembalikan webViewLink agar bisa langsung dilihat di browser
        return file.get('webViewLink')
    except Exception as e:
        print(f"Error uploading to Drive: {e}")
        return None
