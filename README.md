# BookShelf

A simple, clean personal ebook library with web uploads and email-to-eReader support. Inspired by Calibre but lightweight and self-hosted.

## Features

- **Library view** — Browse, search, and filter by title, author, tag, or format
- **Web upload** — Drag & drop EPUB, PDF, MOBI, AZW3, FB2, CBZ; metadata and covers extracted automatically
- **Edit metadata** — Update title, author, description, tags, publisher, language, ISBN inline
- **Fetch metadata** — Search Google Books and OpenLibrary to auto-fill metadata and covers
- **Download** — Grab any file directly from your browser
- **Send to eReader** — Email books to your Kindle (`@kindle.com`) or Kobo address
- **Format conversion** — Convert between EPUB/PDF/MOBI/AZW3/FB2 using Calibre's `ebook-convert` (when installed)
- **Import from Calibre** — Point at an existing Calibre library folder to import your whole collection
- **OPDS catalog** — Browse and download from any OPDS eReader app (KOReader, Moon+ Reader, Panels…)
- **Docker ready** — Single container, persistent volume for data

## Quick start

```bash
# 1. Clone
git clone <repo> bookshelf && cd bookshelf

# 2. Configure (optional — needed for email / metadata API)
cp .env.example .env
# Edit .env with your credentials

# 3. Run
docker compose up -d

# 4. Open
open http://localhost:8000
```

## OPDS

Add `http://yourserver:8000/opds` as a catalog in any OPDS app to browse and download directly from your eReader.

## Import from Calibre

Go to **Settings → Import from Calibre Library** and enter the path to your Calibre folder (the one containing `metadata.db`). Books and covers are copied into BookShelf; your Calibre library is not modified.

## Send to Kindle / Kobo

1. Add your server's sender email to your [Approved Personal Document E-mail List](https://www.amazon.com/manageyourkindle)
2. Set `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` in `.env`
3. On the book detail page, click **Send to eReader** and enter `yourname@kindle.com`

For Gmail use an [App Password](https://support.google.com/accounts/answer/185833).

## Format conversion

Requires [Calibre](https://calibre-ebook.com/download) to be installed on the server with `ebook-convert` on PATH. On the book detail page choose a target format and click **Convert & Download**.

## Fetch metadata

Click **Fetch Metadata** on any book detail page to search Google Books and OpenLibrary. Select a result to auto-fill title, author, description, publisher, language, ISBN, tags, and cover.

For better Google Books results, set `GOOGLE_BOOKS_API_KEY` in `.env`.

## Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # proxies /api → localhost:8000
```

## Supported formats

EPUB · PDF · MOBI · AZW · AZW3 · FB2 · CBZ · CBR
