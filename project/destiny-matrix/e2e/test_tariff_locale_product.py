"""Language changes preserve the product and localize the subscription badge."""
import pytest
from playwright.sync_api import expect
from conftest import BASE
from test_runtime_localization import switch
from test_pair import calc_pair


@pytest.mark.parametrize('path,ids', [('/pay?for=pair', ['pair', 'month']),
                                     ('/pay?for=personal', ['single', 'month']),
                                     ('/pay', ['single', 'pair', 'month']),
                                     ('/compatibility', ['pair', 'month'])])
def test_tariffs_keep_product_on_language_switch(page, path, ids):
    page.context.add_cookies([{'name': 'arcana_locale', 'value': 'ru', 'url': BASE}])
    if path == '/compatibility':
        calc_pair(page)
    else:
        page.goto(BASE + path)
    expect(page.get_by_test_id('nav-login')).to_be_visible()
    for lang in ('ru', 'en', 'ru'):
        if lang != page.locator('html').get_attribute('lang'):
            switch(page, lang)
        plans = page.locator('#plans')
        expect(plans.locator('a[data-testid^="plan-"]')).to_have_count(len(ids))
        for id in ids:
            expect(plans.get_by_test_id('plan-' + id)).to_have_attribute('href', '/pay/' + id)
        expect(plans.locator('.plan-value')).to_have_text(' · better value' if lang == 'en' else ' · выгоднее')
