"""Цикл 6, ступень 1: дефекты переходов и состояния, найденные живым поиском.

Каждый тест написан до правки и падал по существу дефекта.
"""

import re

import pytest
from playwright.sync_api import Page, expect

from conftest import BASE

pytestmark = pytest.mark.bug


def test_link_to_all_arcana_opens_the_list_not_one_card(page: Page):
    """«22 аркана» вела на /encyclopedia/arcanum/1 — страницу одного Мага, где списка нет.

    Из шапки ссылку убрали (она повторяла «Энциклопедию»), осталась кнопка на слайде первого
    экрана — проверяем её: адрес обязан открывать раздел со списком.
    """
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector(".slide")
    href = page.evaluate(
        """() => {
          const link = [...document.querySelectorAll('a')]
            .find(a => a.textContent.trim() === '22 аркана');
          return link ? link.getAttribute('href') : null;
        }"""
    )
    assert href, "ссылки «22 аркана» нет ни в шапке, ни на слайдах"
    assert "/encyclopedia" in href and "/arcanum/" not in href, (
        f"ссылка «22 аркана» ведёт на {href}, а список арканов живёт в разделе справочника"
    )
    page.goto(BASE + href, wait_until="domcontentloaded")
    page.wait_for_selector(".enc-deck")
    cards = page.locator(".enc-deck .enc-card").count()
    assert cards == 22, f"на странице {page.url} карточек арканов {cards}, ждали 22"


def test_chakra_page_does_not_link_to_itself_among_other_levels(page: Page):
    """Блок «Остальные уровни» показывал все семь чакр, включая текущую: ссылка на себя."""
    page.goto(f"{BASE}/encyclopedia/chakra/anahata", wait_until="domcontentloaded")
    page.wait_for_selector("h3:has-text('Остальные уровни')")
    hrefs = page.evaluate(
        """() => {
          const h = [...document.querySelectorAll('h3')].find(e => e.textContent.includes('Остальные уровни'));
          if (!h) return null;
          return [...h.parentElement.querySelectorAll('a')].map(a => a.getAttribute('href'));
        }"""
    )
    assert hrefs is not None, "на странице чакры нет блока «Остальные уровни»"
    assert "/encyclopedia/chakra/anahata" not in hrefs, (
        f"страница чакры ссылается сама на себя: {hrefs}"
    )
    assert len(hrefs) == 6, f"«остальных» уровней {len(hrefs)}, а их шесть: {hrefs}"


@pytest.mark.parametrize(
    "path",
    ("/na-god", "/encyclopedia/karmic-tail", "/programmy", "/energii"),
)
def test_carousel_button_never_points_at_the_page_it_stands_on(page: Page, path):
    """Кнопка слайда вела на тот же адрес: видимый клик, после которого ничего не происходит."""
    page.goto(f"{BASE}{path}", wait_until="domcontentloaded")
    page.wait_for_selector(".cview .slide")
    hrefs = page.locator(".slide .btn.ghost").evaluate_all(
        "els => els.map(e => e.getAttribute('href'))"
    )
    dead = [h for h in hrefs if (h or "").rstrip("/") == path.rstrip("/")]
    assert not dead, f"на {path} кнопка карусели ведёт на эту же страницу: {dead}"


def test_buy_button_from_encyclopedia_lands_on_the_price_block(page: Page):
    """Кнопка «Купить полный разбор» уводила на верх главной: до тарифов оставалось 5000 px."""
    page.goto(f"{BASE}/encyclopedia", wait_until="domcontentloaded")
    page.wait_for_selector(".slide .btn.gold")
    page.locator(".slide .btn.gold").first.click()
    page.wait_for_url("**/#plans")
    page.wait_for_timeout(2500)
    top = page.evaluate(
        "() => { const e = document.querySelector('#plans');"
        " return e ? Math.round(e.getBoundingClientRect().top) : null; }"
    )
    assert top is not None, "на главной нет блока тарифов #plans"
    assert -200 < top < 400, f"после перехода блок тарифов на {top} px от верха экрана — человек его не видит"


def _section_title(page: Page) -> str:
    """Видимый раздел: показом управляет CSS по якорю, отдельного класса у него нет."""
    return page.evaluate(
        """() => {
          const pane = [...document.querySelectorAll('.enc-pane')]
            .find(e => getComputedStyle(e).display !== 'none');
          return pane ? pane.querySelector('h2').textContent.trim() : null;
        }"""
    )


def _wait_section(page: Page, title: str, why: str) -> None:
    """Дождаться раздела. Страница статическая: до гидратации на ней всегда первый раздел,
    поэтому мгновенная проверка ловила «22 аркана» на загруженной машине, а не дефект."""
    for _ in range(30):
        if _section_title(page) == title:
            return
        page.wait_for_timeout(200)
    assert _section_title(page) == title, why


def test_chosen_section_survives_reload_and_back(page: Page):
    """Раздел жил только в состоянии React: F5 и «Назад» выбрасывали в «22 аркана»."""
    page.goto(f"{BASE}/encyclopedia", wait_until="domcontentloaded")
    page.wait_for_selector(".enc-navi")
    page.get_by_role("link", name=re.compile("Семь чакр")).first.click()
    page.wait_for_timeout(400)
    assert _section_title(page) == "Семь чакр"
    assert "sec=chk" in page.url, f"выбор раздела не попал в адрес: {page.url}"

    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector(".enc-navi")
    _wait_section(page, "Семь чакр", "после обновления страница показывает другой раздел")

    page.locator(".chcol a").first.click()
    page.wait_for_url("**/encyclopedia/chakra/**")
    page.go_back()
    page.wait_for_selector(".enc-navi")
    _wait_section(page, "Семь чакр", "«Назад» вернул не в тот раздел, из которого ушли")


def test_back_shows_the_section_the_address_points_at(page: Page):
    """Адрес возвращался к ?sec=yer, а на экране оставались «22 аркана»: popstate не читался."""
    page.goto(f"{BASE}/encyclopedia?sec=yer", wait_until="domcontentloaded")
    page.wait_for_selector(".enc-navi")
    _wait_section(page, "Матрица судьбы на год", "адрес просит раздел «на год», а показан другой")
    page.get_by_role("link", name="Энциклопедия").first.click()
    page.wait_for_url("**/encyclopedia")
    page.wait_for_timeout(800)
    page.go_back()
    page.wait_for_url("**sec=yer**")
    page.wait_for_timeout(900)
    assert "sec=yer" in page.url, f"адрес после «Назад»: {page.url}"
    _wait_section(page, "Матрица судьбы на год",
                  "адрес показывает раздел «на год», а рабочая область — другой раздел")


def test_arcanum_tab_survives_reload_and_back(page: Page):
    """Вкладка аркана сбрасывалась на «Значение» после F5 и после возврата с пары."""
    page.goto(f"{BASE}/encyclopedia/arcanum/13", wait_until="domcontentloaded")
    page.wait_for_selector(".tab")
    page.get_by_role("tab", name="Сочетания с другими арканами").click()
    page.wait_for_timeout(300)
    assert page.locator(".tab.on").inner_text().strip() == "Сочетания с другими арканами"

    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector(".tab.on")
    assert page.locator(".tab.on").inner_text().strip() == "Сочетания с другими арканами", (
        "после обновления открыта другая вкладка"
    )

    page.locator(".combos a").first.click()
    page.wait_for_url("**/encyclopedia/combination/**")
    page.go_back()
    page.wait_for_selector(".tab.on")
    assert page.locator(".tab.on").inner_text().strip() == "Сочетания с другими арканами", (
        "«Назад» с пары открыл не ту вкладку, из которой уходили"
    )


def test_second_form_on_article_follows_the_date_already_calculated(page: Page):
    """Форма в статье держала своё «сегодня минус 30 лет» и перетирала посчитанную дату:
    следующая оплата уходила на дату, которую человек не вводил."""
    page.goto(f"{BASE}/o-metode", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])')
    page.select_option("#d", "5")
    page.select_option("#m", "5")
    page.select_option("#y", "1970")
    page.get_by_test_id("sex-m").click()
    page.get_by_test_id("calc-submit").click()
    page.wait_for_timeout(900)

    stored = page.evaluate("() => sessionStorage.getItem('destiny.birth')")
    assert stored and "1970-05-05" in stored, f"первая форма не сохранила дату: {stored}"

    promo = page.get_by_test_id("calc-promo")
    values = promo.evaluate("el => [...el.querySelectorAll('select')].map(s => s.value)")
    assert values == ["5", "5", "1970"], f"вторая форма показывает другую дату: {values}"
    active_sex = promo.evaluate(
        "el => [...el.querySelectorAll('.sexrow button')].filter(b => b.className.includes('on'))"
        ".map(b => b.getAttribute('data-testid'))"
    )
    assert active_sex == ["promo-sex-m"], f"вторая форма показывает другой пол: {active_sex}"

    promo.get_by_test_id("promo-submit").click()
    page.wait_for_timeout(900)
    after = page.evaluate("() => sessionStorage.getItem('destiny.birth')")
    assert after and "1970-05-05" in after, f"вторая форма перетёрла дату: {after}"


def test_keyboard_walk_does_not_break_the_carousel(page: Page):
    """Скрытые слайды оставались в порядке табуляции: фокус уезжал за кадр, кадр пустел."""
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector(".cview .slide")
    for _ in range(18):
        page.keyboard.press("Tab")
    state = page.evaluate(
        """() => {
          const view = document.querySelector('.cview');
          const active = document.querySelectorAll('.slide')[
            [...document.querySelectorAll('.pip')].findIndex(p => p.className.includes('on'))
          ];
          const vb = view.getBoundingClientRect(), ab = active.getBoundingClientRect();
          const dx = Math.max(0, Math.min(vb.right, ab.right) - Math.max(vb.left, ab.left));
          return {scrollLeft: Math.round(view.scrollLeft), cover: +(dx / vb.width).toFixed(2)};
        }"""
    )
    assert state["scrollLeft"] == 0, f"кадр карусели уехал в сторону: scrollLeft={state['scrollLeft']}"
    assert state["cover"] > 0.9, f"в кадре виден не тот слайд: покрытие {state['cover']}"


def test_guest_can_pay_for_the_local_date_when_link_asks_for_a_saved_one(page: Page):
    """Ссылка «Открыть — 250 ₽» из кабинета у гостя гасила выбор: список сбрасывался сам,
    кнопка оплаты оставалась серой, заплатить было нельзя вообще."""
    page.goto(f"{BASE}/", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="calc-submit"]:not([disabled])')
    page.select_option("#d", "3")
    page.select_option("#m", "5")
    page.select_option("#y", "1988")
    page.get_by_test_id("calc-submit").click()
    page.wait_for_timeout(800)

    page.goto(f"{BASE}/pay?m=999999", wait_until="domcontentloaded")
    page.wait_for_selector('[data-testid="pay-target"]')
    select = page.get_by_test_id("pay-target")
    values = select.evaluate("el => [...el.options].map(o => o.value)")
    local = [v for v in values if v.startswith("local")]
    assert local, f"в списке целей нет посчитанной даты: {values}"

    select.select_option(local[0])
    page.wait_for_timeout(600)
    assert select.input_value() == local[0], (
        f"выбор сбросился сам: в списке {select.input_value()}, выбирали {local[0]}"
    )
    disabled = page.get_by_test_id("pay-submit").is_disabled()
    assert not disabled, "кнопка оплаты осталась серой при выбранной дате"
