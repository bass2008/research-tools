from __future__ import annotations

import datetime as dt
import hashlib
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


def create_token(user_id: int, password_hash: str, ttl_days: int | None = None,
                 ghost: bool = False) -> str:
    """Сессия привязана к текущему паролю: в подписи лежит его отпечаток, поэтому смена пароля
    гасит все ранее выданные токены — на всех устройствах сразу.

    `ghost` помечает сессию админа, вошедшего под чужим аккаунтом: права те же, но следов
    присутствия она не оставляет — «последнее появление» принадлежит человеку, а не админу.
    """
    now = dt.datetime.now(dt.timezone.utc)
    ttl = settings.jwt_ttl_days if ttl_days is None else ttl_days
    payload = {
        "sub": str(user_id),
        "typ": "session",
        "pwd": password_fingerprint(password_hash),
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(days=ttl)).timestamp()),
    }
    if ghost:
        payload["gho"] = True
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_reset_token(user_id: int, password_hash: str) -> str:
    """Ссылка на сброс пароля. В подпись входит хеш текущего пароля, поэтому ссылка гаснет
    сама, как только пароль сменили: второй раз ей не воспользоваться."""
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": "reset",
        "pwd": hashlib.sha256(password_hash.encode()).hexdigest()[:16],
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(hours=settings.reset_ttl_hours)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_reset_token(token: str) -> tuple[int, str] | None:
    """Возвращает id пользователя и отпечаток пароля, под который выдана ссылка."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "reset":
            return None
        return int(payload["sub"]), str(payload["pwd"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None


def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def read_token(token: str) -> tuple[int, str, bool] | None:
    """Возвращает id пользователя, отпечаток пароля и признак чужой сессии админа. Пропуска для
    сброса и печати сессией не считаются: у них свой typ."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "session":
            return None
        return int(payload["sub"]), str(payload["pwd"]), bool(payload.get("gho"))
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None


def create_file_token(key: str, filename: str | None = None) -> str:
    """Пропуск к готовому файлу локального хранилища: замена подписанной ссылке S3. В PDF есть
    дата рождения, поэтому путь не должен открываться без подписи."""
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "typ": "file",
        "key": key,
        "name": filename or "",
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(seconds=settings.report_link_ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_file_token(token: str) -> tuple[str, str] | None:
    """Ключ и имя файла, на которые выдан пропуск."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "file":
            return None
        return str(payload["key"]), str(payload.get("name") or "")
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None


def create_print_token(matrix_id: int, user_id: int) -> str:
    """Пропуск для печати: браузерный сервис открывает платную страницу без куки владельца.
    Живёт минуту и годится только на чтение одной матрицы, поэтому утечка ничего не открывает."""
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": "print",
        "mid": int(matrix_id),
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(seconds=settings.print_token_ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_print_token(token: str) -> tuple[int, int] | None:
    """Возвращает id пользователя и id матрицы, на которые выдан пропуск."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "print":
            return None
        return int(payload["sub"]), int(payload["mid"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None
