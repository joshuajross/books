"""
External metadata providers: Google Books and OpenLibrary.
Used to auto-fill or enrich book metadata during upload or on demand.
"""
import re
from typing import Optional
import httpx


class MetadataResult:
    def __init__(self, **kwargs):
        self.title: str = kwargs.get("title", "")
        self.author: str = kwargs.get("author", "")
        self.description: str = kwargs.get("description", "")
        self.publisher: str = kwargs.get("publisher", "")
        self.language: str = kwargs.get("language", "")
        self.isbn: str = kwargs.get("isbn", "")
        self.tags: str = kwargs.get("tags", "")
        self.cover_url: str = kwargs.get("cover_url", "")
        self.source: str = kwargs.get("source", "")

    def to_dict(self):
        return {k: v for k, v in self.__dict__.items() if v}


def _extract_isbn(query: str) -> str | None:
    """Return bare ISBN digits if query is 'isbn:XXXXX', else None."""
    m = re.match(r"^isbn:(\d{10,13})$", query.strip(), re.IGNORECASE)
    return m.group(1) if m else None


async def search_google_books(query: str, api_key: str = "") -> list[MetadataResult]:
    """Search Google Books API. Uses isbn: prefix for ISBN lookups."""
    isbn = _extract_isbn(query)
    q = f"isbn:{isbn}" if isbn else "+".join(query.split())
    url = f"https://www.googleapis.com/books/v1/volumes?q={q}&maxResults=5"
    if api_key:
        url += f"&key={api_key}"

    results = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        for item in data.get("items", []):
            info = item.get("volumeInfo", {})

            isbn_val = ""
            for idf in info.get("industryIdentifiers", []):
                if idf.get("type") == "ISBN_13":
                    isbn_val = idf.get("identifier", "")
                    break
            if not isbn_val:
                for idf in info.get("industryIdentifiers", []):
                    if idf.get("type") == "ISBN_10":
                        isbn_val = idf.get("identifier", "")
                        break

            cover_url = ""
            image_links = info.get("imageLinks", {})
            if image_links:
                cover_url = image_links.get("thumbnail", image_links.get("smallThumbnail", ""))
                cover_url = re.sub(r"zoom=\d", "zoom=2", cover_url)
                cover_url = cover_url.replace("http://", "https://")

            results.append(MetadataResult(
                title=info.get("title", ""),
                author=", ".join(info.get("authors", [])),
                description=re.sub(r"<[^>]+>", "", info.get("description", "")),
                publisher=info.get("publisher", ""),
                language=info.get("language", ""),
                isbn=isbn_val,
                tags=", ".join(info.get("categories", [])),
                cover_url=cover_url,
                source="google",
            ))
    except Exception:
        pass

    return results


async def _openlibrary_by_isbn(isbn: str) -> list[MetadataResult]:
    """Exact ISBN lookup via OpenLibrary Books API."""
    url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&jscmd=data&format=json"
    results = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        book = data.get(f"ISBN:{isbn}")
        if not book:
            return results

        # Prefer ISBN-13 from identifiers if available
        isbn_val = isbn
        for val in book.get("identifiers", {}).get("isbn_13", []):
            if str(val).isdigit() and len(str(val)) == 13:
                isbn_val = str(val)
                break

        covers = book.get("cover", {})
        cover_url = covers.get("large") or covers.get("medium") or covers.get("small", "")

        desc = book.get("description", "")
        if isinstance(desc, dict):
            desc = desc.get("value", "")

        publishers = book.get("publishers", [])
        publisher = publishers[0].get("name", "") if publishers else ""

        subjects = [s.get("name", "") for s in book.get("subjects", [])[:5]]

        results.append(MetadataResult(
            title=book.get("title", ""),
            author=", ".join(a.get("name", "") for a in book.get("authors", [])),
            description=str(desc),
            publisher=publisher,
            isbn=isbn_val,
            tags=", ".join(subjects),
            cover_url=cover_url,
            source="openlibrary",
        ))
    except Exception:
        pass
    return results


async def search_openlibrary(query: str) -> list[MetadataResult]:
    """Search OpenLibrary. Uses exact Books API for ISBN queries."""
    isbn = _extract_isbn(query)
    if isbn:
        return await _openlibrary_by_isbn(isbn)

    url = (
        f"https://openlibrary.org/search.json?q={query}&limit=5"
        f"&fields=title,author_name,isbn,publisher,language,subject,cover_i,first_sentence"
    )
    results = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        for doc in data.get("docs", []):
            isbn_val = ""
            isbns = doc.get("isbn", [])
            for i in isbns:
                if len(i) == 13:
                    isbn_val = i
                    break
            if not isbn_val and isbns:
                isbn_val = isbns[0]

            cover_url = ""
            cover_id = doc.get("cover_i")
            if cover_id:
                cover_url = f"https://covers.openlibrary.org/b/id/{cover_id}-L.jpg"

            description = ""
            first_sentence = doc.get("first_sentence")
            if isinstance(first_sentence, dict):
                description = first_sentence.get("value", "")
            elif isinstance(first_sentence, list) and first_sentence:
                description = first_sentence[0]

            lang_codes = doc.get("language", [])

            results.append(MetadataResult(
                title=doc.get("title", ""),
                author=", ".join(doc.get("author_name", [])),
                description=description,
                publisher=", ".join(doc.get("publisher", [])[:1]),
                language=lang_codes[0] if lang_codes else "",
                isbn=isbn_val,
                tags=", ".join(doc.get("subject", [])[:5]),
                cover_url=cover_url,
                source="openlibrary",
            ))
    except Exception:
        pass

    return results


async def search_all(query: str, google_api_key: str = "") -> list[MetadataResult]:
    """Search both providers and merge results (Google Books first)."""
    import asyncio
    google, ol = await asyncio.gather(
        search_google_books(query, google_api_key),
        search_openlibrary(query),
    )
    return google + ol
