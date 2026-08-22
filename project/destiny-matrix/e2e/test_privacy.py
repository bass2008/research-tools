"""Чужое не видно: прямые ссылки на чужие матрицы, служебные страницы и админку."""
from __future__ import annotations

import uuid

import flows
from conftest import BASE


def test_other_persons_report_is_not_shown(page, mail):
    """Чужая матрица по прямой ссылке не открывается — ни в разборе, ни на странице матрицы."""
    flows.buy(page, mail, 21, 9, 1997)
    ids = flows.matrix_ids(page)
    assert ids, "матрица не сохранилась"
    stranger = f"other-{uuid.uuid4().hex[:8]}@example.ru"
    flows.logout(page)
    flows.register(page, stranger)

    for path in (f"/report?m={ids[0]}", f"/matrices/{ids[0]}"):
        answer = page.goto(f"{BASE}{path}", wait_until="networkidle")
        page.wait_for_timeout(700)
        body = page.inner_text("main")
        assert "1997" not in body, f"{path} показал чужую дату: {body[:160]}"
        assert answer.status == 404 or "Собираем" in body or "нет" in body.lower(), \
            f"{path} ответил {answer.status}: {body[:160]}"


def test_logout_forgets_the_date_in_this_browser(page, mail):
    """Дата рождения не должна оставаться в браузере после выхода: компьютер бывает общим."""
    flows.buy(page, mail, 21, 9, 1997)
    flows.logout(page)
    assert page.evaluate("() => sessionStorage.getItem('destiny.birth')") is None
    page.goto(f"{BASE}/report", wait_until="networkidle")
    page.wait_for_timeout(700)
    assert "1997" not in page.inner_text("main")


def test_print_page_needs_a_pass(page):
    for query in ("?m=1&t=мусор", "?m=1", ""):
        answer = page.goto(f"{BASE}/print/report{query}", wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        assert answer.status == 404, f"{query}: {answer.status}"
        # на 404 в подвале есть ссылка «Энциклопедия арканов», поэтому смотрим содержимое разбора
        assert page.locator(".octa, [data-testid=report]").count() == 0
        assert "Ваша матрица" not in page.inner_text("body")


def test_admin_pages_are_closed_for_regular_users(page, mail):
    flows.register(page, mail)
    for path in ("/admin", "/admin/users/1"):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_timeout(900)
        assert page.get_by_test_id("admin-users").count() == 0, path
        assert page.get_by_test_id("admin-user-payments").count() == 0, path


def test_report_and_account_are_not_indexed(page, mail):
    flows.buy(page, mail, 22, 10, 1998)
    for path in ("/report", "/account", "/pay"):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        robots = page.locator("meta[name=robots]").get_attribute("content")
        assert robots and "noindex" in robots, f"{path}: {robots}"
