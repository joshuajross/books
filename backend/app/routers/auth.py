import base64
import hashlib
import hmac
import json
import secrets
import time
from pathlib import Path

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

from ..config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Use env-provided secret if set; otherwise per-process random (tokens expire on restart).
_JWT_SECRET = settings.jwt_secret.encode() if settings.jwt_secret else secrets.token_bytes(32)
_TOKEN_TTL = 30 * 24 * 3600  # 30 days in seconds
_OVERRIDES_FILE = Path("/data/settings.json")


# ── minimal HS256 JWT (no third-party crypto library needed) ──────────────────

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _make_token(username: str) -> str:
    header = _b64(b'{"alg":"HS256","typ":"JWT"}')
    payload = _b64(json.dumps({"sub": username, "exp": int(time.time()) + _TOKEN_TTL}).encode())
    sig = _b64(hmac.new(_JWT_SECRET, f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def _decode_token(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError
        header, payload, sig = parts
        expected = _b64(hmac.new(_JWT_SECRET, f"{header}.{payload}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise ValueError("bad signature")
        data = json.loads(base64.urlsafe_b64decode(payload + "=="))
        if data.get("exp", 0) < time.time():
            raise ValueError("expired")
        return data
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


# ── password helpers ──────────────────────────────────────────────────────────

def _verify_password(plain: str) -> bool:
    """Check plain password. If a hash was saved (via change-password), use it; else compare plain."""
    if settings.admin_password_hash:
        return bcrypt.checkpw(plain.encode(), settings.admin_password_hash.encode())
    return plain == settings.admin_password


# ── FastAPI dependency ────────────────────────────────────────────────────────

async def get_current_user(token: str = Depends(_oauth2)) -> str:
    data = _decode_token(token)
    username = data.get("sub")
    if username != settings.admin_username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return username


# ── endpoints ─────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(body: LoginRequest):
    if body.username != settings.admin_username or not _verify_password(body.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    return {"access_token": _make_token(body.username), "token_type": "bearer"}


@router.get("/me")
async def me(current_user: str = Depends(get_current_user)):
    return {"username": current_user}


@router.post("/change-password", status_code=204)
async def change_password(body: ChangePasswordRequest, _: str = Depends(get_current_user)):
    if not _verify_password(body.current_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must be at least 8 characters")

    new_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()

    # Persist to overrides file
    overrides: dict = {}
    if _OVERRIDES_FILE.exists():
        try:
            overrides = json.loads(_OVERRIDES_FILE.read_text())
        except Exception:
            pass
    overrides["admin_password_hash"] = new_hash
    _OVERRIDES_FILE.write_text(json.dumps(overrides, indent=2))

    # Apply immediately to running settings
    object.__setattr__(settings, "admin_password_hash", new_hash)
