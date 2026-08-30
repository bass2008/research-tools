"""Разбор в PDF и админка."""
from __future__ import annotations

import json
import re
import threading
import time
import urllib.request
import uuid

from playwright.sync_api import expect

import flows
from conftest import ADMIN, BASE, _credentials


def test_pdf_is_generated_and_downloads(page, mail):
    flows.buy(page, mail, 8, 8, 1998)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1200)

    answer: dict = {}
    page.on("response", lambda r: answer.update(r.json())
            if r.url.endswith("/api/reports/pdf") and r.status == 200 else None)

    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)      # до гидратации кнопка выключена
    button.click()
    # состояние ловим ожиданием, а не таймером: печать иногда успевает закончиться раньше
    page.wait_for_function(
        """() => { const b = document.querySelector('[data-testid=save-pdf]');
                   return b.innerText.includes('Готовим') || b.innerText.includes('Открыть'); }""",
        timeout=30_000)
    if "Готовим" in button.inner_text():
        assert button.is_disabled(), "кнопка активна во время печати"
    page.wait_for_function(
        "() => document.querySelector('[data-testid=save-pdf]').innerText.includes('Открыть')",
        timeout=180_000)

    assert answer.get("status") == "done", answer
    url = answer.get("url", "")
    assert url.startswith("http"), url
    with urllib.request.urlopen(url, timeout=60) as file:
        assert file.read(5).startswith(b"%PDF")

    # Второе нажатие обязано спросить ссылку заново: подпись живёт час, и на странице, открытой
    # дольше, хранилище отвечало «Access Denied» — кнопка открывала запомненную ссылку.
    with page.expect_response(
            lambda r: r.url.endswith("/api/reports/pdf") and r.status == 200,
            timeout=60_000) as caught:
        button.click()
    again = caught.value.json().get("url", "")
    assert again.startswith("http"), again
    # сравнивать сами ссылки нельзя: подпись хранилища зависит от секунды, и два запроса подряд
    # дают одинаковую строку. Инвариант в другом — запрос вообще состоялся, а не был пропущен.
    with urllib.request.urlopen(again, timeout=60) as file:
        assert file.read(5).startswith(b"%PDF")


def test_admin_returns_a_payment_from_the_interface(page, mail):
    """Возврат из админки: раньше он существовал только запросом к api — кнопки не было, и вернуть
    деньги через интерфейс было нельзя. Проверяем весь путь: покупка, возврат кнопкой, закрытый
    разбор у покупателя."""
    flows.buy(page, mail, 7, 7, 1997)
    page.goto(f"{BASE}/report", wait_until="networkidle")
    assert "мужская карта" in page.inner_text("main") or "7 июля 1997" in page.inner_text("main")

    flows.logout(page)
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    row = page.locator("[data-testid=admin-payment-row]", has_text=mail).first
    expect(row).to_be_visible(timeout=20_000)

    # Подтверждение обязано назвать сам платёж: у покупателя с двумя оплатами сумма и почта
    # совпадают побайтово, и по ним строки не различить.
    asked: list[str] = []

    def confirm(dialog):
        asked.append(dialog.message)
        dialog.accept()

    page.once("dialog", confirm)
    row.get_by_test_id("refund").click()
    expect(row).to_contain_text("возвращён", timeout=30_000)
    assert asked, "интерфейс не спросил подтверждения"
    assert mail in asked[0] and "250" in asked[0], asked[0]
    external = row.locator("td").nth(6).inner_text().strip()
    assert external and external in asked[0], f"в подтверждении нет номера платежа: {asked[0]}"
    expect(row).to_contain_text("возвращён", timeout=30_000)
    assert row.get_by_test_id("refund").count() == 0, "кнопка осталась на возвращённом платеже"

    # Право проверяем в кабинете, а не на /report: там дата берётся из браузера, а после нового
    # входа её нет — страница честно говорит «дата не выбрана», и это ничего не сказало бы о праве.
    flows.logout(page)
    flows.login(page, mail)
    page.goto(f"{BASE}/account", wait_until="networkidle")
    page.wait_for_timeout(800)
    cards = flows.matrix_cards(page)
    assert cards.count() >= 1, "дата исчезла из кабинета — возврат не должен её удалять"
    assert "куплена" not in cards.first.inner_text().lower(), \
        f"право осталось после возврата: {cards.first.inner_text()[:120]}"


def test_failed_refund_does_not_wipe_the_admin_screen(page, mail):
    """Отказ возврата раньше уходил в общую ошибку, и вместо сообщения у строки админка целиком
    подменялась экраном «Админка недоступна»: проверить, ушли ли деньги, становилось нечем."""
    flows.buy(page, mail, 9, 9, 1999)
    flows.logout(page)
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    row = page.locator("[data-testid=admin-payment-row]", has_text=mail).first
    expect(row).to_be_visible(timeout=20_000)

    page.route("**/api/admin/payments/*/refund", lambda route: route.abort())
    page.once("dialog", lambda d: d.accept())
    row.get_by_test_id("refund").click()

    expect(page.get_by_test_id("refund-error")).to_be_visible(timeout=20_000)
    expect(page.get_by_test_id("admin-payments")).to_be_visible()
    expect(page.get_by_test_id("admin-users")).to_be_visible()
    assert "Админка недоступна" not in page.inner_text("main")
    expect(row).to_contain_text("оплачен")
    assert row.get_by_test_id("refund").count() == 1, "кнопка исчезла, хотя возврат не прошёл"


def test_admin_sees_what_happens_right_now(page, browser, mail):
    """Панель состояния: люди на сайте, машина, печать, платежи. Гостя считаем настоящим —
    прогоны ходят под headless и попадают в роботов, поэтому здесь браузер представляется обычным.
    """
    human = browser.new_context(
        locale="ru-RU",
        http_credentials=_credentials(),
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36")
    guest = human.new_page()
    guest.goto(BASE, wait_until="domcontentloaded")
    guest.wait_for_timeout(2000)                   # пульс уходит сразу при открытии страницы

    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    panel = page.get_by_test_id("admin-pulse")
    expect(panel).to_be_visible(timeout=20_000)
    page.wait_for_timeout(1200)

    online = page.get_by_test_id("pulse-online").inner_text()
    assert re.match(r"[1-9]\d* человек", online), f"живой гость не посчитан: {online}"

    text = panel.inner_text()
    for word in ("Память", "Процессор", "Диск", "Том с базой", "печатается", "платежей застряло"):
        assert word in text, f"в панели нет: {word}"
    assert "%" in text

    human.close()


def test_admin_sees_lists_and_stranger_does_not(page, mail):
    flows.buy(page, mail, 9, 9, 1999)
    page.get_by_test_id("logout").click()
    page.wait_for_timeout(600)

    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    expect(page.get_by_test_id("admin-users")).to_be_visible()
    expect(page.get_by_test_id("admin-users")).to_contain_text("Последнее появление")
    expect(page.get_by_test_id("admin-payments")).to_contain_text(mail)
    expect(page.get_by_test_id("admin-reports")).to_be_visible()
    # BFF объединяет startup-снимки двух процессов, но API возвращает секреты только обрезанными.
    settings = page.get_by_test_id("admin-settings")
    expect(settings).to_be_visible(timeout=20_000)
    expect(page.get_by_test_id("admin-settings-frontend")).to_contain_text("NEXT_PUBLIC_SITE_URL")
    backend = page.get_by_test_id("admin-settings-backend")
    expect(backend).to_contain_text("JWT_SECRET")
    expect(backend).to_contain_text("секрет обрезан")

    page.get_by_test_id("logout").click()
    page.wait_for_timeout(600)
    flows.login(page, mail)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    assert page.get_by_test_id("admin-users").count() == 0, "посторонний увидел админку"


def test_security_audit_uses_ten_rows_by_default(page):
    flows.login(page, *ADMIN)
    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    size = page.get_by_test_id("audit-size")
    expect(size).to_have_value("10", timeout=20_000)
    expect(page.get_by_test_id("admin-security-audit")).to_be_visible()
    assert page.get_by_test_id("audit-row").count() <= 10


def test_second_click_returns_the_same_file(page, mail):
    """Повторное нажатие не печатает заново: сервер отдаёт готовый файл.

    С прогревом после оплаты и первое нажатие обычно приходит из кеша — здесь важно другое: обе
    ссылки ведут на один файл, и задача печати на матрицу остаётся одна.
    """
    answers: list[dict] = []
    page.on("response", lambda r: answers.append(r.json())
            if r.url.endswith("/api/reports/pdf") and r.status == 200 else None)

    flows.buy(page, mail, 12, 11, 1993)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1200)
    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    button.click()
    page.wait_for_function(
        "() => document.querySelector('[data-testid=save-pdf]').innerText.includes('Открыть')",
        timeout=180_000)

    page.reload()
    page.wait_for_timeout(1500)
    again = page.get_by_test_id("save-pdf")
    expect(again).to_be_enabled(timeout=20_000)
    again.click()
    page.wait_for_function(
        "() => document.querySelector('[data-testid=save-pdf]').innerText.includes('Открыть')",
        timeout=60_000)

    assert len(answers) == 2, answers
    assert answers[1]["cached"] is True, f"второе нажатие печатало заново: {answers}"
    assert answers[0]["url"].split("?")[0] == answers[1]["url"].split("?")[0], answers
    matrix_id = int(re.search(r"[?&]m=(\d+)", page.url).group(1))
    jobs = [j for j in page.request.get(f"{BASE}/api/reports").json()["items"]
            if j["matrix_id"] == matrix_id]
    assert len(jobs) == 1, f"задач печати на матрицу: {len(jobs)}"


def test_pdf_holds_the_paid_report(page, mail):
    """В файле есть карты и объём: пустой PDF не должен считаться успехом."""
    answer: dict = {}
    page.on("response", lambda r: answer.update(r.json())
            if r.url.endswith("/api/reports/pdf") and r.status == 200 else None)

    flows.buy(page, mail, 13, 12, 1994)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(1200)
    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    button.click()
    page.wait_for_function(
        "() => document.querySelector('[data-testid=save-pdf]').innerText.includes('Открыть')",
        timeout=180_000)

    import re
    import urllib.request
    with urllib.request.urlopen(answer["url"], timeout=90) as file:
        pdf = file.read()
    assert pdf.startswith(b"%PDF")
    assert len(pdf) > 1_000_000, f"файл подозрительно маленький: {len(pdf)} Б"
    assert len(re.findall(rb"/Subtype\s*/Image", pdf)) >= 20, "в файле нет карт арканов"


def test_printing_starts_by_itself_after_payment(page, mail):
    """Прогрев: человек только оплатил и никуда не нажимал — печать уже прошла сама.

    К нажатию «Сохранить как PDF» файл лежит в хранилище, поэтому ответ приходит из кеша, а задача
    печати в очереди остаётся одна.
    """
    flows.buy(page, mail, 4, 4, 1984)
    matrix_id = flows.matrix_ids(page)[0]

    ready = None
    for _ in range(40):                      # печать локально идёт около пяти секунд
        page.wait_for_timeout(500)
        jobs = page.request.get(f"{BASE}/api/reports").json()["items"]
        mine = [j for j in jobs if j["matrix_id"] == matrix_id]
        if mine and mine[0]["status"] == "done":
            ready = mine[0]
            break
    assert ready, "после оплаты печать не прошла сама"
    assert ready["size_bytes"] and ready["size_bytes"] > 100_000, f"файл подозрительно мал: {ready}"

    answer = page.request.post(f"{BASE}/api/reports/pdf", data={"matrix_id": matrix_id},
                               timeout=180_000)
    body = answer.json()
    assert body["cached"] is True, f"нажатие запустило печать заново: {body}"
    assert len({j["id"] for j in page.request.get(f"{BASE}/api/reports").json()["items"]
                if j["matrix_id"] == matrix_id}) == 1, "на одну матрицу больше одной задачи печати"


def test_pressing_save_during_warmup_waits_instead_of_printing_again(page, mail):
    """Человек нажал «Сохранить как PDF» раньше, чем прогрев закончился: он дожидается той же
    печати, а второй рендер не запускается."""
    flows.buy(page, mail, 5, 5, 1985)
    page.get_by_role("link", name="Открыть полный разбор").click()
    page.wait_for_timeout(600)               # намеренно жмём, пока прогрев ещё идёт
    matrix_id = int(re.search(r"[?&]m=(\d+)", page.url).group(1))
    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    with page.expect_response(lambda r: "/api/reports/pdf" in r.url and r.status == 200,
                              timeout=180_000) as caught:
        button.click()

    body = caught.value.json()
    assert body["url"], f"файла нет: {body}"
    jobs = [j for j in page.request.get(f"{BASE}/api/reports").json()["items"]
            if j["matrix_id"] == matrix_id]
    assert len(jobs) == 1, f"задач печати на одну матрицу: {len(jobs)} — печатали дважды"


def test_five_prints_at_once_do_not_kill_the_browser():
    """Пять человек нажали «Сохранить как PDF» одновременно.

    Печать держит около 65 МБ в браузерном контейнере, а ему отведено 512 МБ: замер на проде — пять
    печатей это 352 МБ, то есть семь одновременных убили бы его. Проверяем, что все пять доходят до
    файла, а одновременно печатается не больше отведённых мест.

    Без браузера и намеренно: синхронный playwright не работает из нескольких потоков, а речь тут
    про очередь печати на сервере, а не про экран.
    """
    import http.cookiejar
    import json as jsonlib
    import threading
    import urllib.request
    from concurrent.futures import ThreadPoolExecutor

    def session():
        return urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(opener, path, body=None, timeout=240):
        data = jsonlib.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(
            f"{BASE}/api{path}", data=data, method="POST" if data is not None else "GET",
            headers={"Content-Type": "application/json"})
        with opener.open(request, timeout=timeout) as answer:
            return answer.status, jsonlib.loads(answer.read())

    buyers = []
    for day in range(1, 6):
        who = session()
        code, body = call(who, "/payments/mock", {
            "tariff": "single", "email": f"slots-{uuid.uuid4().hex[:8]}@example.ru",
            "birth": f"198{day}-06-0{day}"})
        assert code == 200 and body["paid"], (code, body)
        buyers.append((who, body["matrix_id"]))

    admin = session()
    call(admin, "/auth/login", {"email": ADMIN[0], "password": ADMIN[1]})
    peak = {"now": 0, "slots": None}
    stop = threading.Event()

    def watch():
        while not stop.is_set():
            try:
                _, queue = call(admin, "/admin/reports", timeout=20)
                peak["now"] = max(peak["now"], queue.get("printing_now", 0))
                peak["slots"] = queue.get("print_slots")
            except OSError:
                pass
            time.sleep(0.3)

    watcher = threading.Thread(target=watch, daemon=True)
    watcher.start()
    try:
        with ThreadPoolExecutor(max_workers=5) as pool:
            answers = list(pool.map(
                lambda pair: call(pair[0], "/reports/pdf", {"matrix_id": pair[1]}), buyers))
    finally:
        stop.set()
        watcher.join(timeout=5)

    for code, body in answers:
        assert code == 200, (code, body)
        assert body["size_bytes"] and body["size_bytes"] > 100_000, body

    assert peak["slots"], "админка не сказала, сколько мест печати"
    assert 0 < peak["now"] <= peak["slots"], (
        f"одновременно печаталось {peak['now']} при {peak['slots']} местах")


def test_download_takes_the_report_you_are_looking_at(page, mail):
    """«Сохранить как PDF» относится к открытому разбору, а не к первой дате в списке.

    Рядом с кнопкой стоит переключатель дат, и раньше пара читалась как «скачать — сначала выбери
    какую»: подпись переключателя была просто «Матрица».
    """
    flows.buy(page, mail, 7, 3, 1990)
    flows.calculate(page, 21, 11, 1965)
    flows.save_current(page)
    first, second = flows.matrix_ids(page)[0], flows.matrix_ids(page)[-1]
    assert first != second

    # смотрим купленную дату: на закрытом разборе кнопки PDF нет вовсе — она всё равно
    # отвечала бы «не оплачен» (цикл 7)
    page.goto(f"{BASE}/report?m={first}", wait_until="networkidle")
    page.wait_for_timeout(1500)
    assert "7 марта 1990" in page.inner_text("main"), "открылась не та дата"

    sent: dict = {}
    page.route("**/api/reports/pdf", lambda route: (
        sent.update(json.loads(route.request.post_data or "{}")), route.abort()))
    button = page.get_by_test_id("save-pdf")
    expect(button).to_be_enabled(timeout=20_000)
    button.click()
    page.wait_for_timeout(1200)

    assert sent.get("matrix_id") == first, (
        f"скачивается разбор {sent.get('matrix_id')}, а на экране {first}")
    assert "7 марта 1990" in (button.get_attribute("title") or ""), \
        f"подсказка кнопки не называет открытую дату: {button.get_attribute('title')}"
    assert page.locator("[data-testid=matrix-switch]").count() == 0, \
        "переключатель дат вернулся на страницу разбора"
    row = page.evaluate("""() => {
      const sub = document.querySelector('.rsub');
      const text = sub.querySelector('p').getBoundingClientRect();
      const save = document.querySelector('.pdfslot').getBoundingClientRect();
      const box = sub.getBoundingClientRect();
      return { sameRow: Math.abs((text.top + text.height / 2) - (save.top + save.height / 2)) < 24,
               rightAligned: Math.abs(box.right - save.right) < 4,
               numbers: { row: [Math.round(box.left), Math.round(box.right)],
                          text: [Math.round(text.left), Math.round(text.right)],
                          save: [Math.round(save.left), Math.round(save.right)] } };
    }""")
    assert row["sameRow"], "кнопка сохранения не на строке подписи разбора"
    assert row["rightAligned"], f"кнопка сохранения не прижата к правому краю: {row['numbers']}"
