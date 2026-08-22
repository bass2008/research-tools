"""Регрессии на дефекты второго прогона агентами (C1–C11).

C12 (возврат на /pay/done без номера заказа) и C13 (чек не восстанавливается после F5) тестами не
закрываются: по правилам это «недостижимо» и «пожелание», а не дефекты.
"""
from __future__ import annotations

import json
import re
import uuid

import pytest

import flows
from conftest import ADMIN, BASE

pytestmark = pytest.mark.bug

PHONE_WIDTHS = (320, 360, 390, 414)

PUBLIC_PAGES = ("/", "/pay", "/account", "/report", "/matrices", "/privacy", "/oferta", "/refund",
                "/contacts", "/login", "/register", "/forgot", "/encyclopedia",
                "/encyclopedia/arcanum/7", "/matrix")

# После этих слов существительное стоит в родительном падеже, и правило согласования другое:
# «Разборы всех 5544 карт» — верно.
GENITIVE = {"всех", "из", "более", "менее", "свыше", "около", "до", "порядка"}

# Правильные формы для проверки согласования: один, два-четыре, пять и больше.
FORMS = {
    "платёж": ("платёж", "платежа", "платежей"),
    "дата": ("дата", "даты", "дат"),
    "раздел": ("раздел", "раздела", "разделов"),
    "аркан": ("аркан", "аркана", "арканов"),
    "сочетание": ("сочетание", "сочетания", "сочетаний"),
    "позиция": ("позиция", "позиции", "позиций"),
    "страница": ("страница", "страницы", "страниц"),
    "карта": ("карта", "карты", "карт"),
}


def plural(n: int, forms: tuple[str, str, str]) -> str:
    """Эталон склонения: с ним сверяем то, что напечатал сайт."""
    tail, hundred = n % 10, n % 100
    if 11 <= hundred <= 14 or tail == 0 or tail >= 5:
        return forms[2]
    return forms[0] if tail == 1 else forms[1]


def mismatched(text: str) -> list[str]:
    """Пары «число + существительное», где форма не совпала с правильной.

    Ярлыки-номера вида «14 аркан Умеренность» пропускаем: там число — номер, а не количество,
    и согласование к нему не применяется. Родительный падеж («всех 5544 карт») — тоже не ошибка.
    """
    bad = []
    for forms in FORMS.values():
        for variant in set(forms):
            for found in re.finditer(rf"(\S+\s+)?\b(\d+)\s+{variant}\b\s*(.?)", text):
                before = (found.group(1) or "").strip().lower()
                number, after = int(found.group(2)), found.group(3)
                if before in GENITIVE:
                    continue
                if after and after.isupper():          # «14 аркан Умеренность» — номер, не количество
                    continue
                right = plural(number, forms)
                if variant != right:
                    bad.append(f"{number} {variant} (надо «{number} {right}»)")
    return bad


def widths(page) -> tuple[int, int]:
    return page.evaluate("() => [document.documentElement.scrollWidth, window.innerWidth]")


def test_c1_admin_agrees_number_with_noun(page, mail):
    """C1. «250 ₽ за 1 платежей»: число печатается рядом с существительным без согласования."""
    flows.buy(page, mail, 3, 3, 1983)
    flows.logout(page)
    flows.login(page, *ADMIN)

    uid = page.request.get(f"{BASE}/api/admin/users").json()["items"][0]["id"]
    page.goto(f"{BASE}/admin/users/{uid}", wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    card = page.inner_text("body")

    page.goto(f"{BASE}/admin", wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    listing = page.inner_text("body")

    bad = mismatched(card) + mismatched(listing)
    assert not bad, "админка не согласует число с существительным: " + "; ".join(sorted(set(bad))[:6])


def test_c2_public_pages_agree_number_with_noun(page):
    """C2. «22 арканов, 37 позиций карты, 7 чакр и 231 сочетаний» на публичных страницах."""
    bad: list[str] = []
    for path in ("/encyclopedia", "/matrix", "/"):
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        bad += [f"{path}: {x}" for x in mismatched(page.inner_text("body"))]
    assert not bad, "числа не согласованы: " + "; ".join(sorted(set(bad))[:8])


def test_c3_link_from_account_pays_for_the_date_it_promises(page, mail):
    """C3. Ссылка «Открыть — 250 ₽» из кабинета: после полной загрузки страницы платёж уходит за
    дату из калькулятора, а обещанная дата остаётся закрытой."""
    flows.register(page, mail)
    flows.calculate(page, 21, 11, 1965)
    flows.save_current(page)
    wanted = flows.matrix_ids(page)[0]
    flows.calculate(page, 4, 7, 1994)               # другая дата осталась в браузере

    sent: dict = {}

    def catch(route):
        sent.update(json.loads(route.request.post_data or "{}"))
        route.abort()

    page.route("**/payments/start", catch)
    page.goto(f"{BASE}/pay?m={wanted}", wait_until="networkidle")   # полная загрузка, как по ссылке
    page.wait_for_timeout(2000)

    chosen = page.evaluate("""() => {
      const s = document.querySelector('[data-testid=pay-target]');
      return s && s.selectedIndex >= 0 ? s.options[s.selectedIndex].text : null;
    }""")
    page.get_by_test_id("pay-email").fill(mail)
    page.locator(".consent input[type=checkbox]").check()
    page.get_by_test_id("pay-submit").click(force=True)
    page.wait_for_timeout(1500)

    assert sent.get("matrix_id") == wanted, (
        f"в адресе m={wanted}, а платёж уходит за {sent}; в списке выбрано «{chosen}»")


def test_c4_paid_promise_names_the_tariff_and_the_right_date(page, mail):
    """C4. После покупки лендинг обещает «Тариф «» уже оплачен» — с пустым названием и про дату,
    которая не оплачена."""
    flows.buy(page, mail, 8, 8, 1988)
    flows.calculate(page, 9, 9, 1999)               # другая, неоплаченная дата
    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(1500)
    text = page.inner_text("body")

    said = [line.strip() for line in text.split("\n") if "уже оплачен" in line]
    assert not any("«»" in line for line in said), f"пустое название тарифа: {said}"
    assert not said, f"про неоплаченную дату сказано, что она оплачена: {said}"


def test_c6_birth_date_does_not_outlive_its_owner(page, mail):
    """C6. Дата рождения остаётся в браузере после смены человека: её видит следующий."""
    flows.buy(page, mail, 15, 7, 1981)
    other = f"next-{uuid.uuid4().hex[:8]}@example.ru"
    flows.register(page, other)                     # второй человек, первый не нажимал «Выйти»

    flows.account(page)
    assert "15 июля 1981" not in page.inner_text("body"), \
        "кабинет предлагает второму человеку сохранить дату рождения первого"

    page.goto(f"{BASE}/report", wait_until="networkidle")
    page.wait_for_timeout(1500)
    assert "15 июля 1981" not in page.inner_text("body"), \
        "«Мой разбор» строится по дате рождения предыдущего человека"


def test_c6b_logout_in_another_tab_clears_the_birth_date(page, mail):
    """C6, второе проявление: выход сделан в другой вкладке — в оставшейся дата рождения жива."""
    flows.register(page, mail)
    flows.calculate(page, 24, 3, 1983)
    page.goto(f"{BASE}/report", wait_until="networkidle")
    page.wait_for_timeout(1200)
    assert "24 марта 1983" in page.inner_text("body")

    second = page.context.new_page()
    second.goto(f"{BASE}/account", wait_until="networkidle")
    second.wait_for_timeout(1000)
    flows.logout(second)
    second.wait_for_timeout(1000)

    page.bring_to_front()
    page.wait_for_timeout(4000)
    assert "24 марта 1983" not in page.inner_text("body"), \
        "вкладка стала гостевой, но дата рождения прежнего человека осталась на экране"


@pytest.mark.parametrize("width", PHONE_WIDTHS)
def test_c7_no_horizontal_scroll_on_every_public_page(page, mail, width):
    """C7. Инвариант на весь сайт, а не на четыре страницы: ни одна не шире окна телефона."""
    page.set_viewport_size({"width": width, "height": 780})
    flows.register(page, mail)
    flows.calculate(page, 12, 12, 1999)

    wide = []
    for path in PUBLIC_PAGES:
        page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
        page.wait_for_timeout(600)
        scroll, inner = widths(page)
        if scroll > inner + 1:
            worst = page.evaluate("""() => {
              const inner = window.innerWidth, out = [];
              document.querySelectorAll('body *').forEach((e) => {
                const r = e.getBoundingClientRect();
                if (r.width && r.right > inner + 0.5) {
                  out.push((e.tagName.toLowerCase() + '.' +
                    (typeof e.className === 'string' ? e.className.trim().split(/\\s+/).join('.') : ''))
                    + ' → ' + Math.round(r.right));
                }
              });
              return out.slice(0, 2);
            }""")
            wide.append(f"{path}: {scroll} > {inner} ({', '.join(worst)})")
    assert not wide, f"на {width}px страницы шире окна: " + "; ".join(wide)


@pytest.mark.parametrize("width", PHONE_WIDTHS)
def test_c8_target_option_text_fits_on_phones(page, mail, width):
    """C8 (и A12 первого круга). Подпись выбранной цели платежа не должна обрезаться.

    A12 мерил `select.scrollWidth` на одной ширине, а у списка он обрезку не показывает — поэтому
    измеряем ширину самой строки шрифтом поля и проверяем все телефонные ширины.
    """
    page.set_viewport_size({"width": width, "height": 780})
    flows.calculate(page, 12, 12, 1999)
    flows.open_pay(page)
    page.wait_for_timeout(800)

    # scrollWidth у select не показывает обрезку — меряем ширину самой строки шрифтом поля
    room = page.evaluate("""() => {
      const s = document.querySelector('[data-testid=pay-target]');
      if (!s) return null;
      const css = getComputedStyle(s);
      const canvas = document.createElement('canvas').getContext('2d');
      canvas.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
      const text = s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : '';
      const arrow = 26;   // место под стрелку списка
      return {
        text,
        needed: Math.round(canvas.measureText(text).width),
        available: Math.round(s.clientWidth - parseFloat(css.paddingLeft)
                              - parseFloat(css.paddingRight) - arrow),
      };
    }""")
    assert room, "списка цели нет на странице"
    assert room["needed"] <= room["available"], (
        f"на {width}px подпись «{room['text']}» не влезает: нужно {room['needed']}px, "
        f"есть {room['available']}px")


@pytest.mark.parametrize("width", (320, 360))
def test_c9_account_stays_inside_the_window_while_renaming(page, mail, width):
    """C9. Нажал карандаш, чтобы подписать дату, — кабинет уехал вбок."""
    page.set_viewport_size({"width": width, "height": 780})
    flows.register(page, mail)
    flows.calculate(page, 12, 12, 1999)
    flows.save_current(page)

    page.goto(f"{BASE}/account", wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    page.locator("[data-testid=matrix-card] button").first.click()
    page.wait_for_timeout(800)

    scroll, inner = widths(page)
    assert scroll <= inner + 1, \
        f"с открытым полем переименования кабинет шире окна: {scroll} > {inner}"


@pytest.mark.parametrize("path", ("/net-takoy-stranicy", "/matrix/net-takogo-slaga",
                                  "/encyclopedia/arcanum/999"))
def test_c10_every_404_keeps_its_own_tab_title(page, path):
    """C10. На 404 верхнего уровня и на неверном слаге матрицы стоит заголовок главной."""
    page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
    page.wait_for_timeout(1500)
    title = page.title().lower()
    assert "не найден" in title, f"{path}: заголовок вкладки «{page.title()}»"


LABELS = ("адрес", "телефон", "почта", "расчётный счёт", "банк", "инн", "огрнип")


def empty_labels(line: str) -> list[str]:
    """Ярлык без значения: следом идёт другой ярлык, разделитель или конец строки."""
    bad = []
    for part in re.split(r"\s·\s|,\s", line):
        head, sep, value = part.partition(":")
        if not sep or head.strip().lower() not in LABELS:
            continue
        rest = value.strip().rstrip(".")
        if not rest or rest.split(":")[0].strip().lower() in LABELS:
            bad.append(head.strip())
    return bad


def test_c11_requisites_have_no_empty_labels(page):
    """C11. В реквизитах оферты висит «адрес:», за которым сразу идёт «Почта:»."""
    page.goto(f"{BASE}/oferta", wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    lines = [line.strip() for line in page.inner_text("body").split("\n")
             if "ИНН" in line and "ОГРНИП" in line]
    assert lines, "блок реквизитов не найден"

    bad = {label: line for line in lines for label in empty_labels(line)}
    assert not bad, "ярлык без значения в реквизитах: " + "; ".join(
        f"«{k}» → {v}" for k, v in bad.items())
