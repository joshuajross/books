"""Runtime settings endpoint (read-only, for frontend config display)."""
import json
import aiosmtplib
from email.mime.text import MIMEText
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

_OVERRIDES_FILE = Path("/data/settings.json")


class PublicSettings(BaseModel):
    app_name: str
    email_configured: bool
    google_books_configured: bool


class SmtpConfig(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str  # empty string means "keep existing"
    smtp_from: str


class SmtpConfigOut(BaseModel):
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_from: str
    has_password: bool


@router.get("", response_model=PublicSettings)
async def get_settings():
    return PublicSettings(
        app_name=settings.app_name,
        email_configured=bool(settings.smtp_user and settings.smtp_password),
        google_books_configured=bool(settings.google_books_api_key),
    )


@router.get("/smtp", response_model=SmtpConfigOut)
async def get_smtp():
    return SmtpConfigOut(
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_from=settings.smtp_from,
        has_password=bool(settings.smtp_password),
    )


@router.post("/smtp")
async def save_smtp(config: SmtpConfig):
    # Keep existing password if a blank string is submitted
    password = config.smtp_password or settings.smtp_password

    # Update runtime settings
    object.__setattr__(settings, "smtp_host", config.smtp_host)
    object.__setattr__(settings, "smtp_port", config.smtp_port)
    object.__setattr__(settings, "smtp_user", config.smtp_user)
    object.__setattr__(settings, "smtp_password", password)
    object.__setattr__(settings, "smtp_from", config.smtp_from)

    # Persist overrides
    data: dict = {}
    if _OVERRIDES_FILE.exists():
        try:
            data = json.loads(_OVERRIDES_FILE.read_text())
        except Exception:
            pass
    data.update({
        "smtp_host": config.smtp_host,
        "smtp_port": config.smtp_port,
        "smtp_user": config.smtp_user,
        "smtp_password": password,
        "smtp_from": config.smtp_from,
    })
    _OVERRIDES_FILE.write_text(json.dumps(data, indent=2))
    return {"ok": True}


@router.post("/smtp/test")
async def test_smtp():
    if not settings.smtp_user or not settings.smtp_password:
        raise HTTPException(status_code=400, detail="SMTP credentials not configured")

    msg = MIMEText("BookShelf SMTP test — your email configuration is working correctly.")
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = settings.smtp_user
    msg["Subject"] = "BookShelf SMTP Test"

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=True,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    return {"ok": True}
