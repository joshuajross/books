"""Metadata lookup and apply endpoints."""
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import Optional

from app.models.database import Book, get_db
from app.services.metadata_providers import search_all
from app.config import settings
from .auth import get_current_user

router = APIRouter(prefix="/api/metadata", tags=["metadata"], dependencies=[Depends(get_current_user)])


class MetadataSearchResult(BaseModel):
    title: str = ""
    author: str = ""
    description: str = ""
    publisher: str = ""
    language: str = ""
    isbn: str = ""
    tags: str = ""
    cover_url: str = ""
    source: str = ""


class ApplyMetadataRequest(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    publisher: Optional[str] = None
    language: Optional[str] = None
    isbn: Optional[str] = None
    tags: Optional[str] = None
    cover_url: Optional[str] = None


@router.get("/search", response_model=list[MetadataSearchResult])
async def search_metadata(q: str):
    """Search Google Books and OpenLibrary for a query string."""
    if not q:
        raise HTTPException(400, "Query required")
    results = await search_all(q, getattr(settings, "google_books_api_key", ""))
    return [MetadataSearchResult(**r.to_dict()) for r in results]


async def _download_cover(book_id: int, cover_url: str, old_cover_path: str | None):
    """Background task: fetch a remote cover and persist it to the book record."""
    import uuid
    from app.models.database import AsyncSessionLocal
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
            resp = await client.get(cover_url)
            resp.raise_for_status()
        cover_id = uuid.uuid4().hex
        cover_file = settings.upload_dir / f"{cover_id}_cover.jpg"
        cover_file.write_bytes(resp.content)
        new_path = f"/api/books/cover/{cover_id}_cover.jpg"
        async with AsyncSessionLocal() as db:
            await db.execute(update(Book).where(Book.id == book_id).values(cover_path=new_path))
            await db.commit()
        # Remove old cover after the new one is saved
        if old_cover_path and old_cover_path.startswith("/api/books/cover/"):
            old = settings.upload_dir / old_cover_path.split("/")[-1]
            if old.exists():
                old.unlink()
    except Exception:
        pass  # Cover download failure is non-fatal


@router.post("/{book_id}/apply", status_code=204)
async def apply_metadata(
    book_id: int,
    data: ApplyMetadataRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Apply metadata to a book; cover download runs as a background task."""
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")

    for field in ["title", "author", "description", "publisher", "language", "isbn", "tags"]:
        val = getattr(data, field)
        if val is not None:
            setattr(book, field, val)

    await db.commit()

    # Kick off cover download after the 204 is returned
    if data.cover_url:
        background_tasks.add_task(_download_cover, book_id, data.cover_url, book.cover_path)
