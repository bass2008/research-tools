from concurrent.futures import ThreadPoolExecutor

from app import printing, reports
from app.config import settings
from app.i18n import PHRASES, current_locale, negotiate_locale, using_locale


def test_error_response_keeps_translations_for_an_open_form(client, auth):
    for locale in ("ru", "en"):
        response = client.post("/api/auth/login", json={"email": "missing@example.ru", "password": "123"},
                               headers={"Accept-Language": locale})
        assert response.status_code == 401
        assert response.json()["detail"] == PHRASES["auth.bad_credentials"][locale]
        assert response.json()["messages"] == PHRASES["auth.bad_credentials"]

    headers = auth("slots-locale@example.ru")
    client.post("/api/matrices", headers=headers, json={"birth": "1993-03-31", "sex": "f"})
    response = client.post("/api/matrices", headers={**headers, "Accept-Language": "en"},
                           json={"birth": "1990-01-01", "sex": "f"})
    assert response.status_code == 402
    messages = response.json()["messages"]
    assert "Full reading for one date" in messages["en"]
    assert "Полный разбор одной даты" in messages["ru"]
    assert response.json()["detail"] == messages["en"]


def test_schema_errors_keep_both_languages(client):
    response = client.post("/api/auth/login", headers={"Accept-Language": "en"},
                           json={"email": "user@example.ru", "password": "1"})
    assert response.status_code == 422
    messages = response.json()["messages"]
    assert messages["en"].startswith("Check password.")
    assert messages["ru"].startswith("Проверьте пароль.")
    assert response.json()["detail"] == messages["en"]


def test_payment_history_translates_display_name_without_changing_snapshot(client, db):
    from app.models import Payment
    purchase = client.post("/api/payments/mock", headers={"Accept-Language": "ru"},
                           json={"email": "history-locale@example.ru", "tariff": "single", "birth": "1993-03-31"})
    assert purchase.status_code == 200
    headers = {"Authorization": f"Bearer {purchase.json()['token']}"}
    snapshot = db.query(Payment).one().tariff_body
    for locale, expected in (("en", "Full reading for one date"), ("ru", "Полный разбор одной даты")):
        response = client.get("/api/payments", headers={**headers, "Accept-Language": locale})
        assert response.status_code == 200
        item = response.json()["items"][0]
        assert item["tariff"]["display_name"] == expected
        assert item["tariff"]["name"] == "Полный разбор одной даты"
    db.expire_all()
    assert db.query(Payment).one().tariff_body == snapshot


def test_request_locales_are_isolated(client):
    def read(locale):
        response = client.get("/api/auth/me", headers={"Accept-Language": locale})
        assert response.status_code == 401
        assert response.headers["Content-Language"] == locale
        assert response.json()["detail"] == PHRASES["auth.token_required"][locale]

    with ThreadPoolExecutor(max_workers=4) as workers:
        list(workers.map(read, ["ru", "en"] * 8))


def test_language_keeps_account_matrix_and_rights(client):
    purchase = client.post("/api/payments/mock", headers={"Accept-Language": "ru"},
                           json={"email": "language@example.ru", "tariff": "single",
                                 "birth": "1993-03-31"})
    assert purchase.status_code == 200, purchase.text
    token = {"Authorization": f"Bearer {purchase.json()['token']}"}
    ru = client.get("/api/matrices", headers={**token, "Accept-Language": "ru"}).json()["items"]
    en = client.get("/api/matrices", headers={**token, "Accept-Language": "en"}).json()["items"]
    assert len(ru) == len(en) == 1
    assert ru[0]["id"] == en[0]["id"]
    assert ru[0]["access"] == en[0]["access"] == "forever"
    assert ru[0]["title"] == "Матрица 31 марта 1993"
    assert en[0]["title"] == "Chart of 31 March 1993"
    client.patch(f"/api/matrices/{ru[0]['id']}", headers=token, json={"title": "Моя карта"})
    assert client.get("/api/matrices", headers={**token, "Accept-Language": "en"}).json()["items"][0]["title"] == "Моя карта"


def test_pdf_cache_is_separate_for_each_language(client, auth, monkeypatch):
    calls = []
    monkeypatch.setattr(settings, "browser_url", "http://browser:3001")
    monkeypatch.setattr(settings, "reports_store", "local")
    monkeypatch.setattr(reports, "render", lambda url: calls.append(url) or b"%PDF test")
    monkeypatch.setattr(reports, "upload", lambda *args: None)
    monkeypatch.setattr(reports, "link", lambda key, filename=None: key)
    class Store:
        def exists(self, _key):
            return True
    monkeypatch.setattr(printing, "store", lambda: Store())
    paid = client.post("/api/payments/mock", json={"email": "pdf-language@example.ru",
                       "tariff": "single", "birth": "1993-03-31"}).json()
    headers = {"Authorization": f"Bearer {paid['token']}"}
    def render(locale):
        response = client.post("/api/reports/render", json={"matrix_id": paid["matrix_id"]},
                               headers={**headers, "Accept-Language": locale})
        assert response.status_code == 200, response.text
        return response.json()
    ru, en, again = render("ru"), render("en"), render("ru")
    assert ru["job_id"] != en["job_id"]
    assert again["job_id"] == ru["job_id"] and again["cached"]
    assert len(calls) == 2
    assert calls[0].endswith("lang=ru") and calls[1].endswith("lang=en")
    # A Russian-speaking admin must rebuild the same English document.
    admin = auth(settings.admins[0])
    rebuilt = client.post(f"/api/admin/reports/{en['job_id']}/rebuild",
                          headers={**admin, "Accept-Language": "ru"})
    assert rebuilt.status_code == 200, rebuilt.text
    assert calls[-1].endswith("lang=en")


def test_validation_uses_request_language(client, auth):
    headers = auth("validation-language@example.ru")
    response = client.post("/api/matrices", json={"birth": "1890-01-01", "sex": "f"},
                           headers={**headers, "Accept-Language": "en"})
    assert response.status_code == 400
    assert response.json()["detail"] == PHRASES["matrix.early_birth"]["en"]


def test_negotiation_and_context_restore():
    assert negotiate_locale("de-DE,en-US;q=0.8,ru;q=0.5") == "en"
    assert negotiate_locale("en;q=0,ru;q=0.5") == "ru"
    before = current_locale()
    with using_locale("en"):
        assert current_locale() == "en"
        with using_locale("ru"):
            assert current_locale() == "ru"
        assert current_locale() == "en"
    assert current_locale() == before
