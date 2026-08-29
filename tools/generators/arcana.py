"""22 старших аркана: сюжет по Уэйту для промпта плюс название для подписей.

Сюжет — узнаваемые атрибуты карты Rider-Waite-Smith (1909): без венца из двенадцати звёзд
и гранатов Императрица читается просто как женщина в поле. STYLE — общий хвост промпта,
он дословно одинаков для всех карт, иначе колода развалится на 22 разные вселенные.
Поля: slug, номер, русское название, римская цифра, английское название, сюжет.
"""

# «fully clothed» стоит в стиле, а не в отдельных сюжетах: FLUX не принимает негативный промпт,
# поэтому единственный способ не получить наготу — требовать одежду в каждом кадре.
STYLE = ("elegant art nouveau line art, refined engraving with soft flat colors, "
         "every human figure fully clothed in period garments, modest dress, no nudity, "
         "muted teal and deep petrol blue palette with warm ochre gold accents, "
         "cream paper tones, thin double border frame, centered symmetrical composition, "
         "whole scene shown in full and nothing cropped, "
         "vertical card format, no text, no lettering, no watermark, "
         "highly detailed, clean lines")

ARCANA = [
    ("fool", 0, "Шут", "0", "The Fool",
     "a carefree young man in a richly patterned tunic with a wreath and a red feather in his "
     "hair, gazing up at the sky and unaware of the cliff edge under his foot, a wand with a "
     "small bundle over his shoulder, a white rose in his other hand, a little white dog "
     "leaping at his heels, yellow boots, snowy peaks and a radiant sun behind"
),
    ("magician", 1, "Магистр", "I", "The Magician",
     "a magician in a white robe under a red cloak, one arm raised holding a double-ended wand "
     "toward the sky and the other hand pointing down to the earth, infinity symbol above his "
     "head, serpent belt biting its own tail, a table before him with a cup, a sword, a wand "
     "and a pentacle, red roses and white lilies growing around"
),
    ("priestess", 2, "Верховная Жрица", "II", "The High Priestess",
     "a veiled priestess seated between one black and one white lettered pillar, flowing blue robe "
     "like water, horned crown with a moon disc, equal-armed cross on her breast, crescent moon at "
     "her feet, a half-hidden scroll in her lap, curtain of pomegranates behind her"
),
    ("empress", 3, "Императрица", "III", "The Empress",
     "a serene queen on a cushioned stone throne, crown of twelve stars, a sceptre topped with a "
     "globe in her right hand, flowing robe with pomegranate pattern, heart-shaped shield with a "
     "Venus symbol at her feet, ripe wheat field before her, cypress trees and a waterfall behind"),
    ("emperor", 4, "Император", "IV", "The Emperor",
     "a stern crowned ruler with a long white beard on a massive stone throne carved with four ram "
     "heads, golden crown, ankh-topped sceptre in his right hand, golden orb in his left, armour "
     "under a red mantle, barren red mountains behind"
),
    ("hierophant", 5, "Иерофант", "V", "The Hierophant",
     "a hierophant enthroned between two carved pillars, triple crown, triple-barred sceptre in "
     "his left hand, right hand raised in blessing with two fingers up, two tonsured acolytes "
     "kneeling before him, crossed keys at his feet, red robe"
),
    ("lovers", 6, "Влюблённые", "VI", "The Lovers",
     "a man and a woman standing apart under a great winged angel whose arms are outstretched in "
     "blessing, the man looking at the woman and the woman looking up at the angel, a tree with "
     "twelve flames behind him and a fruit tree with a coiled serpent behind her, a mountain "
     "between them, huge radiant sun above"
),
    ("chariot", 7, "Колесница", "VII", "The Chariot",
     "an armoured charioteer standing in a stone chariot, crescent moons on his shoulders, square "
     "emblem on his chest, crown with an eight-pointed star, a wand in his hand, one black and "
     "one white sphinx lying at rest before the chariot, canopy of stars, walled city behind"
),
    ("strength", 8, "Сила", "VIII", "Strength",
     "a serene woman in a white gown with a wreath of flowers on her head, gently closing the jaws "
     "of a great red lion with both hands, infinity symbol above her head, garland of roses "
     "around her waist, calm green hills"
),
    ("hermit", 9, "Отшельник", "IX", "The Hermit",
     "an old bearded hermit in a long grey hooded cloak standing on a snowy summit, raised lantern "
     "holding a six-pointed star, long wooden staff in the other hand, head slightly bowed, "
     "deep petrol blue night sky"
),
    ("wheel", 10, "Колесо Фортуны", "X", "Wheel of Fortune",
     "a great wheel with eight spokes and letters around its rim floating in the sky, a sphinx with "
     "a sword resting on top, a serpent descending on the left, a jackal-headed figure rising on "
     "the right, four winged creatures with open books in the corners, clouds"
),
    ("justice", 11, "Правосудие", "XI", "Justice",
     "a crowned figure enthroned between two stone pillars, an upright double-edged sword in the "
     "right hand, balanced golden scales in the left, red mantle, purple veil behind"
),
    ("hanged", 12, "Повешенный", "XII", "The Hanged Man",
     "a young man suspended upside down by one ankle from a living T-shaped tree, the free leg "
     "crossed behind the knee forming a figure four, hands hidden behind his back, serene face, "
     "bright halo of light around his head, red tunic and blue hose"
),
    ("death", 13, "Смерть", "XIII", "Death",
     "a skeleton in black armour riding slowly on a white horse, black banner with a white "
     "five-petalled rose, a fallen crowned king under the hooves, a bishop, a woman and a child "
     "before the horse, a river and two towers with the rising sun behind"
),
    ("temperance", 14, "Умеренность", "XIV", "Temperance",
     "a large winged angel with a solar disc on the forehead pouring water between two golden cups, "
     "one foot in the stream and one on the shore, triangle inside a square on the chest, irises by "
     "the water, a narrow path leading to distant mountains and a crown of light"
),
    ("devil", 15, "Дьявол", "XV", "The Devil",
     "a horned goat-headed winged figure crouching on a stone pedestal, one hand raised, an inverted "
     "torch in the other, an inverted five-pointed star on the brow, a chained man and woman in "
     "plain long grey tunics, with small horns and tails, standing on either side, deep petrol "
     "blue night background"
),
    ("tower", 16, "Башня", "XVI", "The Tower",
     "a bolt of lightning striking a tall stone tower and knocking its golden crown off, flames "
     "bursting from the windows, two figures falling headlong, deep petrol blue storm sky, sharp "
     "grey rocks below"
),
    ("star", 17, "Звезда", "XVII", "The Star",
     "a woman in a flowing pale sleeveless gown kneeling on one knee at the edge of a pool, pouring "
     "water from two jugs, one onto "
     "the land and one into the pool, one large eight-pointed star and seven smaller stars above, "
     "an ibis perched on a tree behind"
),
    ("moon", 18, "Луна", "XVIII", "The Moon",
     "a full moon with a face in profile shedding drops of light, a dog and a wolf howling below, a "
     "crayfish crawling out of a pool, a winding path between two towers leading to distant hills"
),
    ("sun", 19, "Солнце", "XIX", "The Sun",
     # ребёнка одеваем осознанно: канон Уэйта рисует его обнажённым, но генерировать такое нельзя
     "a joyful child in a short white tunic with a flower wreath riding a white horse, holding a "
     "large red banner, a great sun with a human face above, a stone wall with four tall "
     "sunflowers behind"
),
    ("judgement", 20, "Суд", "XX", "Judgement",
     "a winged angel in the clouds blowing a long trumpet with a cross banner, a man, a woman and a "
     "child rising from open stone tombs below with their arms raised, grey mountains and water in "
     "the distance"
),
    ("world", 21, "Мир", "XXI", "The World",
     "a dancing figure in a long flowing white robe with a violet scarf across the shoulders, inside "
     "a great oval laurel wreath, a short wand "
     "in each hand, four creatures in the corners: a winged man, an eagle, a lion and a bull, "
     "blue sky"
),
]

BY_SLUG = {a[0]: a for a in ARCANA}


def prompt(slug):
    _, _, _, _, en, scene = BY_SLUG[slug]
    return f"tarot card illustration, {en}, {scene}; {STYLE}"


def ru_title(slug):
    return BY_SLUG[slug][2]


def roman(slug):
    return BY_SLUG[slug][3]

# Порядок матрицы судьбы: 1–22 арабскими, Шут идёт последним (в таро он нулевой).
# Сайт строит пути картинок именно по этим номерам.
MATRIX = ["magician", "priestess", "empress", "emperor", "hierophant", "lovers", "chariot",
          "strength", "hermit", "wheel", "justice", "hanged", "death", "temperance", "devil",
          "tower", "star", "moon", "sun", "judgement", "world", "fool"]


def matrix_number(slug):
    return MATRIX.index(slug) + 1
