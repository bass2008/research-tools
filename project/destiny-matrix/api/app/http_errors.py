"""Public errors keep their translations so a client can change language after a failure."""
from collections.abc import Callable

from fastapi import HTTPException

from .i18n import SUPPORTED_LOCALES, current_locale, using_locale


def message_translations(render: Callable[[], str]) -> dict[str, str]:
    messages = {}
    for locale in SUPPORTED_LOCALES:
        with using_locale(locale):
            messages[locale] = render()
    return messages


class LocalizedHTTPException(HTTPException):
    def __init__(self, status_code: int, *, detail: Callable[[], str]):
        self.messages = message_translations(detail)
        super().__init__(status_code, detail=self.messages[current_locale()])
