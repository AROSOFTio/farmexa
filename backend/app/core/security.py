"""
Security utilities: password hashing, JWT creation and verification,
refresh token management.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib
import secrets

import jwt
from jwt.exceptions import InvalidTokenError as JWTError
import bcrypt

from app.core.config import settings


# ── Password ─────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    pwd_bytes = password.encode('utf-8')
    rounds = 4 if settings.APP_ENV == "development" else 12
    salt = bcrypt.gensalt(rounds=rounds)
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash using bcrypt."""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


# ── Access Token ─────────────────────────────────────────────

def create_access_token(subject: str, extra_claims: dict | None = None) -> str:
    """Create a short-lived JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": subject,
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and verify a JWT access token. Raises JWTError on failure."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM], options={"verify_aud": False})


# ── Refresh Token ─────────────────────────────────────────────

def generate_refresh_token() -> str:
    """Generate a cryptographically secure opaque refresh token."""
    return secrets.token_urlsafe(64)


def hash_refresh_token(token: str) -> str:
    """SHA-256 hash for safe DB storage of refresh tokens."""
    return hashlib.sha256(token.encode()).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)


# ── Password Reset Token ──────────────────────────────────────

def create_password_reset_token(user_id: int, email: str) -> str:
    """Create a JWT password reset token valid for 15 minutes."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=15)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": expire,
        "type": "reset_password",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_password_reset_token(token: str) -> dict:
    """Decode and verify a password reset token. Raises JWTError or ValueError on invalid."""
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != "reset_password":
        raise ValueError("Invalid token type")
    return payload


# ── Email Verification Token ─────────────────────────────────

def create_email_verification_token(user_id: int, email: str) -> str:
    """Create a JWT email verification token valid for 24 hours."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=24)
    payload = {
        "sub": str(user_id),
        "email": email,
        "iat": now,
        "exp": expire,
        "type": "verify_email",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_email_verification_token(token: str) -> dict:
    """Decode and verify an email verification token. Raises JWTError or ValueError on invalid."""
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("type") != "verify_email":
        raise ValueError("Invalid token type")
    return payload

