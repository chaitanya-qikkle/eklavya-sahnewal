"""
JWT security utilities — token creation and verification.

All token logic lives here so there is a single place to change
the algorithm, expiry, or secret key.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    REFRESH_TOKEN_EXPIRE_DAYS,
)

if not JWT_SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY must be set in environment variables")

_bearer        = HTTPBearer()
_bearer_opt    = HTTPBearer(auto_error=False)


# ── Token creation ────────────────────────────────────────────────────────────

def create_access_token(user_id: str, username: str, plant_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":      str(user_id),
        "username": username,
        "plant_id": plant_id,
        "type":     "access",
        "iat":      now,
        "exp":      now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub":  str(user_id),
        "type": "refresh",
        "iat":  now,
        "exp":  now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


# ── Token verification ────────────────────────────────────────────────────────

def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])


# ── FastAPI dependencies ──────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(_bearer),
) -> dict:
    """
    FastAPI dependency — validates the Bearer token and returns user context.

    Returns:
        { "user_id": str (GUID), "username": str, "plant_id": int }
    """
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id  = payload.get("sub")
        username = payload.get("username")
        plant_id = payload.get("plant_id")
        if not user_id or plant_id is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return {"user_id": user_id, "username": username, "plant_id": plant_id}
    except JWTError:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(_bearer_opt),
) -> Optional[dict]:
    """Same as get_current_user but returns None instead of raising for unauthenticated requests."""
    if not credentials:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None
