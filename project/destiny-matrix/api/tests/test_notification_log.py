import copy
import json
import logging
import subprocess
import sys
from pathlib import Path

import pytest

from app.payments.notification_log import MASK, masked_payload


@pytest.mark.parametrize("field", [
    "Token", "TOKEN", "access_token", "refresh-token", "Password", "client_secret", "Signature",
    "TerminalKey", "Authorization", "Proxy-Authorization", "api_key", "Cookie", "Set-Cookie",
    "PAN", "CardNumber", "CardId", "RebillId", "ExpDate", "ExpiryDate", "ExpirationDate",
    "CVV", "CVV2", "CVC", "CVC2", "CVN", "PIN", "PinBlock", "Cryptogram", "CAVV", "PaRes",
])
def test_masks_secret_fields_at_any_depth_without_mutating_original(field):
    payload = {"DATA": [{field: "private-value", "Email": "buyer@gmail.com"}], "Amount": 25000}
    original = copy.deepcopy(payload)
    masked = masked_payload(payload)
    assert masked == {"DATA": [{field: MASK, "Email": "buyer@gmail.com"}], "Amount": 25000}
    assert payload == original


def test_webhook_log_reaches_existing_uvicorn_output():
    # Проверяем реальную конфигурацию сервера: caplog сам включает INFO и мог бы
    # скрыть ситуацию, когда в контейнере диагностические записи вообще не выводятся.
    result = subprocess.run([sys.executable, "-c", """
import logging.config
from uvicorn.config import LOGGING_CONFIG
from app.payments.notification_log import notification_log
logging.config.dictConfig(LOGGING_CONFIG)
with notification_log('tbank', {'Token': 'secret-value', 'Email': 'buyer@gmail.com',
                                'Details': 'line one\\nline two'}) as event:
    event['result'] = 'applied'
"""], capture_output=True, text=True, check=True, cwd=Path(__file__).resolve().parents[1])
    lines = result.stderr.splitlines()
    assert len(lines) == 2
    events = [json.loads(line[line.index("{"):]) for line in lines]
    assert [event["event"] for event in events] == ["received", "completed"]
    assert events[0]["payload"]["Details"] == "line one\nline two"
    assert events[0]["payload"]["Email"] == "buyer@gmail.com"
    assert "secret-value" not in result.stderr


def test_unknown_provider_is_logged_without_claiming_signature_was_checked(client, caplog):
    name = "uvicorn.error.payment_webhook"
    caplog.set_level(logging.INFO, logger=name)
    response = client.post("/api/payments/notify/missing", json={"Token": "invalid-secret", "Status": "NEW"})
    assert response.status_code == 404
    received, completed = [json.loads(r.getMessage()) for r in caplog.records if r.name == name]
    assert received["payload"] == {"Token": MASK, "Status": "NEW"}
    assert completed["result"] == "provider_unavailable"
    assert completed["signature_valid"] is None and completed["http_status"] == 404
