"""Format conversion endpoint using Calibre's ebook-convert."""
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.models.database import Book, get_db
from app.services.converter import convert_book, calibre_available, CONVERSION_MATRIX
from app.config import settings

router = APIRouter(prefix="/api/convert", tags=["convert"])


class ConvertRequest(BaseModel):
    target_format: str


@router.get("/available")
async def conversion_available():
    """Check whether ebook-convert is installed."""
    return {"available": calibre_available(), "matrix": CONVERSION_MATRIX}


@router.post("/{book_id}")
async def convert(
    book_id: int,
    body: ConvertRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Convert a book to a different format and stream the result.
    Requires Calibre to be installed on the server.
    """
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")

    src = Path(book.file_path)
    if not src.exists():
        raise HTTPException(404, "Source file not found")

    try:
        out_path = await convert_book(src, body.target_format.lower(), settings.upload_dir)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(400, str(e))

    filename = f"{book.title}.{body.target_format.lower()}"
    return FileResponse(
        path=str(out_path),
        filename=filename,
        media_type="application/octet-stream",
        background=None,  # file will be cleaned up by OS tmp
    )
