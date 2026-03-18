"""Admin endpoints: Calibre import, format conversion."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.models.database import get_db
from app.config import settings
from .auth import get_current_user

router = APIRouter(prefix="/api/library", tags=["library"], dependencies=[Depends(get_current_user)])


class ImportRequest(BaseModel):
    calibre_path: str


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: int


@router.post("/import-calibre", response_model=ImportResult)
async def import_calibre(
    body: ImportRequest,
    db: AsyncSession = Depends(get_db),
):
    """Import books from a Calibre library directory (must contain metadata.db)."""
    from app.services.calibre_db import import_calibre_library

    try:
        result = await import_calibre_library(
            body.calibre_path,
            settings.upload_dir,
            db,
        )
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Import failed: {e}")

    return result
