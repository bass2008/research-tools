from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from .. import encyclopedia

router = APIRouter(prefix="/encyclopedia", tags=["encyclopedia"])


@router.get("/index")
def index() -> dict:
    return encyclopedia.index()


@router.get("/arcanum/{n}")
def arcanum(n: int) -> dict:
    entry = encyclopedia.arcanum(n)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Аркан бывает только с 1 по 22")
    return entry
