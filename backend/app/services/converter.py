"""
Ebook format conversion using Calibre's ebook-convert CLI.
Calibre must be installed and ebook-convert must be on PATH.
"""
import asyncio
import shutil
from pathlib import Path


def calibre_available() -> bool:
    return shutil.which("ebook-convert") is not None


CONVERSION_MATRIX = {
    # source_format: [supported output formats]
    "epub": ["pdf", "mobi", "azw3", "fb2", "txt", "html"],
    "pdf":  ["epub", "txt"],
    "mobi": ["epub", "pdf", "azw3"],
    "azw":  ["epub", "pdf", "mobi"],
    "azw3": ["epub", "pdf", "mobi"],
    "fb2":  ["epub", "pdf", "mobi"],
    "cbz":  ["pdf"],
    "cbr":  ["pdf"],
    "html": ["epub", "pdf", "mobi"],
    "txt":  ["epub", "pdf"],
    "rtf":  ["epub", "pdf", "mobi"],
    "docx": ["epub", "pdf", "mobi"],
}


async def convert_book(
    src_path: Path,
    target_format: str,
    output_dir: Path,
) -> Path:
    """
    Convert src_path to target_format using ebook-convert.
    Returns the path to the converted file.
    Raises RuntimeError if conversion fails.
    """
    if not calibre_available():
        raise RuntimeError(
            "Calibre's ebook-convert is not installed. "
            "Install Calibre to enable format conversion."
        )

    src_fmt = src_path.suffix.lstrip(".").lower()
    if target_format not in CONVERSION_MATRIX.get(src_fmt, []):
        raise ValueError(
            f"Cannot convert {src_fmt.upper()} → {target_format.upper()}. "
            f"Supported: {', '.join(CONVERSION_MATRIX.get(src_fmt, []))}"
        )

    stem = src_path.stem
    out_path = output_dir / f"{stem}_converted.{target_format}"

    proc = await asyncio.create_subprocess_exec(
        "ebook-convert",
        str(src_path),
        str(out_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        raise RuntimeError(f"Conversion failed: {stderr.decode()[:500]}")

    return out_path
