"""Runtime settings endpoint (read-only, for frontend config display)."""
from fastapi import APIRouter
from pydantic import BaseModel
from app.config import settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


class PublicSettings(BaseModel):
    app_name: str
    email_configured: bool


@router.get("", response_model=PublicSettings)
async def get_settings():
    return PublicSettings(
        app_name=settings.app_name,
        email_configured=bool(settings.smtp_user and settings.smtp_password),
    )
