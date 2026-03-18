"""Extract metadata and covers from ebook files."""
import re
import zipfile
import io
from pathlib import Path
from typing import Optional


def extract_epub_metadata(file_path: Path) -> dict:
    """Extract metadata from EPUB files using zipfile directly."""
    meta = {
        "title": file_path.stem,
        "author": "Unknown",
        "description": "",
        "publisher": "",
        "language": "",
        "isbn": "",
        "tags": "",
    }
    cover_data = None

    try:
        with zipfile.ZipFile(file_path, "r") as z:
            # Find OPF file
            container_path = None
            try:
                with z.open("META-INF/container.xml") as f:
                    content = f.read().decode("utf-8", errors="ignore")
                    m = re.search(r'full-path="([^"]+\.opf)"', content)
                    if m:
                        container_path = m.group(1)
            except KeyError:
                pass

            if container_path:
                try:
                    with z.open(container_path) as f:
                        opf = f.read().decode("utf-8", errors="ignore")

                    def get_tag(tag):
                        m = re.search(rf"<(?:dc:)?{tag}[^>]*>([^<]+)</(?:dc:)?{tag}>", opf, re.IGNORECASE)
                        return m.group(1).strip() if m else ""

                    title = get_tag("title")
                    author = get_tag("creator")
                    description = get_tag("description")
                    publisher = get_tag("publisher")
                    language = get_tag("language")
                    isbn = get_tag("identifier")

                    if title:
                        meta["title"] = title
                    if author:
                        meta["author"] = author
                    if description:
                        meta["description"] = re.sub(r"<[^>]+>", "", description)
                    if publisher:
                        meta["publisher"] = publisher
                    if language:
                        meta["language"] = language
                    if isbn and re.search(r"\d{10,13}", isbn):
                        meta["isbn"] = re.search(r"\d{10,13}", isbn).group()

                    # Find cover image
                    cover_id = None
                    m = re.search(r'<meta[^>]+name="cover"[^>]+content="([^"]+)"', opf, re.IGNORECASE)
                    if m:
                        cover_id = m.group(1)

                    # Find cover href from manifest
                    if cover_id:
                        m = re.search(rf'<item[^>]+id="{re.escape(cover_id)}"[^>]+href="([^"]+)"', opf)
                    else:
                        m = re.search(r'<item[^>]+media-type="image/(?:jpeg|png|gif)"[^>]+href="([^"]+)"', opf)

                    if m:
                        cover_href = m.group(1)
                        opf_dir = str(Path(container_path).parent)
                        cover_zip_path = f"{opf_dir}/{cover_href}".lstrip("/")
                        try:
                            cover_data = z.read(cover_zip_path)
                        except KeyError:
                            try:
                                cover_data = z.read(cover_href)
                            except KeyError:
                                pass
                except KeyError:
                    pass
    except Exception:
        pass

    return meta, cover_data


def extract_pdf_metadata(file_path: Path) -> tuple[dict, Optional[bytes]]:
    """Extract metadata from PDF files."""
    meta = {
        "title": file_path.stem,
        "author": "Unknown",
        "description": "",
        "publisher": "",
        "language": "",
        "isbn": "",
        "tags": "",
    }
    cover_data = None

    try:
        import fitz  # PyMuPDF
        doc = fitz.open(str(file_path))

        pdf_meta = doc.metadata
        if pdf_meta.get("title"):
            meta["title"] = pdf_meta["title"]
        if pdf_meta.get("author"):
            meta["author"] = pdf_meta["author"]
        if pdf_meta.get("subject"):
            meta["description"] = pdf_meta["subject"]
        if pdf_meta.get("producer"):
            meta["publisher"] = pdf_meta["producer"]

        # Extract first page as cover
        if len(doc) > 0:
            page = doc[0]
            pix = page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
            cover_data = pix.tobytes("jpeg")

        doc.close()
    except Exception:
        pass

    return meta, cover_data


def extract_metadata(file_path: Path) -> tuple[dict, Optional[bytes]]:
    suffix = file_path.suffix.lower()
    if suffix == ".epub":
        return extract_epub_metadata(file_path)
    elif suffix == ".pdf":
        return extract_pdf_metadata(file_path)
    else:
        return {
            "title": file_path.stem,
            "author": "Unknown",
            "description": "",
            "publisher": "",
            "language": "",
            "isbn": "",
            "tags": "",
        }, None
