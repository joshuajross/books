from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from app.models.database import Book, get_db
from app.services.email_sender import send_book_to_reader
from app.config import settings
from .auth import get_current_user

router = APIRouter(prefix="/api/send", tags=["send"], dependencies=[Depends(get_current_user)])


class SendRequest(BaseModel):
    reader_email: EmailStr


@router.post("/{book_id}", status_code=204)
async def send_book(
    book_id: int,
    body: SendRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Book not found")

    file_path = Path(book.file_path)
    if not file_path.exists():
        raise HTTPException(404, "Book file not found on disk")

    if not settings.smtp_user:
        raise HTTPException(503, "Email not configured. Set SMTP_USER and SMTP_PASSWORD in environment.")

    try:
        await send_book_to_reader(file_path, book.title, body.reader_email)
    except Exception as e:
        raise HTTPException(500, f"Failed to send email: {str(e)}")
