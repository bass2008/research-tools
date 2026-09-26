"""Regressions found with real bank declines and corrupted print passes."""
import json

import pytest
from playwright.sync_api import expect

import flows
from conftest import ADMIN, BASE, REMOTE, _api_command


@pytest.mark.skipif(REMOTE, reason="Fixture uses local mock purchases and refunds")
def test_declined_payment_retry_keeps_older_matrix(page, mail):
    flows.register(page, mail)
    ids = []
    # Saving arbitrary dates requires access; refunded purchases leave real unpaid matrices.
    admin = page.context.browser.new_context()
    try:
        assert admin.request.post(BASE + "/api/auth/login",
                                  data={"email": ADMIN[0], "password": ADMIN[1]}).ok
        for birth in ["1993-03-31", "1977-11-12"]:
            response = page.request.post(BASE + "/api/payments/mock", data={
                "tariff": "single", "email": mail, "birth": birth, "sex": "f"})
            assert response.ok, response.text()
            ids.append(response.json()["matrix_id"])
            payment = page.request.get(BASE + "/api/payments").json()["items"][0]
            assert admin.request.post(BASE + f'/api/admin/payments/{payment["id"]}/refund').ok
    finally:
        admin.close()
    # The bank sync response is the only substitute: account, matrices and checkout are real.
    page.route("**/api/payments/sync", lambda route: route.fulfill(json={
        "state": "failed", "paid": False, "matrix_id": ids[0],
    }))
    page.goto(BASE + "/pay/fail?order=decline-regression")
    retry = page.locator('.paybox a.btn').first
    expect(retry).to_have_attribute("href", f"/pay?m={ids[0]}")
    retry.click()
    expect(page.get_by_test_id("pay-target")).to_have_value(str(ids[0]))
    expect(page.get_by_test_id("pay-submit")).to_contain_text("31 марта 1993")


def test_browser_rejects_error_pages_instead_of_returning_pdf():
    # Call the actual browser service with a signed, expired pass and an HTTP 200 non-report.
    # No jobs, files or settings are changed by these fault injections.
    result = _api_command(["python", "-c", """
import json, time, jwt
from app import reports
from app.config import settings
from app.security import create_print_token
payload = jwt.decode(create_print_token(1, 1), options={'verify_signature': False})
payload['exp'] = int(time.time()) - 5
token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
root = settings.web_internal_url.rstrip('/')
results = []
for name, url in [('expired', root + '/print/report?m=1&t=' + token + '&lang=ru'),
                  ('not-report', root + '/')]:
    try:
        reports.render(url)
    except Exception as exc:
        results.append({'case': name, 'rejected': True, 'error': str(exc)[:300]})
    else:
        results.append({'case': name, 'rejected': False})
print(json.dumps(results))
"""])
    assert result.returncode == 0, result.stderr
    cases = json.loads(result.stdout)
    assert all(case["rejected"] for case in cases), cases
