"""
Read an existing Calibre library (metadata.db) and import books into BookShelf.

Calibre stores books at: <library_path>/<Author>/<Title> (<id>)/<Title>.<format>
"""
import shutil
import uuid
from pathlib import Path
from typing import AsyncGenerator

import aiosqlite


async def iter_calibre_books(calibre_library_path: str) -> AsyncGenerator[dict, None]:
    """
    Yield one dict per book from a Calibre metadata.db.
    Each dict contains all metadata plus resolved file paths and cover path.
    """
    library = Path(calibre_library_path)
    db_path = library / "metadata.db"
    if not db_path.exists():
        raise FileNotFoundError(f"No metadata.db found at {db_path}")

    async with aiosqlite.connect(str(db_path)) as db:
        db.row_factory = aiosqlite.Row

        # Fetch all books with their core fields
        async with db.execute(
            "SELECT id, title, author_sort, pubdate, uuid, has_cover, path FROM books"
        ) as cur:
            rows = await cur.fetchall()

        for row in rows:
            book_id = row["id"]
            book_path = library / row["path"]

            # Authors
            async with db.execute(
                """SELECT a.name FROM authors a
                   JOIN books_authors_link l ON l.author = a.id
                   WHERE l.book = ?""",
                (book_id,),
            ) as cur:
                authors = [r[0] for r in await cur.fetchall()]

            # Tags
            async with db.execute(
                """SELECT t.name FROM tags t
                   JOIN books_tags_link l ON l.tag = t.id
                   WHERE l.book = ?""",
                (book_id,),
            ) as cur:
                tags = [r[0] for r in await cur.fetchall()]

            # Series
            async with db.execute(
                """SELECT s.name FROM series s
                   JOIN books_series_link l ON l.series = s.id
                   WHERE l.book = ?""",
                (book_id,),
            ) as cur:
                series_row = await cur.fetchone()
                series = series_row[0] if series_row else ""

            # Publisher
            async with db.execute(
                """SELECT p.name FROM publishers p
                   JOIN books_publishers_link l ON l.publisher = p.id
                   WHERE l.book = ?""",
                (book_id,),
            ) as cur:
                pub_row = await cur.fetchone()
                publisher = pub_row[0] if pub_row else ""

            # Language
            async with db.execute(
                """SELECT lang_code FROM languages
                   JOIN books_languages_link l ON l.lang_code = languages.id
                   WHERE l.book = ?""",
                (book_id,),
            ) as cur:
                lang_row = await cur.fetchone()
                language = lang_row[0] if lang_row else ""

            # Identifiers (ISBN etc.)
            async with db.execute(
                "SELECT type, val FROM identifiers WHERE book = ?", (book_id,)
            ) as cur:
                identifiers = {r[0]: r[1] for r in await cur.fetchall()}

            isbn = identifiers.get("isbn", "")

            # Description / comment
            async with db.execute(
                "SELECT text FROM comments WHERE book = ?", (book_id,)
            ) as cur:
                comment_row = await cur.fetchone()
                description = comment_row[0] if comment_row else ""

            # File formats
            async with db.execute(
                "SELECT format, name FROM data WHERE book = ?", (book_id,)
            ) as cur:
                formats = await cur.fetchall()

            # Cover
            cover_path = ""
            if row["has_cover"]:
                calibre_cover = book_path / "cover.jpg"
                if calibre_cover.exists():
                    cover_path = str(calibre_cover)

            # Build one entry per file format
            for fmt_row in formats:
                fmt = fmt_row["format"].lower()
                filename = fmt_row["name"]
                file_path = book_path / f"{filename}.{fmt}"

                if not file_path.exists():
                    continue

                yield {
                    "title": row["title"],
                    "author": ", ".join(authors) if authors else "Unknown",
                    "description": description or "",
                    "publisher": publisher,
                    "language": language,
                    "isbn": isbn,
                    "tags": ", ".join(tags + ([series] if series else [])),
                    "cover_path_src": cover_path,
                    "file_path_src": str(file_path),
                    "file_format": fmt,
                    "file_size": file_path.stat().st_size,
                }


async def import_calibre_library(
    calibre_library_path: str,
    upload_dir: Path,
    db_session,
) -> dict:
    """
    Import all books from a Calibre library into BookShelf.
    Returns a summary: {imported, skipped, errors}.
    """
    from sqlalchemy import select
    from app.models.database import Book

    imported = 0
    skipped = 0
    errors = 0

    async for book_data in iter_calibre_books(calibre_library_path):
        try:
            # Skip if same file path already exists
            result = await db_session.execute(
                select(Book).where(Book.file_path == book_data["file_path_src"])
            )
            if result.scalar_one_or_none():
                skipped += 1
                continue

            # Copy file into upload_dir
            book_id = uuid.uuid4().hex
            src = Path(book_data["file_path_src"])
            dest = upload_dir / f"{book_id}.{book_data['file_format']}"
            shutil.copy2(src, dest)

            # Copy cover if available
            cover_path = ""
            if book_data["cover_path_src"]:
                cover_src = Path(book_data["cover_path_src"])
                if cover_src.exists():
                    cover_dest = upload_dir / f"{book_id}_cover.jpg"
                    shutil.copy2(cover_src, cover_dest)
                    cover_path = f"/api/books/cover/{book_id}_cover.jpg"

            book = Book(
                title=book_data["title"],
                author=book_data["author"],
                description=book_data["description"],
                publisher=book_data["publisher"],
                language=book_data["language"],
                isbn=book_data["isbn"],
                tags=book_data["tags"],
                cover_path=cover_path,
                file_path=str(dest),
                file_format=book_data["file_format"],
                file_size=book_data["file_size"],
            )
            db_session.add(book)
            imported += 1

        except Exception:
            errors += 1

    await db_session.commit()
    return {"imported": imported, "skipped": skipped, "errors": errors}
