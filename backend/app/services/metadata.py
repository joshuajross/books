"""Extract metadata and covers from ebook files."""
import re
import struct
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


def extract_mobi_metadata(file_path: Path) -> tuple[dict, Optional[bytes]]:
    """Extract metadata from MOBI/AZW/AZW3 files by parsing PalmDB and EXTH headers."""
    meta = {
        "title": file_path.stem,
        "author": "",
        "description": "",
        "publisher": "",
        "language": "",
        "isbn": "",
        "tags": "",
    }
    cover_data = None

    try:
        data = file_path.read_bytes()

        # PalmDB: number of records at offset 76
        num_records = struct.unpack_from(">H", data, 76)[0]
        if num_records < 1:
            return meta, None

        # Build record offset table (each entry: 4-byte offset + 4-byte uid)
        record_offsets = []
        for i in range(num_records):
            off = struct.unpack_from(">I", data, 78 + i * 8)[0]
            record_offsets.append(off)

        def record_data(idx: int) -> bytes:
            start = record_offsets[idx]
            end = record_offsets[idx + 1] if idx + 1 < len(record_offsets) else len(data)
            return data[start:end]

        rec0 = record_data(0)

        # MOBI header begins at offset 16 in record 0 (after PalmDOC header)
        MOBI_OFF = 16
        if rec0[MOBI_OFF:MOBI_OFF + 4] != b"MOBI":
            return meta, None

        mobi_len = struct.unpack_from(">I", rec0, MOBI_OFF + 4)[0]

        # Title stored inside record 0
        title_off = struct.unpack_from(">I", rec0, MOBI_OFF + 84)[0]
        title_len = struct.unpack_from(">I", rec0, MOBI_OFF + 88)[0]
        if title_off and title_len:
            raw = rec0[title_off:title_off + title_len]
            t = raw.decode("utf-8", errors="replace").strip()
            if t:
                meta["title"] = t

        # First image record index (for cover extraction)
        first_image_rec = struct.unpack_from(">I", rec0, MOBI_OFF + 108)[0]

        # EXTH present if bit 6 of flags is set
        exth_flags = struct.unpack_from(">I", rec0, MOBI_OFF + 128)[0]
        cover_offset_exth = None

        if exth_flags & 0x40:
            exth_start = MOBI_OFF + mobi_len
            if rec0[exth_start:exth_start + 4] == b"EXTH":
                num_exth = struct.unpack_from(">I", rec0, exth_start + 8)[0]
                pos = exth_start + 12
                authors = []
                tags = []
                for _ in range(num_exth):
                    if pos + 8 > len(rec0):
                        break
                    rtype = struct.unpack_from(">I", rec0, pos)[0]
                    rlen = struct.unpack_from(">I", rec0, pos + 4)[0]
                    if rlen < 8 or pos + rlen > len(rec0):
                        break
                    rval_bytes = rec0[pos + 8:pos + rlen]
                    pos += rlen

                    # String records
                    if rtype in (100, 101, 103, 104, 105, 503, 524):
                        val = rval_bytes.decode("utf-8", errors="replace").strip()
                        if rtype == 100:
                            authors.append(val)
                        elif rtype == 101:
                            meta["publisher"] = val
                        elif rtype == 103:
                            meta["description"] = val
                        elif rtype == 104:
                            m = re.search(r"\d{10,13}", val)
                            if m:
                                meta["isbn"] = m.group()
                        elif rtype == 105:
                            tags.append(val)
                        elif rtype == 503:
                            meta["title"] = val  # higher-priority title
                        elif rtype == 524:
                            meta["language"] = val
                    # Cover offset (uint32)
                    elif rtype == 201 and len(rval_bytes) == 4:
                        cover_offset_exth = struct.unpack_from(">I", rval_bytes)[0]

                if authors:
                    meta["author"] = ", ".join(authors)
                if tags:
                    meta["tags"] = ", ".join(tags)

        # Extract cover image
        if (
            cover_offset_exth is not None
            and cover_offset_exth != 0xFFFFFFFF
            and first_image_rec != 0xFFFFFFFF
        ):
            cover_rec_idx = first_image_rec + cover_offset_exth
            if cover_rec_idx < num_records:
                cover_data = record_data(cover_rec_idx)
                # Sanity check: must look like JPEG or PNG
                if not (cover_data[:2] == b"\xff\xd8" or cover_data[:4] == b"\x89PNG"):
                    cover_data = None

    except Exception:
        pass

    return meta, cover_data


def extract_metadata(file_path: Path) -> tuple[dict, Optional[bytes]]:
    suffix = file_path.suffix.lower()
    if suffix == ".epub":
        return extract_epub_metadata(file_path)
    elif suffix == ".pdf":
        return extract_pdf_metadata(file_path)
    elif suffix in (".mobi", ".azw", ".azw3"):
        return extract_mobi_metadata(file_path)
    else:
        return {
            "title": file_path.stem,
            "author": "",
            "description": "",
            "publisher": "",
            "language": "",
            "isbn": "",
            "tags": "",
        }, None
