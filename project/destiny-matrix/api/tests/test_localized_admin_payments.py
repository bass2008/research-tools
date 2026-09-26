"""Public translations of administrative and provider failures; no real bank calls."""
import io
import json
import re
import urllib.error

import pytest

from app import payments
from app.i18n import using_locale
from app.payments.tbank import Tbank


@pytest.mark.parametrize("failure,key", [
    ("http", "pay.gateway_http"),
    ("offline", "pay.gateway_unavailable"),
    ("rejected", "pay.gateway_rejected"),
])
def test_provider_errors_have_localized_public_messages(monkeypatch, failure, key):
    def answer(*args, **kwargs):
        if failure == "http":
            raise urllib.error.HTTPError("https://bank.invalid", 503, "Ошибка банка", {}, None)
        if failure == "offline":
            raise OSError("Сеть недоступна")
        return io.BytesIO(json.dumps({"Success": False, "Message": "Отказ банка",
                                     "Details": "Подробности на русском", "ErrorCode": "123"}).encode())
    monkeypatch.setattr("urllib.request.urlopen", answer)
    with pytest.raises(payments.PaymentError) as caught:
        Tbank().call("Init", {})
    error = caught.value
    assert error.key == key
    with using_locale("ru"):
        ru = error.public_message()
    with using_locale("en"):
        en = error.public_message()
    assert re.search("[а-яА-Я]", ru)
    assert not re.search("[а-яА-Я]", en)
    assert "payment provider" in en.lower()
    if failure == "rejected":
        assert "123" in en and "Отказ банка" in str(error)


@pytest.mark.parametrize("locale", ["ru", "en"])
def test_payment_failure_response_contains_both_translations(client, monkeypatch, locale):
    def fail(*args, **kwargs):
        raise payments.PaymentError("Банк ответил по-русски", key="pay.gateway_rejected", code="123")
    monkeypatch.setattr(payments.PROVIDERS["mock"], "start", fail)
    response = client.post("/api/payments/start", headers={"Accept-Language": locale},
                           json={"tariff": "single", "email": "failure@example.ru", "birth": "1990-01-01"})
    assert response.status_code == 502
    body = response.json()
    assert body["detail"] == body["messages"][locale]
    assert "123" in body["messages"]["en"]
    assert not re.search("[а-яА-Я]", body["messages"]["en"])


@pytest.mark.parametrize("path", ["/users/999999", "/reports/999999/link"])
def test_admin_errors_switch_language(client, auth, path):
    from app.config import settings
    admin = auth(settings.admins[0])
    for locale in ("en", "ru"):
        response = client.get("/api/admin" + path, headers={**admin, "Accept-Language": locale})
        assert response.status_code == 404
        body = response.json()
        assert body["detail"] == body["messages"][locale]
        assert not re.search("[а-яА-Я]", body["messages"]["en"])
        assert re.search("[а-яА-Я]", body["messages"]["ru"])
