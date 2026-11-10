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
                 ghost: bool = False, auth_version: int = 0) -> str:
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
        "ver": auth_version,
        "pwd": password_fingerprint(password_hash),
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(days=ttl)).timestamp()),
    }
    if ghost:
        payload["gho"] = True
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_reset_token(user_id: int, password_hash: str, email: str = "", auth_version: int = 0) -> str:
    """Ссылка на сброс пароля. В подпись входит хеш текущего пароля, поэтому ссылка гаснет
    сама, как только пароль сменили: второй раз ей не воспользоваться."""
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": "reset",
        "email": email, "ver": auth_version,
        "pwd": hashlib.sha256(password_hash.encode()).hexdigest()[:16],
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(hours=settings.reset_ttl_hours)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_reset_token(token: str) -> tuple[int, str, str, int] | None:
    """Возвращает id пользователя и отпечаток пароля, под который выдана ссылка."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "reset":
            return None
        return int(payload["sub"]), str(payload["pwd"]), str(payload["email"]), int(payload["ver"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None


def password_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def read_token(token: str) -> tuple[int, str, bool, int] | None:
    """Возвращает id пользователя, отпечаток пароля и признак чужой сессии админа. Пропуска для
    сброса и печати сессией не считаются: у них свой typ."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "session":
            return None
        return int(payload["sub"]), str(payload["pwd"]), bool(payload.get("gho")), int(payload.get("ver", 0))
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None


def create_restore_token(user_id: int, password_hash: str, auth_version: int) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    return jwt.encode({"typ": "restore", "sub": str(user_id), "ver": auth_version,
                       "pwd": password_fingerprint(password_hash), "iat": int(now.timestamp()),
                       "exp": int((now + dt.timedelta(hours=2)).timestamp())},
                      settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_restore_token(token: str) -> tuple[int, str, int] | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "restore":
            return None
        return int(payload["sub"]), str(payload["pwd"]), int(payload["ver"])
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


def create_print_token(reading_id: int, user_id: int) -> str:
    """Пропуск для печати: браузерный сервис открывает платную страницу без куки владельца.
    Живёт минуту и годится только на чтение одного разбора, поэтому утечка ничего не открывает."""
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": str(user_id),
        "typ": "print",
        "rid": int(reading_id),
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(seconds=settings.print_token_ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_print_token(token: str) -> tuple[int, int] | None:
    """Возвращает id пользователя и id разбора, на которые выдан пропуск."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "print":
            return None
        return int(payload["sub"]), int(payload["rid"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None


# A share link opens one reading to anyone holding it, with no expiry; it never signs anyone in.
def create_share_token(kind: str, row_id: int, user_id: int) -> str:
    return jwt.encode({"typ": "share", "k": kind, "rid": int(row_id), "sub": str(user_id)},
                      settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_share_token(token: str) -> tuple[str, int, int] | None:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if claims.get("typ") != "share" or claims.get("k") not in ("reading", "individual"):
            return None
        return str(claims["k"]), int(claims["rid"]), int(claims["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None


def create_worker_token() -> str:
    """Токен для подготовки индивидуальных статей через /internal/individual-readings."""
    now = dt.datetime.now(dt.timezone.utc)
    payload = {"sub": "worker", "typ": "worker", "iat": int(now.timestamp()),
               "exp": int((now + dt.timedelta(days=settings.worker_token_ttl_days)).timestamp())}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_worker_token(token: str | None) -> bool:
    try:
        return bool(token) and jwt.decode(token, settings.jwt_secret,
                                          algorithms=[settings.jwt_algorithm]).get("typ") == "worker"
    except jwt.PyJWTError:
        return False



def create_operation_token(operation_id: int, user_id: int, purpose: str, expires_at: dt.datetime) -> str:
    return jwt.encode({"typ": "account_operation", "oid": operation_id, "sub": str(user_id),
                       "purpose": purpose, "exp": int(expires_at.timestamp())},
                      settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_operation_token(token: str) -> tuple[int, int, str] | None:
    try:
        p = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if p.get("typ") != "account_operation":
            return None
        return int(p["oid"]), int(p["sub"]), str(p["purpose"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None


INDIVIDUAL_LINK_TTL = dt.timedelta(days=30)


def create_individual_token(typ: str, row_id: int, user_id: int, ttl: dt.timedelta) -> str:
    """Пропуск к одной индивидуальной статье: `individual_reading` — ссылка из письма,
    `individual_print` — печать PDF. Ни входа в аккаунт, ни доступа к другим статьям не даёт."""
    now = dt.datetime.now(dt.timezone.utc)
    return jwt.encode({"typ": typ, "rid": row_id, "sub": str(user_id), "exp": int((now + ttl).timestamp())},
                      settings.jwt_secret, algorithm=settings.jwt_algorithm)


def read_individual_token(token: str, typ: str) -> tuple[int, int] | None:
    """Возвращает id статьи и id владельца, на которые выдан пропуск этого типа."""
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if claims.get("typ") != typ:
            return None
        return int(claims["rid"]), int(claims["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        return None
