import shutil
import uuid
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_
from pydantic import BaseModel

from app.models.database import Book, get_db
from app.services.metadata import extract_metadata
from app.config import settings

router = APIRouter(prefix="/api/books", tags=["books"])

ALLOWED_FORMATS = {".epub", ".pdf", ".mobi", ".azw", ".azw3", ".fb2", ".cbz", ".cbr"}


class BookResponse(BaseModel):
    id: int
    title: str
    author: str
    description: str
    publisher: str
    language: str
    isbn: str
    tags: str
    cover_path: str
    file_format: str
    file_size: int
    added_at: str

    class Config:
        from_attributes = True


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    publisher: Optional[str] = None
    language: Optional[str] = None
    isbn: Optional[str] = None
    tags: Optional[str] = None


@router.get("", response_model=list[BookResponse])
async def list_books(
    q: Optional[str] = None,
    format: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Book).order_by(Book.added_at.desc())
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Book.title.ilike(pattern),
                Book.author.ilike(pattern),
                Book.tags.ilike(pattern),
            )
        )
    if format:
        stmt = stmt.where(Book.file_format == format.lower())
    result = await db.execute(stmt)
    books = result.scalars().all()
    return [_to_response(b) for b in books]


@router.post("", response_model=BookResponse, status_code=201)
async def upload_book(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_FORMATS:
        raise HTTPException(400, f"Format {suffix} not supported. Allowed: {', '.join(ALLOWED_FORMATS)}")

    book_id = uuid.uuid4().hex
    dest_path = settings.upload_dir / f"{book_id}{suffix}"

    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = dest_path.stat().st_size
    meta, cover_data = extract_metadata(dest_path)

    cover_path = ""
    if cover_data:
        cover_file = settings.upload_dir / f"{book_id}_cover.jpg"
        cover_file.write_bytes(cover_data)
        cover_path = f"/api/books/cover/{book_id}_cover.jpg"

    book = Book(
        title=meta["title"],
        author=meta["author"],
        description=meta["description"],
        publisher=meta["publisher"],
        language=meta["language"],
        isbn=meta["isbn"],
        tags=meta["tags"],
        cover_path=cover_path,
        file_path=str(dest_path),
        file_format=suffix.lstrip("."),
        file_size=file_size,
    )
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return _to_response(book)


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: int, db: AsyncSession = Depends(get_db)):
    book = await _get_or_404(book_id, db)
    return _to_response(book)


@router.patch("/{book_id}", response_model=BookResponse)
async def update_book(book_id: int, data: BookUpdate, db: AsyncSession = Depends(get_db)):
    book = await _get_or_404(book_id, db)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(book, field, value)
    await db.commit()
    await db.refresh(book)
    return _to_response(book)


@router.delete("/{book_id}", status_code=204)
async def delete_book(book_id: int, db: AsyncSession = Depends(get_db)):
    book = await _get_or_404(book_id, db)
    # Remove files
    for p in [book.file_path, book.cover_path]:
        if p and not p.startswith("/api"):
            path = Path(p)
            if path.exists():
                path.unlink()
    # Remove cover file
    if book.cover_path and book.cover_path.startswith("/api/books/cover/"):
        fname = book.cover_path.split("/")[-1]
        cover_file = settings.upload_dir / fname
        if cover_file.exists():
            cover_file.unlink()
    file_path = Path(book.file_path)
    if file_path.exists():
        file_path.unlink()

    await db.execute(delete(Book).where(Book.id == book_id))
    await db.commit()


@router.get("/{book_id}/download")
async def download_book(book_id: int, db: AsyncSession = Depends(get_db)):
    book = await _get_or_404(book_id, db)
    file_path = Path(book.file_path)
    if not file_path.exists():
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        path=str(file_path),
        filename=f"{book.title}.{book.file_format}",
        media_type="application/octet-stream",
    )


@router.get("/{book_id}/raw")
async def serve_raw(book_id: int, db: AsyncSession = Depends(get_db)):
    """Serve the raw ebook file with appropriate MIME type (used by in-browser reader)."""
    book = await _get_or_404(book_id, db)
    file_path = Path(book.file_path)
    if not file_path.exists():
        raise HTTPException(404, "File not found on disk")
    mime_map = {
        "epub": "application/epub+zip",
        "pdf": "application/pdf",
        "cbz": "application/x-cbz",
    }
    media_type = mime_map.get(book.file_format, "application/octet-stream")
    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={"Content-Disposition": "inline"},
    )


@router.get("/cover/{filename}")
async def get_cover(filename: str):
    cover_path = settings.upload_dir / filename
    if not cover_path.exists():
        raise HTTPException(404, "Cover not found")
    return FileResponse(str(cover_path), media_type="image/jpeg")


async def _get_or_404(book_id: int, db: AsyncSession) -> Book:
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")
    return book


def _to_response(book: Book) -> BookResponse:
    return BookResponse(
        id=book.id,
        title=book.title,
        author=book.author,
        description=book.description or "",
        publisher=book.publisher or "",
        language=book.language or "",
        isbn=book.isbn or "",
        tags=book.tags or "",
        cover_path=book.cover_path or "",
        file_format=book.file_format,
        file_size=book.file_size,
        added_at=book.added_at.isoformat() if book.added_at else "",
    )
