# ---- Frontend build ----
FROM node:20-alpine AS frontend
WORKDIR /build
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Backend ----
FROM python:3.12-slim AS app
WORKDIR /app

# System deps for PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend /build/../backend/static ./static

RUN mkdir -p /data/uploads

ENV PYTHONPATH=/app
ENV UPLOAD_DIR=/data/uploads
ENV DB_PATH=/data/library.db

EXPOSE 8000
VOLUME ["/data"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
