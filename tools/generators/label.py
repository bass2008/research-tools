"""Своя оправа для карты: от модели берём только иллюстрацию, рамку и подписи рисуем сами.

Кириллицу FLUX не умеет — модель подписывает карты по-английски и врёт в буквах,
поэтому нарисованная ею рамка с текстом отрезается, а название ставится шрифтом.
Шрифт тот же, что в заголовках лендинга (Cormorant Garamond), — карты и страница смотрятся одним набором.
"""
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SRC = Path(os.environ.get("LABEL_SRC", "out"))
DST = Path(os.environ.get("LABEL_DST", "out/ru"))
GLOB = os.environ.get("LABEL_GLOB", "empress-schnell-v*.png")
TITLE = os.environ.get("LABEL_TITLE", "Императрица")
NUM = os.environ.get("LABEL_NUM", "III")
MOTTO = os.environ.get("LABEL_MOTTO", "изобилие · забота · рост")
FONT = os.environ.get("LABEL_FONT", "cormorant")  # cormorant | playfair
MODE = os.environ.get("LABEL_MODE", "frame")      # frame — своя оправа; extend — полоса снизу
PAD = int(os.environ.get("LABEL_PAD", 168))       # высота полосы под подпись

# доля кадра, которую занимает нарисованная моделью рамка с её подписями
CROP = (float(os.environ.get("LABEL_CROP_L", 0.07)), float(os.environ.get("LABEL_CROP_T", 0.085)),
        float(os.environ.get("LABEL_CROP_R", 0.07)), float(os.environ.get("LABEL_CROP_B", 0.135)))

W, H = 800, 1200
PAPER = (252, 249, 240)
TEAL = (14, 143, 136)
GOLD = (196, 154, 42)
LINE = (206, 218, 224)
INK = (20, 38, 56)
DIM = (122, 138, 150)

FONTS = {"cormorant": ("fonts/CormorantGaramond-var.ttf", "SemiBold", "Medium"),
         "playfair": ("fonts/PlayfairDisplay-var.ttf", "Medium", "Regular")}
FPATH, W_TITLE, W_TEXT = FONTS[FONT]


def face(size, weight):
    f = ImageFont.truetype(FPATH, size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def spaced(draw, cx, y, text, font, fill, tracking):
    """Разрядка: Pillow не умеет letter-spacing, ставим буквы вручную."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill, anchor="lt")
        x += w + tracking
    return total


def diamond(d, cx, cy, r, fill):
    d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill)


def corner(d, x, y, sx, sy, color):
    """Уголок-скобка: две короткие линии и точка — вместо тяжёлой рамки."""
    d.line([(x, y + sy * 26), (x, y), (x + sx * 26, y)], fill=color, width=2)
    d.ellipse([x + sx * 34 - 2, y + sy * 34 - 2, x + sx * 34 + 2, y + sy * 34 + 2], fill=GOLD)


def frame_card(src_path, dst_path):
    img = Image.open(src_path).convert("RGB")
    iw, ih = img.size
    art = img.crop((int(iw * CROP[0]), int(ih * CROP[1]),
                    int(iw * (1 - CROP[2])), int(ih * (1 - CROP[3]))))

    card = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(card)

    d.rectangle([16, 16, W - 17, H - 17], outline=LINE, width=1)
    for (x, y, sx, sy) in ((30, 30, 1, 1), (W - 31, 30, -1, 1),
                           (30, H - 31, 1, -1), (W - 31, H - 31, -1, -1)):
        corner(d, x, y, sx, sy, TEAL)

    # окно под иллюстрацию: вписываем с обрезкой по центру, чтобы не тянуть пропорции
    win = (56, 132, W - 56, H - 196)
    ww, wh = win[2] - win[0], win[3] - win[1]
    scale = max(ww / art.width, wh / art.height)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    ox, oy = (art.width - ww) // 2, (art.height - wh) // 2
    card.paste(art.crop((ox, oy, ox + ww, oy + wh)), (win[0], win[1]))
    d.rectangle([win[0] - 1, win[1] - 1, win[2], win[3]], outline=(180, 196, 205), width=1)

    # номер аркана между двумя линиями
    fnum = face(38, W_TEXT)
    nw = d.textlength(NUM, font=fnum)
    d.text((W / 2, 62), NUM, font=fnum, fill=TEAL, anchor="mt")
    for sgn in (-1, 1):
        x0 = W / 2 + sgn * (nw / 2 + 20)
        d.line([(x0, 84), (x0 + sgn * 92, 84)], fill=LINE, width=1)

    # название
    ftitle = face(58, W_TITLE)
    tw = spaced(d, W / 2, H - 172, TITLE, ftitle, INK, 3.0)

    # разделитель с ромбом
    y = H - 104
    half = min(tw / 2, 150)
    d.line([(W / 2 - half, y), (W / 2 - 16, y)], fill=LINE, width=1)
    d.line([(W / 2 + 16, y), (W / 2 + half, y)], fill=LINE, width=1)
    diamond(d, W / 2, y, 4, GOLD)

    fmotto = face(21, W_TEXT)
    spaced(d, W / 2, H - 88, MOTTO, fmotto, DIM, 1.6)

    dst_path.parent.mkdir(parents=True, exist_ok=True)
    card.save(dst_path, quality=95)
    return dst_path


def paper_color(img):
    """Цвет бумаги карты: медиана нижней кромки, чтобы полоса срослась с картинкой."""
    strip = img.crop((0, img.height - 6, img.width, img.height)).resize((32, 1), Image.BOX)
    px = [strip.getpixel((x, 0)) for x in range(32)]
    return tuple(sorted(c[k] for c in px)[len(px) // 2] for k in (0, 1, 2))


def extend_card(src_path, dst_path):
    """Ничего не обрезаем: подклеиваем полосу снизу и подписываем на ней."""
    img = Image.open(src_path).convert("RGB")
    bg = paper_color(img)
    card = Image.new("RGB", (img.width, img.height + PAD), bg)
    card.paste(img, (0, 0))
    d = ImageDraw.Draw(card)
    cx, top = img.width / 2, img.height

    k = img.width / 800  # размеры подписи от ширины карты
    ftitle = face(int(56 * k), W_TITLE)
    spaced(d, cx, top + 22 * k, TITLE, ftitle, INK, 3.0 * k)

    y = top + 104 * k
    d.line([(cx - 132 * k, y), (cx - 15 * k, y)], fill=LINE, width=1)
    d.line([(cx + 15 * k, y), (cx + 132 * k, y)], fill=LINE, width=1)
    diamond(d, cx, y, 4 * k, GOLD)

    spaced(d, cx, top + 118 * k, MOTTO, face(int(20 * k), W_TEXT), DIM, 1.6 * k)

    dst_path.parent.mkdir(parents=True, exist_ok=True)
    card.save(dst_path, quality=95)
    return dst_path


srcs = sorted(SRC.glob(GLOB))
if not srcs:
    raise SystemExit(f"нет файлов по маске {SRC}/{GLOB}")
make = extend_card if MODE == "extend" else frame_card
for p in srcs:
    make(p, DST / f"{p.stem}-ru.png")
print(f"готово: {len(srcs)} шт. → {DST}")
