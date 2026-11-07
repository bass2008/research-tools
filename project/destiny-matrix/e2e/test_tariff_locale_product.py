"""Language changes preserve the product and localize the subscription badge."""
import pytest
from playwright.sync_api import expect
from conftest import BASE
from test_runtime_localization import switch
from test_pair import calc_pair


# /pay is one page wherever "Buy" was pressed.
@pytest.mark.parametrize('path,ids', [('/pay', ['single', 'pair', 'month'])])
def test_tariffs_keep_product_on_language_switch(page, path, ids):
    page.context.add_cookies([{'name': 'arcana_locale', 'value': 'ru', 'url': BASE}])
    page.goto(BASE + path)
    expect(page.get_by_test_id('nav-login')).to_be_visible()
    for lang in ('ru', 'en', 'ru'):
        if lang != page.locator('html').get_attribute('lang'):
            switch(page, lang)
        plans = page.locator('#plans')
        expect(plans.locator('a[data-testid^="plan-"]')).to_have_count(len(ids))
        for id in ids:
            expect(plans.get_by_test_id('plan-' + id)).to_have_attribute('href', f'/{lang}/pay/' + id)
        expect(plans.locator('.plan-value')).to_have_text(' · better value' if lang == 'en' else ' · выгоднее')


def test_couple_buy_button_keeps_its_product_on_language_switch(page):
    """Under the couple there are no plans: one button buys the couple reading, in either language."""
    page.context.add_cookies([{'name': 'arcana_locale', 'value': 'ru', 'url': BASE}])
    calc_pair(page)
    for lang in ('ru', 'en', 'ru'):
        if lang != page.locator('html').get_attribute('lang'):
            switch(page, lang)
        buy = page.get_by_test_id('pair-buy')
        expect(buy).to_have_attribute('href', f'/{lang}/pay')
        expect(buy).to_contain_text('Buy the couple reading' if lang == 'en' else 'Купить разбор пары')
        expect(page.locator('#plans')).to_have_count(0)
