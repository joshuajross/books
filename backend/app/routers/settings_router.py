"""Runtime settings endpoint (read-only, for frontend config display)."""
from fastapi import APIRouter
from pydantic import BaseModel
from app.config import settings
from app.services.converter import calibre_available

router = APIRouter(prefix="/api/settings", tags=["settings"])


class PublicSettings(BaseModel):
    app_name: str
    email_configured: bool
    conversion_available: bool
    google_books_configured: bool


@router.get("", response_model=PublicSettings)
async def get_settings():
    return PublicSettings(
        app_name=settings.app_name,
        email_configured=bool(settings.smtp_user and settings.smtp_password),
        conversion_available=calibre_available(),
        google_books_configured=bool(settings.google_books_api_key),
    )
