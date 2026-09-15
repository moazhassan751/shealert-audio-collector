import io
import json
from pathlib import Path
from typing import Any


class GoogleDriveStore:
    def __init__(self, credentials_json: str, root_folder_id: str, shared_drive_id: str | None = None):
        from google.oauth2 import service_account
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload

        info = json.loads(credentials_json)
        credentials = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/drive"]
        )
        self.service = build("drive", "v3", credentials=credentials, cache_discovery=False)
        self.root = root_folder_id
        self.shared_drive_id = shared_drive_id
        self.media_type = MediaFileUpload

    def _folder(self, name: str, parent: str) -> str:
        query = f"name = '{name}' and '{parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        result = self.service.files().list(q=query, fields="files(id,name)", supportsAllDrives=True,
                                            includeItemsFromAllDrives=True).execute()
        if result.get("files"):
            return result["files"][0]["id"]
        body = {"name": name, "mimeType": "application/vnd.google-apps.folder", "parents": [parent]}
        return self.service.files().create(body=body, fields="id", supportsAllDrives=True).execute()["id"]

    def upload_verified(self, path: Path, name: str, bucket: str, originals: bool = False) -> str:
        area = self._folder("originals" if originals else "audio", self.root)
        folder = self._folder(bucket, area)
        query = f"name = '{name}' and '{folder}' in parents and trashed = false"
        existing = self.service.files().list(q=query, fields="files(id,size)", supportsAllDrives=True,
                                              includeItemsFromAllDrives=True).execute().get("files", [])
        if existing:
            return existing[0]["id"]
        media = self.media_type(str(path), resumable=True)
        body = {"name": name, "parents": [folder]}
        uploaded = self.service.files().create(body=body, media_body=media, fields="id,size",
                                                supportsAllDrives=True).execute()
        verified = self.service.files().get(fileId=uploaded["id"], fields="id,size,trashed",
                                            supportsAllDrives=True).execute()
        if verified.get("trashed") or not verified.get("id"):
            raise RuntimeError("Google Drive verification failed")
        return verified["id"]


class GoogleSheetStore:
    def __init__(self, credentials_json: str, sheet_id: str):
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        info = json.loads(credentials_json)
        credentials = service_account.Credentials.from_service_account_info(
            info, scopes=["https://www.googleapis.com/auth/spreadsheets"]
        )
        self.service = build("sheets", "v4", credentials=credentials, cache_discovery=False)
        self.sheet_id = sheet_id

    def append(self, record: dict[str, Any]) -> None:
        values = [[record.get(key, "") for key in [
            "recording_id", "volunteer_id", "participant_id", "gender_category", "class",
            "section_class", "word_code", "phrase_id", "phrase_text", "translation", "category",
            "take_code", "intensity", "loudness", "recording_number", "take_number",
            "environment", "environment_code", "environment_name", "environment_label", "content_gender", "age_group",
            "native_language", "timestamp", "duration_seconds", "sample_rate", "channels",
            "original_filename", "standardized_filename", "google_drive_file_id",
            "google_drive_folder_path", "upload_status"
        ]]]
        self.service.spreadsheets().values().append(
            spreadsheetId=self.sheet_id, range="A:AH", valueInputOption="RAW",
            insertDataOption="INSERT_ROWS", body={"values": values}
        ).execute()
