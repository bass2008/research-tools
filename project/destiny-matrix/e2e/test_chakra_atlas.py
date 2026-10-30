"""B1: реальные права на дату, семь толкований и компактная мобильная раскладка."""
import json
import re
from pathlib import Path

import pytest
from playwright.sync_api import expect

import flows
from conftest import BASE, REMOTE

pytestmark = pytest.mark.skipif(REMOTE, reason="Requires local mock payments")
ARTIFACTS = Path('/tmp/chakra-atlas-check')
CORPUS = json.loads((Path(__file__).parents[1] / 'web/content/ru/chakra-personal.json').read_text())
TRIPLES = {
    'muladhara': [22, 11, 6], 'svadhisthana': [8, 15, 5], 'manipura': [4, 4, 8],
    'anahata': [12, 11, 5], 'vishuddha': [8, 7, 15], 'ajna': [12, 10, 22], 'sahasrara': [4, 3, 7],
}


def purchase(page, mail, birth='1993-03-31'):
    registered = page.request.post(BASE + '/api/auth/register', data={'email': mail, 'password': '1234'})
    assert registered.ok, registered.text()
    response = page.request.post(BASE + '/api/payments/start', data={
        'tariff': 'single', 'email': mail, 'birth': birth, 'sex': 'm', 'provider': 'mock'})
    assert response.ok, response.text()
    bought = response.json()
    assert bought['paid'] and bought['provider'] == 'mock'
    return bought['matrix_id']


def assert_cards(widget):
    expect(widget.locator('button[data-chakra]')).to_have_count(7)
    expect(widget.locator('[data-chakra] [data-column]')).to_have_count(21)
    expect(widget.locator('[data-energy-field] [data-column]')).to_have_count(3)
    assert widget.locator('button[data-chakra]').evaluate_all('(rows) => rows.map(r => r.dataset.chakra)') == list(TRIPLES)
    for key, triple in TRIPLES.items():
        assert widget.locator(f'button[data-chakra="{key}"] [data-arcanum]').evaluate_all(
            '(cells) => cells.map(c => Number(c.dataset.arcanum))') == triple
    widget.page.wait_for_function("""() => [...document.querySelectorAll('[data-testid=chakra-atlas] img')]
        .every(img => img.complete && img.naturalWidth > 0)""")


def test_locked_widget_and_payment_link(page):
    flows.calculate(page, 31, 3, 1993)
    widget = page.get_by_test_id('chakra-atlas')
    expect(widget).to_have_attribute('data-access', 'locked')
    expect(widget.locator('.lockico')).to_have_count(8)
    assert_cards(widget)
    row = widget.locator('button[data-chakra=muladhara]')
    row.click()
    dialog = page.get_by_test_id('chakra-dialog')
    expect(dialog).to_be_visible()
    expect(dialog.get_by_test_id('chakra-locked')).to_be_visible()
    expect(dialog.get_by_test_id('chakra-copy')).to_have_count(0)
    link = dialog.locator('a[href="/ru/pay?for=personal"]')
    expect(link).to_be_visible()
    link.click()
    expect(page).to_have_url(re.compile(r'/pay\?for=personal'))
    expect(page.get_by_test_id('plan-single')).to_be_visible()
    expect(page.get_by_test_id('plan-month')).to_be_visible()
    expect(page.get_by_test_id('plan-pair')).to_have_count(0)


def test_paid_widget_all_chakras_desktop_mobile_and_other_date(page, mail):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    mid = purchase(page, mail)
    page.goto(BASE + f'/report?m={mid}', wait_until='networkidle')
    widget = page.get_by_test_id('chakra-atlas')
    expect(widget).to_have_attribute('data-access', 'open')
    expect(widget.locator('.lockico')).to_have_count(0)
    assert_cards(widget)
    ARTIFACTS.mkdir(exist_ok=True)
    for width in (1713, 1360, 1024, 980, 768, 390, 320):
        page.set_viewport_size({'width': width, 'height': 1000})
        widget.scroll_into_view_if_needed()
        size = widget.bounding_box()
        # До 360 px панель растёт ради строк по 46 px (ChakraTable.module.css), шире — ровно 480.
        if width > 360:
            assert size['height'] <= 480.5
        else:
            assert size['height'] >= 479.5
        assert widget.evaluate('(e) => e.scrollWidth <= e.clientWidth')
        assert widget.locator('button[data-chakra]').evaluate_all(
            '(rows) => rows.every(e => e.scrollWidth <= e.clientWidth)')
        assert widget.locator('button[data-chakra]').evaluate_all('''rows => rows.every(row => {
            const box = row.getBoundingClientRect();
            return [...row.querySelectorAll('img')].every(img => {
                const card = img.getBoundingClientRect();
                return card.top >= box.top && card.bottom <= box.bottom + 1;
            });
        })''')
        widget.screenshot(path=str(ARTIFACTS / f'paid-widget-{width}.png'))
    page.set_viewport_size({'width': 1360, 'height': 950})
    for key, triple in TRIPLES.items():
        row = widget.locator(f'button[data-chakra="{key}"]')
        row.click()
        dialog = page.get_by_test_id('chakra-dialog')
        expect(dialog).to_be_visible()
        expect(dialog).to_have_attribute('data-chakra', key)
        expect(dialog.locator('figure')).to_have_count(3)
        expected = CORPUS['chakras'][key]['readings']['-'.join(map(str, triple))]['paragraphs']
        actual = dialog.get_by_test_id('chakra-copy').locator('p').all_text_contents()
        assert actual == [text.replace('**', '') for text in expected]
        expect(dialog.get_by_test_id('chakra-locked')).to_have_count(0)
        if key == 'muladhara':
            dialog.screenshot(path=str(ARTIFACTS / 'paid-muladhara-desktop.png'))
            page.set_viewport_size({'width': 390, 'height': 844})
            assert dialog.evaluate('(e) => e.scrollWidth <= e.clientWidth')
            dialog.screenshot(path=str(ARTIFACTS / 'paid-muladhara-mobile.png'))
            page.set_viewport_size({'width': 1360, 'height': 950})
        page.keyboard.press('Escape')
        expect(dialog).not_to_be_visible()
        expect(row).to_be_focused()
        page.wait_for_function("document.body.style.overflow !== 'hidden'")
    widget.get_by_role('button', name='Откуда числа').click()
    dialog = page.get_by_test_id('chakra-dialog')
    expect(dialog).to_contain_text('22 + 11 = 33 → 6')
    expect(dialog.locator('h3')).to_have_count(8)
    dialog.get_by_role('button', name='Закрыть', exact=True).click()
    expect(dialog).not_to_be_visible()
    # Покупка одной даты не должна открывать другую.
    flows.calculate(page, 1, 1, 1990)
    expect(page.get_by_test_id('chakra-atlas')).to_have_attribute('data-access', 'locked')
    expect(page.get_by_test_id('chakra-atlas').locator('.lockico')).to_have_count(8)
    assert errors == []


def test_paid_other_date_reads_its_own_combinations(page, mail):
    mid = purchase(page, mail, birth='1990-01-01')
    page.goto(BASE + f'/report?m={mid}', wait_until='networkidle')
    widget = page.get_by_test_id('chakra-atlas')
    expect(widget).to_have_attribute('data-access', 'open')
    for key in TRIPLES:
        row = widget.locator(f'button[data-chakra="{key}"]')
        triple = row.locator('[data-arcanum]').evaluate_all('(cells) => cells.map(c => c.dataset.arcanum)')
        row.click()
        reading = page.get_by_test_id('chakra-copy')
        expect(reading).not_to_have_attribute('data-empty', 'true')
        expected = CORPUS['chakras'][key]['readings']['-'.join(triple)]['paragraphs']
        assert reading.locator('p').all_text_contents() == [text.replace('**', '') for text in expected]
        expect(page.get_by_test_id('chakra-locked')).to_have_count(0)
        page.keyboard.press('Escape')
        expect(page.get_by_test_id('chakra-dialog')).not_to_be_visible()


def test_matrix_catalog_keeps_public_chakra_links(page):
    page.goto(BASE + '/matrix/4-3-22', wait_until='networkidle')
    widget = page.get_by_test_id('chakra-atlas')
    expect(widget).to_have_attribute('data-access', 'reference')
    expect(widget.locator('a[data-chakra]')).to_have_count(7)
    widget.locator('a[data-chakra=muladhara]').click()
    expect(page).to_have_url(BASE + '/ru/encyclopedia/chakra/muladhara')


@pytest.mark.parametrize('catalog', [False, True])
def test_chakra_hover_highlights_exact_points_and_resets(page, catalog):
    if catalog:
        page.goto(BASE + '/matrix/4-3-22', wait_until='networkidle')
    else:
        flows.calculate(page, 31, 3, 1993)
    points = page.locator('svg.oct [data-map-point]')
    page.mouse.move(0, 0)
    # После прокрутки к результату курсор мог оказаться над строкой: ждём конца перехода.
    page.wait_for_function('''() => [...document.querySelectorAll('svg.oct circle')]
        .every(circle => circle.getAnimations().length === 0)''')
    baseline = points.evaluate_all('''nodes => Object.fromEntries(nodes.map(n =>
        [n.dataset.mapPoint, getComputedStyle(n.querySelector('circle:not([data-chakra-halo])')).fill]))''')
    expected = {
        'muladhara': (['year', 'mission'], 'rgb(201, 69, 58)'),
        'svadhisthana': (['comfort_east', 'comfort_south'], 'rgb(221, 123, 42)'),
        'manipura': (['center'], 'rgb(217, 172, 30)'),
        'anahata': (['anahata_physics', 'anahata_energy'], 'rgb(21, 156, 105)'),
        'vishuddha': (['comfort_west', 'comfort_north'], 'rgb(31, 158, 214)'),
        'ajna': (['ajna_physics', 'ajna_energy'], 'rgb(63, 94, 201)'),
        'sahasrara': (['day', 'month'], 'rgb(142, 91, 196)'),
    }
    check = '''({keys, color, baseline}) => {
        const nodes = [...document.querySelectorAll('svg.oct [data-map-point]')];
        return nodes.length === 21 && nodes.every(n => {
            const halo = n.querySelector('[data-chakra-halo]');
            const fill = getComputedStyle(n.querySelector('circle:not([data-chakra-halo])')).fill;
            const active = keys.includes(n.dataset.mapPoint);
            return fill === (active ? color : baseline[n.dataset.mapPoint])
                && (halo ? Number(getComputedStyle(halo).opacity) === (active ? 1 : 0) : !active);
        });
    }'''
    for chakra, (keys, color) in expected.items():
        page.locator(f'[data-chakra-row="{chakra}"]').hover()
        page.wait_for_function(check, arg={'keys': keys, 'color': color, 'baseline': baseline})
    page.mouse.move(0, 0)
    page.wait_for_function(check, arg={'keys': [], 'color': '', 'baseline': baseline})
    # Клавиатура тоже подсвечивает нужные точки; наведение на другую строку имеет приоритет.
    page.keyboard.press('Tab')
    page.locator('[data-chakra-row=manipura]').focus()
    page.wait_for_function(check, arg={'keys': ['center'], 'color': expected['manipura'][1], 'baseline': baseline})
    page.locator('[data-chakra-row=anahata]').hover()
    page.wait_for_function(check, arg={'keys': expected['anahata'][0], 'color': expected['anahata'][1], 'baseline': baseline})
    # При печати временная экранная подсветка не попадает в документ.
    page.emulate_media(media='print')
    page.wait_for_function(check, arg={'keys': [], 'color': '', 'baseline': baseline})
