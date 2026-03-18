"""Send ebooks to eReader email addresses."""
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders
from pathlib import Path
from app.config import settings


async def send_book_to_reader(
    book_path: Path,
    book_title: str,
    reader_email: str,
) -> None:
    """Send an ebook file to a Kindle/Kobo email address."""
    if not settings.smtp_user or not settings.smtp_password:
        raise ValueError("SMTP credentials not configured. Set SMTP_USER and SMTP_PASSWORD.")

    msg = MIMEMultipart()
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = reader_email
    msg["Subject"] = f"convert" if reader_email.endswith("@kindle.com") else book_title

    body = MIMEText(f'Your book "{book_title}" is attached.', "plain")
    msg.attach(body)

    with open(book_path, "rb") as f:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(f.read())
    encoders.encode_base64(part)
    part.add_header(
        "Content-Disposition",
        f'attachment; filename="{book_path.name}"',
    )
    msg.attach(part)

    await aiosmtplib.send(
        msg,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user,
        password=settings.smtp_password,
        start_tls=True,
    )
