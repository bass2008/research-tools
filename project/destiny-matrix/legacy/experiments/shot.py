import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8899/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/claude-1000/-home-sergey-Personal-research-tools/469034f0-d951-4351-95f0-3a9b2adde4b5/scratchpad'

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name, w, h in (('desktop', 1440, 900), ('mobile', 390, 844)):
        p = b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=2 if w < 500 else 1)
        p.goto(URL, wait_until='networkidle', timeout=60000)
        p.wait_for_timeout(1200)
        p.screenshot(path=f'{OUT}/{name}-hero.png')
        # заполняем форму, чтобы увидеть карту
        try:
            p.fill('#d', '14'); p.fill('#m', '7'); p.fill('#y', '1991')
            p.click('#go'); p.wait_for_timeout(900)
            p.screenshot(path=f'{OUT}/{name}-map.png')
        except Exception as e:
            print(f'{name}: форма не заполнилась: {e}')
        p.screenshot(path=f'{OUT}/{name}-full.png', full_page=True)
        errs = []
        p.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        print(f'{name}: снято, высота страницы {p.evaluate("document.body.scrollHeight")}px')
        p.close()
    b.close()
print('OK')
