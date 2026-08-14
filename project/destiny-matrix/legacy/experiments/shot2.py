import sys
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-1000/-home-sergey-Personal-research-tools/469034f0-d951-4351-95f0-3a9b2adde4b5/scratchpad'
with sync_playwright() as pw:
    b=pw.chromium.launch()
    p=b.new_page(viewport={'width':1440,'height':900})
    errs=[]
    p.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    p.on('pageerror', lambda e: errs.append('PAGEERROR '+str(e)))
    p.goto('http://127.0.0.1:8899/', wait_until='networkidle')
    p.click('#ckok')
    p.fill('#d','14'); p.fill('#m','7'); p.fill('#y','1991'); p.click('#go')
    p.wait_for_timeout(1000)
    p.screenshot(path=f'{OUT}/v2-hero.png')
    p.click('.howcalc summary'); p.wait_for_timeout(400)
    p.locator('.howcalc').scroll_into_view_if_needed(); p.wait_for_timeout(300)
    p.screenshot(path=f'{OUT}/v2-calc.png')
    for sel,name in (('.cmp','v2-table'),('#sections','v2-sections'),('#price','v2-price'),('.tw','v2-trust'),('#faq','v2-faq')):
        p.locator(sel).first.scroll_into_view_if_needed(); p.wait_for_timeout(350)
        p.screenshot(path=f'{OUT}/{name}.png')
    print('ошибки JS:', errs if errs else 'нет')
    b.close()
