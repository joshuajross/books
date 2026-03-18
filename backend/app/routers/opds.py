"""
OPDS Catalog (Open Publication Distribution System) v1.2
Allows eReader apps (KOReader, Moon+ Reader, Panels, etc.) to browse and download books.

Root feed: GET /opds
"""
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.models.database import Book, get_db

router = APIRouter(prefix="/opds", tags=["opds"])

MIME_MAP = {
    "epub": "application/epub+zip",
    "pdf": "application/pdf",
    "mobi": "application/x-mobipocket-ebook",
    "azw": "application/vnd.amazon.ebook",
    "azw3": "application/vnd.amazon.ebook",
    "fb2": "application/x-fictionbook+xml",
    "cbz": "application/x-cbz",
    "cbr": "application/x-cbr",
}

XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n'


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _base(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def _navigation_feed(request: Request, title: str, feed_id: str, entries: list[str]) -> Response:
    base = _base(request)
    xml = XML_HEADER + f"""<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>{feed_id}</id>
  <title>{title}</title>
  <updated>{_now()}</updated>
  <link rel="self" href="{base}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="{base}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="search" type="application/opensearchdescription+xml" href="{base}/opds/search-description"/>
  {''.join(entries)}
</feed>"""
    return Response(content=xml, media_type="application/atom+xml;profile=opds-catalog;kind=navigation")


def _acquisition_feed(request: Request, title: str, feed_id: str, books: list[Book]) -> Response:
    base = _base(request)
    entries = []
    for book in books:
        cover_tag = ""
        if book.cover_path:
            cover_url = f"{base}{book.cover_path}"
            cover_tag = f'<link rel="http://opds-spec.org/image" href="{cover_url}" type="image/jpeg"/>\n    <link rel="http://opds-spec.org/image/thumbnail" href="{cover_url}" type="image/jpeg"/>'

        mime = MIME_MAP.get(book.file_format, "application/octet-stream")
        dl_url = f"{base}/api/books/{book.id}/download"

        updated = book.added_at.strftime("%Y-%m-%dT%H:%M:%SZ") if book.added_at else _now()
        desc = ""
        if book.description:
            safe = book.description.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            desc = f"<summary>{safe}</summary>"

        entries.append(f"""  <entry>
    <id>urn:bookshelf:book:{book.id}</id>
    <title>{book.title.replace("&","&amp;").replace("<","&lt;")}</title>
    <author><name>{book.author.replace("&","&amp;")}</name></author>
    <updated>{updated}</updated>
    {cover_tag}
    {desc}
    <link rel="http://opds-spec.org/acquisition" href="{dl_url}"
          type="{mime}" title="{book.file_format.upper()}"/>
  </entry>""")

    xml = XML_HEADER + f"""<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:opds="http://opds-spec.org/2010/catalog"
      xmlns:dc="http://purl.org/dc/terms/">
  <id>{feed_id}</id>
  <title>{title}</title>
  <updated>{_now()}</updated>
  <link rel="self" href="{feed_id}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  <link rel="start" href="{base}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="search" type="application/opensearchdescription+xml" href="{base}/opds/search-description"/>
  {''.join(entries)}
</feed>"""
    return Response(content=xml, media_type="application/atom+xml;profile=opds-catalog;kind=acquisition")


@router.get("", include_in_schema=True)
async def opds_root(request: Request):
    """OPDS root navigation feed."""
    base = _base(request)
    now = _now()
    entries = [
        f"""  <entry>
    <id>urn:bookshelf:all</id>
    <title>All Books</title>
    <updated>{now}</updated>
    <content type="text">Browse all books alphabetically</content>
    <link rel="subsection" href="{base}/opds/all"
          type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  </entry>""",
        f"""  <entry>
    <id>urn:bookshelf:new</id>
    <title>New Arrivals</title>
    <updated>{now}</updated>
    <content type="text">Recently added books</content>
    <link rel="subsection" href="{base}/opds/new"
          type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  </entry>""",
        f"""  <entry>
    <id>urn:bookshelf:search</id>
    <title>Search</title>
    <updated>{now}</updated>
    <content type="text">Search the library</content>
    <link rel="search" href="{base}/opds/search?q={{searchTerms}}"
          type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  </entry>""",
    ]
    return _navigation_feed(request, "BookShelf", "urn:bookshelf:root", entries)


@router.get("/all")
async def opds_all(request: Request, db: AsyncSession = Depends(get_db)):
    """All books, alphabetical."""
    result = await db.execute(select(Book).order_by(Book.title))
    books = result.scalars().all()
    return _acquisition_feed(request, "All Books", f"{_base(request)}/opds/all", books)


@router.get("/new")
async def opds_new(request: Request, db: AsyncSession = Depends(get_db)):
    """Recently added books (newest 50)."""
    result = await db.execute(select(Book).order_by(Book.added_at.desc()).limit(50))
    books = result.scalars().all()
    return _acquisition_feed(request, "New Arrivals", f"{_base(request)}/opds/new", books)


@router.get("/search")
async def opds_search(
    request: Request,
    q: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """Full-text search across title and author."""
    stmt = select(Book).order_by(Book.title)
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(Book.title.ilike(pattern), Book.author.ilike(pattern))
        )
    result = await db.execute(stmt)
    books = result.scalars().all()
    return _acquisition_feed(request, f'Search: {q}', f"{_base(request)}/opds/search?q={quote(q)}", books)


@router.get("/search-description")
async def opds_search_description(request: Request):
    """OpenSearch description document."""
    base = _base(request)
    xml = XML_HEADER + f"""<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>BookShelf</ShortName>
  <Description>Search your BookShelf library</Description>
  <Url type="application/atom+xml;profile=opds-catalog" template="{base}/opds/search?q={{searchTerms}}"/>
</OpenSearchDescription>"""
    return Response(content=xml, media_type="application/opensearchdescription+xml")
