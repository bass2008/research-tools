from __future__ import annotations

import datetime as dt
import secrets

import jwt
from passlib.context import CryptContext

from .config import settings

# bcrypt_sha256 предварительно хеширует пароль, поэтому нет ни лимита в 72 байта,
# ни молчаливого обрезания; схема bcrypt оставлена для проверки старых хешей
pwd = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return pwd.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return pwd.verify(raw, hashed)
    except ValueError:
        return False


def random_password(length: int = 18) -> str:
    return secrets.token_urlsafe(length)


def create_token(user_id: int, ttl_days: int | None = None) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    ttl = settings.jwt_ttl_days if ttl_days is None else ttl_days
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(days=ttl)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None
