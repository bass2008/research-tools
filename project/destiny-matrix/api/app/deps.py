from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import User
from .security import read_token

bearer = HTTPBearer(auto_error=False, description="JWT, срок 30 дней")


def optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    if credentials is None or not credentials.credentials:
        return None
    user_id = read_token(credentials.credentials)
    if user_id is None:
        return None
    return db.get(User, user_id)


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Нужен вход: передайте токен")
    return user
