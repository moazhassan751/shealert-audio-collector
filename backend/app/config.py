from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    admin_password: str = "change-me"
    frontend_origins: str = "http://localhost:5173"
    data_root: Path = Path("./backend/dataset")
    data_file_root: Path = Path("./backend/data")
    temp_root: Path = Path("./backend/temp")
    max_upload_mb: int = 25
    min_duration_seconds: float = 1.0
    ffmpeg_path: str = "ffmpeg"
    google_service_account_json: str | None = None
    google_service_account_file: Path | None = None
    google_oauth_token_file: Path | None = None
    google_oauth_token_json: str | None = None
    google_drive_root_folder_id: str | None = None
    google_sheet_id: str | None = None
    google_drive_shared_drive_id: str | None = None
    google_drive_required: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]

    @property
    def google_credentials_json(self) -> str | None:
        if self.google_oauth_token_file and self.google_oauth_token_file.exists():
            return self.google_oauth_token_file.read_text(encoding="utf-8")
        if self.google_oauth_token_json:
            return self.google_oauth_token_json
        if self.google_service_account_file and self.google_service_account_file.exists():
            return self.google_service_account_file.read_text(encoding="utf-8")
        return self.google_service_account_json


@lru_cache
def get_settings() -> Settings:
    return Settings()