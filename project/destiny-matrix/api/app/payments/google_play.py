"""Google owns purchase state; client callbacks and RTDN only trigger a fresh query.

This adapter deliberately does not implement the bank's start/pay-url interface.
No API response or error log contains a purchase token or credential document.
"""
from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import quote
from urllib.error import HTTPError
from urllib.request import Request as UrlRequest, urlopen

from ..config import settings
from ..models import as_utc, utcnow


class PlayError(Exception):
    pass


@dataclass(frozen=True)
class State:
    state: str
    account_id: str
    profile_id: str
    expires_at: dt.datetime | None = None
    auto_renewing: bool = False
    finalized: bool = False
    linked_token: str | None = None

    @property
    def access(self) -> bool:
        return (self.state in {"purchased", "active", "grace"} or (self.state == "canceled" and self.expires_at is not None)) and (
            self.expires_at is None or self.expires_at > utcnow())


def enabled() -> bool:
    return bool(settings.google_play_enabled and settings.google_play_credentials)


def mock_enabled() -> bool:
    return settings.google_play_mock and settings.mock_payments and not settings.is_prod


@lru_cache(maxsize=2)
def _credentials(path: str):
    from google.oauth2 import service_account
    return service_account.Credentials.from_service_account_file(
        path, scopes=["https://www.googleapis.com/auth/androidpublisher"])


def request(method: str, path: str, body: dict | None = None) -> dict:
    if not enabled():
        raise PlayError("Google Play is not configured")
    try:
        from google.auth.transport.requests import Request
        credential = _credentials(settings.google_play_credentials)
        if not credential.valid:
            credential.refresh(Request())
        url = ("https://androidpublisher.googleapis.com/androidpublisher/v3/applications/"
               + quote(settings.google_play_package, safe="") + "/" + path)
        # urllib does not emit HTTP-client INFO logs containing the token-bearing URL.
        payload = json.dumps(body).encode() if body is not None else None
        query = UrlRequest(url, data=payload, method=method, headers={
            "Authorization": f"Bearer {credential.token}", "Content-Type": "application/json"})
        with urlopen(query, timeout=20) as response:
            content = response.read()
        return json.loads(content) if content else {}
    except HTTPError as exc:
        raise PlayError(f"Google Play returned HTTP {exc.code}") from None
    except PlayError:
        raise
    except Exception as exc:
        raise PlayError("Google Play could not be reached or its response was invalid") from exc


def _date(value: str | None) -> dt.datetime | None:
    return as_utc(dt.datetime.fromisoformat(value.replace("Z", "+00:00"))) if value else None


def verify(product_id: str, token: str) -> State:
    safe_token, sku = quote(token, safe=""), quote(product_id, safe="")
    try:
        if product_id != "month":
            data = request("GET", f"purchases/products/{sku}/tokens/{safe_token}")
            if data.get("quantity", 1) != 1:
                raise PlayError("Only single-quantity purchases are supported")
            state = {0: "purchased", 1: "refunded", 2: "pending"}.get(data.get("purchaseState"))
            if state is None:
                raise PlayError("Unrecognized purchase state")
            return State(state, data.get("obfuscatedExternalAccountId", ""),
                         data.get("obfuscatedExternalProfileId", ""),
                         finalized=data.get("consumptionState") == 1)
        data = request("GET", f"purchases/subscriptionsv2/tokens/{safe_token}")
        lines = [line for line in data.get("lineItems", []) if line.get("productId") == product_id]
        if len(lines) != 1:
            raise PlayError("Subscription product does not match")
        line = lines[0]
        states = {"SUBSCRIPTION_STATE_ACTIVE": "active", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD": "grace",
                  "SUBSCRIPTION_STATE_ON_HOLD": "hold", "SUBSCRIPTION_STATE_PAUSED": "paused",
                  "SUBSCRIPTION_STATE_CANCELED": "canceled", "SUBSCRIPTION_STATE_EXPIRED": "expired",
                  "SUBSCRIPTION_STATE_PENDING": "pending", "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED": "refunded"}
        state = states.get(data.get("subscriptionState"))
        expiry = _date(line.get("expiryTime"))
        if state is None or (state in {"active", "grace", "canceled"} and expiry is None):
            raise PlayError("Invalid subscription state or expiry")
        ids = data.get("externalAccountIdentifiers", {})
        return State(state, ids.get("obfuscatedExternalAccountId", ""),
                     ids.get("obfuscatedExternalProfileId", ""), expires_at=expiry,
                     auto_renewing=bool(line.get("autoRenewingPlan", {}).get("autoRenewEnabled")),
                     finalized=data.get("acknowledgementState") == "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
                     linked_token=data.get("linkedPurchaseToken"))
    except (KeyError, ValueError, TypeError) as exc:
        raise PlayError("Invalid Google Play response") from exc


def finalize(product_id: str, token: str) -> None:
    sku, safe_token = quote(product_id, safe=""), quote(token, safe="")
    if product_id == "month":
        request("POST", f"purchases/subscriptions/{sku}/tokens/{safe_token}:acknowledge", {})
    else:
        request("POST", f"purchases/products/{sku}/tokens/{safe_token}:consume")


def cancel_renewal(token: str) -> None:
    request("POST", f"purchases/subscriptionsv2/tokens/{quote(token, safe='')}:cancel", {
        "cancellationContext": {"cancellationType": "USER_REQUESTED_STOP_RENEWALS"}})


def voided_tokens() -> set[str]:
    tokens: set[str] = set()
    page = ""
    while True:
        data = request("GET", "purchases/voidedpurchases?type=1&maxResults=1000" +
                       ("&token=" + quote(page, safe="") if page else ""))
        tokens.update(row["purchaseToken"] for row in data.get("voidedPurchases", []) if row.get("purchaseToken"))
        page = data.get("tokenPagination", {}).get("nextPageToken", "")
        if not page:
            return tokens


def authenticate_push(authorization: str | None) -> None:
    if not enabled() or not settings.google_play_rtdn_audience or not settings.google_play_rtdn_email:
        raise PlayError("Google Play notifications are not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise PlayError("Missing push identity")
    try:
        from google.auth.transport.requests import Request
        from google.oauth2 import id_token
        claims = id_token.verify_oauth2_token(authorization[7:], Request(), settings.google_play_rtdn_audience)
        if claims.get("email") != settings.google_play_rtdn_email or claims.get("email_verified") is not True:
            raise ValueError("Wrong push identity")
    except Exception as exc:
        raise PlayError("Invalid push identity") from exc
