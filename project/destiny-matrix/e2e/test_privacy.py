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


def test_contract_describes_work_not_a_service(page):
    """Патент выдан на разработку ПО, включая адаптацию и модификацию (пп. 62 п. 2 ст. 346.43 НК РФ),
    поэтому предмет договора — работы по адаптации web-страницы. Язык «информационных услуг» и
    «доступа к материалам» этому виду деятельности не соответствует и возвращаться не должен."""
    page.goto(f"{BASE}/oferta", wait_until="domcontentloaded")
    page.wait_for_timeout(400)
    text = page.inner_text("main")

    assert "работ по адаптации web-страниц" in page.inner_text("h1"), page.inner_text("h1")
    # договор обязан называть то же, что уходит в чек: иначе проверяющий видит одно, покупатель другое
    for wanted in ("адаптации и модификации web-страницы", "Результат работ", "346.43",
                   "матрицу судьбы", "Адаптация web-страницы: персональный расчёт матрицы судьбы"):
        assert wanted in text, f"в оферте нет: {wanted}"
    for unwanted in ("оказание информационных услуг", "Услуга оказывается", "Услуга считается оказанной"):
        assert unwanted not in text, f"в оферте осталось: {unwanted}"

    page.goto(f"{BASE}/refund", wait_until="domcontentloaded")
    page.wait_for_timeout(400)
    back = page.inner_text("main")
    assert "Работы считаются выполненными" in back
    assert "отказаться от работ" in back
    # но пояснения на той же странице читает человек, а не юрист
    assert "разбор одной даты" in back, "в условиях возврата пропал человеческий язык"


def test_documents_do_not_contradict_each_other(page):
    """Документы читает один человек, и расхождения в них замечает он же. Здесь собраны те
    несогласованности, которые цикл нашёл в текстах: обещания про дату рождения, момент выполнения
    работ, сроки ответа и числа, которых не было в действительности."""
    def text_of(path: str) -> str:
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_timeout(300)
        return page.inner_text("main")

    privacy, oferta, refund, contacts = (text_of(p) for p in
                                         ("/privacy", "/oferta", "/refund", "/contacts"))

    # дата рождения попадает на сервер не только по кнопке в кабинете, но и при оплате
    assert "оплатили разбор" in privacy, "политика умалчивает, что покупка отправляет дату на сервер"

    # момент выполнения работ — один и тот же в договоре и в условиях возврата
    assert "момента передачи результата" in refund, refund[:200]

    # сроки ответа: 10 рабочих дней по претензиям в обоих документах
    assert "10 рабочих дней" in oferta and "10 рабочих дней" in contacts

    # состав договора читается и на телефоне: третья колонка таблицы тарифа не скрывается
    page.set_viewport_size({"width": 390, "height": 900})
    page.goto(f"{BASE}/oferta", wait_until="domcontentloaded")
    page.wait_for_timeout(400)
    head = page.locator("table.postab th").nth(2)
    assert head.is_visible(), "на телефоне из договора исчезла колонка «Что входит в результат»"
    assert page.locator("table.postab td.vl").first.is_visible(), "состав тарифа скрыт"
    page.set_viewport_size({"width": 1360, "height": 950})


def test_pages_promise_only_what_they_give(page):
    """Описания страниц обещали больше, чем страница даёт: шесть открытых разделов вместо двух,
    выбор тарифа, которого нет, и число страниц справочника, не сходившееся с перечислением."""
    page.goto(f"{BASE}/report", wait_until="domcontentloaded")
    described = page.locator('meta[name=description]').get_attribute("content") or ""
    assert "шесть" not in described, described
    assert "два открытых раздела" in described, described

    page.goto(f"{BASE}/pay", wait_until="domcontentloaded")
    assert "выбор тарифа" not in (page.title() or "").lower(), page.title()

    page.goto(f"{BASE}/encyclopedia", wait_until="domcontentloaded")
    page.wait_for_timeout(300)
    body = page.inner_text("main")
    assert "297" in body and "298 страниц" not in body, \
        "число страниц справочника снова не сходится с перечислением"
