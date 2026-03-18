from pydantic_settings import BaseSettings
from pathlib import Path
import json

_OVERRIDES_FILE = Path("/data/settings.json")


class Settings(BaseSettings):
    app_name: str = "BookShelf"
    upload_dir: Path = Path("/data/uploads")
    db_path: str = "/data/library.db"

    # Email settings
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""

    # Metadata providers
    google_books_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)

# Apply any saved overrides from the admin UI
if _OVERRIDES_FILE.exists():
    try:
        for key, value in json.loads(_OVERRIDES_FILE.read_text()).items():
            if hasattr(settings, key):
                object.__setattr__(settings, key, value)
    except Exception:
        pass
