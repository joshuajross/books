from pydantic_settings import BaseSettings
from pathlib import Path


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

    class Config:
        env_file = ".env"


settings = Settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
