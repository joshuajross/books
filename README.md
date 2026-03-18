# BookShelf

A simple, clean personal ebook library with web uploads and email-to-eReader support. Inspired by Calibre but lightweight and self-hosted.

## Features

- **Library view** — Browse, search, and filter your books by title, author, tag, or format
- **Web upload** — Drag & drop EPUB, PDF, MOBI, AZW3, FB2, CBZ files; metadata and covers extracted automatically
- **Edit metadata** — Update title, author, description, tags, publisher, language, ISBN
- **Download** — Grab any file directly from your browser
- **Send to eReader** — Email books directly to your Kindle (`@kindle.com`) or Kobo address
- **Docker ready** — Single container, persistent volume for data

## Quick start

```bash
# 1. Clone
git clone <repo> bookshelf && cd bookshelf

# 2. Configure (optional — only needed for email-to-eReader)
cp .env.example .env
# Edit .env with your SMTP credentials

# 3. Run
docker compose up -d

# 4. Open
open http://localhost:8000
```

## Email to Kindle / Kobo

To send books to your Kindle:
1. Add your server's sender email to your [Approved Personal Document E-mail List](https://www.amazon.com/manageyourkindle) in Amazon settings
2. Set `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` in your `.env`
3. On the book detail page, click **Send to eReader** and enter `yourname@kindle.com`

For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # proxies /api to localhost:8000
```

## Supported formats

EPUB · PDF · MOBI · AZW · AZW3 · FB2 · CBZ · CBR
