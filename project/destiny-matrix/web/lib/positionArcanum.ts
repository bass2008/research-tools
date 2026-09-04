import {
  arcanumContent,
  indexedKarmicTailKeys,
  karmicTail,
  positionArcanumRows,
  positionContent,
} from "./content";
import type { PositionArcanumRow } from "./content";
import { karmicTailHref, positionHref } from "./encyclopedia";
import { clip } from "./text";

// Страница на пересечении «аркан N в позиции X». Отдельная от каталога позиции и от страницы
// аркана намеренно: спрашивают именно пересечение — «8 аркан профессии», «9 в хвосте матрицы
// судьбы», — а каталог из 22 карточек формально содержит ответ, но ответом не является. Замер на
// самом сайте: единственный раздел, где адрес повторяет запрос, стоит на медиане 5, каталоги
// позиций — на 33–42.
//
// Текст собирается из корпуса, а не пишется под каждый адрес: 814 позиционных трактовок (22 × 37)
// уже написаны и проверены, а `positionRoleTemplate` раскладывает каждую на роль, силу, риск и
// действие. Так же собраны 231 статья сочетаний — это принятый в проекте способ.

export type RegistryItem = PositionArcanumRow;

/** Как пересечение называется в заголовке и внутри текста.
 *
 *  У хвоста два равноправных имени: «хвост N» и «программа N». Это одно и то же — арканы 1 и 2
 *  не встречаются ни в одном достижимом хвосте, и спрос по ним нулевой под обоими именами, а
 *  объёмы почти совпадают (49 385 против 47 573). Одна страница отвечает на оба, иначе два почти
 *  одинаковых набора делят одну выдачу. */
interface Naming {
  /** h1 целиком: раньше «head» склеивался с «в матрице судьбы» и давал «в центре матрицы в матрице судьбы». */
  h1: (n: number) => string;
  /** Короткое имя для title выдачи: он обрезается на мобильном, бренд и лишние слова не влезают. */
  seo: (n: number) => string;
  /** Как называть позицию внутри фразы. */
  inside: string;
  /** Второе имя того же пересечения, если оно есть. */
  alias?: string;
}

const NAMES: Record<string, Naming> = {
  // У хвоста два равноправных имени: «хвост N» и «программа N». Это одно и то же — арканы 1 и 2
  // не встречаются ни в одном достижимом хвосте, и спрос по ним нулевой под обоими именами, а
  // объёмы почти совпадают (49 385 против 47 573). Одна страница отвечает на оба, иначе два
  // почти одинаковых набора делят одну выдачу.
  tail: {
    h1: (n) => `${n} аркан в кармическом хвосте`,
    seo: (n) => `${n} аркан в кармическом хвосте`,
    inside: "на позиции кармического хвоста",
    alias: "программа",
  },
  program: {
    h1: (n) => `Программа ${n} в матрице судьбы`,
    seo: (n) => `Программа ${n} в матрице судьбы`,
    inside: "на позиции кармического хвоста",
    alias: "кармический хвост",
  },
  center: {
    h1: (n) => `${n} аркан в центре матрицы судьбы`,
    seo: (n) => `${n} аркан в центре матрицы`,
    inside: "в центре карты",
  },
  relations: {
    h1: (n) => `${n} аркан в отношениях`,
    seo: (n) => `${n} аркан в отношениях`,
    inside: "в зоне отношений",
  },
  money: {
    h1: (n) => `${n} аркан в деньгах`,
    seo: (n) => `${n} аркан в деньгах`,
    inside: "на денежной линии",
  },
  heart: {
    h1: (n) => `${n} аркан под сердцем`,
    seo: (n) => `${n} аркан под сердцем`,
    inside: "в точке под сердцем",
  },
  talent: {
    h1: (n) => `${n} аркан в талантах`,
    seo: (n) => `${n} аркан в талантах`,
    inside: "на линии таланта",
  },
  card: {
    h1: (n) => `${n} аркан в визитке`,
    seo: (n) => `${n} аркан в визитке`,
    inside: "в визитке — аркане дня рождения",
  },
};

interface Role {
  essence: string;
  strength: string;
  risk: string;
  action: string;
}

// Служебный префикс корпуса: позиционные тексты частью начинаются с «Аркан «Имя» · E ·». На
// странице он читается как мусор, и `roleContent` его тоже снимает.
const CORPUS_PREFIX = /^Аркан «[^»]+» · [^·]+ ·\s*/;

/** Фраза для склейки: с заглавной и с точкой на конце. Куски корпуса написаны по-разному —
 *  часть без завершающей точки, часть со строчной, — и без этого получалось «значение.
 *  кармический хвост M–N–D: … D Поэтому одна и та же энергия». */
function sentence(text: string): string {
  const value = text.trim().replace(/\s+/g, " ");
  if (!value) return "";
  const head = value[0]!.toUpperCase() + value.slice(1);
  return /[.!?…]$/.test(head) ? head : `${head}.`;
}

/** То же для середины фразы: со строчной, без точки. */
function inline(text: string): string {
  const value = text.trim().replace(/\s+/g, " ").replace(/[.!?…]+$/, "");
  return value ? value[0]!.toLowerCase() + value.slice(1) : value;
}

/** Позиционный текст корпуса → роль, сила, риск, действие.
 *
 *  Свой читатель, а не `positionRoleTemplate`: тот требует минимум три предложения и падает на
 *  пяти текстах из восьмидесяти, написанных в два — суть и действие, без середины. Ломать его
 *  нельзя, на нём стоят статьи сочетаний и персональные разборы.
 *
 *  Когда середина одна, она идёт в силу, а риск берётся из `minus` аркана. Ставить одну и ту же
 *  фразу и в силу, и в риск нельзя: страница утверждала бы противоположное одними словами. */
function role(text: string, plus: string, minus: string): Role {
  const parts = text.replace(CORPUS_PREFIX, "").trim().split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`[position-arcanum] позиционный текст короче двух предложений: ${text}`);
  }
  // Часть текстов кладёт силу и риск в одно предложение через «;» — «в опоре человек …;
  // потеря центра заметна по тому, что он …». Без разделения риск повторял половину силы.
  const middle = parts.slice(1, -1).flatMap((part) =>
    part.includes(";") ? part.split(";").map((half) => half.trim()).filter(Boolean) : [part],
  );
  return {
    essence: sentence(parts[0]!),
    strength: middle[0] ? inline(middle[0]) : `человек ${inline(plus)}`,
    risk: middle[1] ? inline(middle[1]) : `человек ${inline(minus)}`,
    action: sentence(parts.at(-1)!),
  };
}

export function registryItems(): RegistryItem[] {
  return positionArcanumRows();
}

export function registryItem(position: string, arcanum: number): RegistryItem | null {
  return positionArcanumRows().find((i) => i.position === position && i.arcanum === arcanum) ?? null;
}

/** Тот же аркан в других позициях, у которых есть своя страница реестра.
 *
 *  Нужны для двух вещей сразу: перелинковка между пересечениями и честное сравнение в тексте.
 *  Без этого страница центра сравнивала себя с собой — «то же число в центре карты и, например,
 *  в центре карты», — потому что вторая позиция была вписана в шаблон намертво. */
export function positionArcanumSiblings(position: string, arcanum: number): RegistryItem[] {
  return positionArcanumRows().filter((i) => i.arcanum === arcanum && i.position !== position);
}

/** Подпись пересечения для ссылок и меню: ключ позиции («money», «past_lives») человеку
 *  показывать нельзя. */
export function positionArcanumLabel(item: RegistryItem): string {
  const name = NAMES[item.wording];
  if (!name) throw new Error(`[position-arcanum] неизвестная формулировка ${item.wording}`);
  return name.h1(item.arcanum);
}

export function positionArcanumHref(position: string, arcanum: number): string {
  return `${positionHref(position)}/${arcanum}`;
}

export interface PositionArcanumReading {
  position: string;
  arcanum: number;
  title: string;
  seo: { title: string; description: string; queries: string[] };
  short: string;
  sections: Array<{ h2: string; paragraphs: string[] }>;
  faq: Array<{ q: string; a: string }>;
  tails: Array<{ key: string; href: string; short: string }>;
  positionTitle: string;
  positionHref: string;
}

export function buildPositionArcanum(position: string, arcanum: number): PositionArcanumReading {
  const item = registryItem(position, arcanum);
  if (!item) throw new Error(`[position-arcanum] нет записи реестра ${position}/${arcanum}`);
  const place = positionContent(position);
  if (!place) throw new Error(`[position-arcanum] нет позиции ${position}`);
  const content = arcanumContent(arcanum);
  if (!content) throw new Error(`[position-arcanum] нет аркана ${arcanum}`);
  const name = NAMES[item.wording];
  if (!name) throw new Error(`[position-arcanum] неизвестная формулировка ${item.wording}`);
  const text = content.inPositions[position];
  if (!text) throw new Error(`[position-arcanum] нет трактовки аркана ${arcanum} в позиции ${position}`);
  const read = role(
    text,
    content.plus[0] ?? "действует по своей сильной стороне",
    content.minus[0] ?? "уходит в привычную реакцию",
  );

  const published = new Set(indexedKarmicTailKeys());
  const tails = item.tails
    .filter((key) => published.has(key))
    .map((key) => {
      const tail = karmicTail(key);
      return tail ? { key, href: karmicTailHref(key), short: tail.short } : null;
    })
    .filter((x): x is { key: string; href: string; short: string } => x !== null);

  // Костяк страницы — сравнение с тем же арканом в его других позициях. Оно и есть ответ на
  // вопрос «что энергия делает именно здесь», и оно же расходит страницы одной позиции между
  // собой: набор других позиций у каждого аркана свой. Без него восемьдесят страниц делили
  // 58–74% шестисловных шинглов — почти-дубли, тогда как принятые разделы сайта держатся на
  // 3,6–33,6%.
  const siblings = positionArcanumSiblings(position, arcanum);
  const contrasts = siblings
    .map((sib) => {
      const sibName = NAMES[sib.wording];
      const sibText = content.inPositions[sib.position];
      if (!sibName || !sibText) return null;
      const first = fragment(sibText, sibName.inside, content.short);
      return first ? `${sibName.inside} — ${first}` : null;
    })
    .filter((x): x is string => x !== null);

  const sections: Array<{ h2: string; paragraphs: string[] }> = [
    {
      h2: `Что означает ${arcanum} аркан ${name.inside}`,
      paragraphs: [
        repeats(read.essence, content.short)
          ? read.essence
          : `${read.essence} Это ${content.title}: ${inline(clip(content.short, 150))}.`,
      ],
    },
    {
      h2: "Когда работает, а когда идёт по кругу",
      paragraphs: [
        `${sentence(read.strength)} Вообще в плюсе этот аркан — про человека, который ${listing(content.plus, read.strength)}.`,
        `Если тема вытеснена, ${read.risk}. В общем виде это выглядит так: человек ${listing(content.minus, read.risk)}.`,
      ],
    },
    {
      h2: "Что с этим делать",
      paragraphs: [read.action + (content.repeat ? ` ${sentence(content.repeat)}` : "")],
    },
  ];

  if (contrasts.length) {
    sections.push({
      h2: `Чем это отличается от ${arcanum} аркана на других позициях`,
      paragraphs: [
        `Аркан отвечает «какая это энергия», позиция — «где она работает», и ответ меняется вместе с позицией. У аркана ${arcanum} разобрано ещё ${contrasts.length} ${plural(contrasts.length, "позиция")}: ${contrasts.join("; ")}.`,
        `Сравнивать их полезнее, чем читать по одной: одно и то же качество ${name.inside} и на любой из этих точек решает разные задачи, и путать их — обычная ошибка чтения карты.`,
      ],
    });
  }

  // У двух арканов из восьмидесяти своя страница только одна, и раздела сравнения у них нет.
  // Вместо него — собственное значение аркана: оно уникально для аркана, поэтому не сближает
  // страницу с остальными страницами этой же позиции, в отличие от объяснения самой позиции.
  if (!contrasts.length && content.meaning[0]) {
    sections.push({
      h2: `Что это за энергия вообще`,
      paragraphs: [content.meaning[0], ...(content.meaning[1] ? [content.meaning[1]] : [])],
    });
  }

  if (tails.length) {
    sections.push({
      h2: `В каких тройках стоит ${arcanum} аркан`,
      paragraphs: [
        `Хвост — всегда тройка M–N–D, отдельного «хвоста ${arcanum}» не существует. С разбором аркан ${arcanum} стоит в ${tails.length} ${plural(tails.length, "хвост")}: ${tails.map((t) => t.key).join(", ")} — каждая тройка уточняет сценарий, но роль самого аркана в ней остаётся той же.`,
      ],
    });
  }

  const alias = name.alias
    ? ` В нише этот же вопрос задают словом «${name.alias}»: речь об одной и той же позиции карты.`
    : "";

  const faq: Array<{ q: string; a: string }> = [
    { q: `Что означает ${inline(name.h1(arcanum))}?`, a: `${read.essence}${alias}` },
    {
      q: `Как понять, что ${arcanum} аркан здесь в минусе?`,
      a: `${sentence(read.risk)} В общем виде это выглядит так: человек ${listing(content.minus, read.risk)}.`,
    },
  ];

  if (contrasts[0]) {
    faq.push({
      q: `Меняется ли значение ${arcanum} аркана в других позициях?`,
      a: `Да. Например, ${contrasts[0]}. Это та же энергия в другой роли, и переносить вывод с одной точки на другую нельзя.`,
    });
  }

  if (tails.length) {
    faq.push({
      q: `Существует ли кармический хвост ${arcanum}?`,
      a: `Нет: хвост — тройка арканов, а не одно число. С разбором аркан ${arcanum} встречается в ${tails.length} ${plural(tails.length, "хвост")}: ${tails.map((t) => t.key).join(", ")}.`,
    });
  }

  return {
    position,
    arcanum,
    title: name.h1(arcanum),
    seo: {
      title: `${name.seo(arcanum)}: значение`,
      description: describe(name.h1(arcanum), read),
      queries: buildQueries(item, arcanum, name),
    },
    short: shortLead(name.h1(arcanum), read),
    sections,
    faq,
    tails,
    positionTitle: place.title,
    positionHref: positionHref(position),
  };
}

/** Запросы страницы: главный из реестра, остальные — вторые формулировки того же пересечения. */
function buildQueries(item: RegistryItem, arcanum: number, name: Naming): string[] {
  const out = [item.primaryQuery];
  const head = inline(name.h1(arcanum));
  const extras = [
    /матриц/i.test(head) ? head : `${head} матрица судьбы`,
    name.alias ? `${name.alias} ${arcanum} матрица судьбы` : "",
  ];
  for (const extra of extras) {
    const value = extra.trim();
    if (value && !out.some((q) => q.toLowerCase() === value.toLowerCase())) out.push(value);
  }
  return out;
}

/** Суть уже содержит короткое описание аркана? Тогда приписка «Это X: <то же самое>» — повтор.
 *  Проверяется по первым словам: тексты корпуса пересекаются дословно, а не по смыслу. */
function repeats(essence: string, short: string): boolean {
  const haystack = inline(essence);
  const whole = inline(short).trim();
  if (whole.length > 15 && haystack.includes(whole)) return true;
  // Короткое описание бывает само из двух частей через двоеточие — «чувство момента: везёт тем,
  // кто заметил». Резать по нему нельзя: у одних арканов первая часть длиннее порога, у других
  // короче, и приписка «Это X: …» появлялась через страницу. Сверяем началом, а не половиной.
  const head = whole.slice(0, 25);
  return head.length >= 15 && haystack.includes(head);
}

/** Первый экран: суть, а если она в два слова — вместе с силой. «Дар видеть иначе.» одной
 *  строкой первым экраном не работает. */
function shortLead(head: string, read: Role): string {
  const base = `${head} — ${inline(read.essence)}.`;
  return base.length >= 80 ? base : `${base} ${sentence(read.strength)}`;
}

/** Описание для выдачи: 160 знаков, обрыв посреди слова там читается как брак. Действие
 *  добавляется только целиком. */
function describe(head: string, read: Role): string {
  const base = clip(`${head} — ${inline(read.essence)}.`, 160);
  // Суть бывает в три слова («Дар видеть иначе.»), и тогда одного её мало: приёмка проекта
  // требует описание не короче 40 знаков, а обрыв посреди слова в выдаче читается как брак.
  // Поэтому добавляем следующие фразы, пока влезают целиком, и только в крайнем случае режем.
  for (const extra of [sentence(read.action), sentence(read.strength)]) {
    const candidate = `${base} ${extra}`;
    if (candidate.length <= 160) return candidate;
  }
  if (base.length >= 60) return base;
  return clip(`${base} ${sentence(read.action)}`, 160);
}

/** Первая фраза чужого позиционного текста, годная для перечисления в одну строку.
 *
 *  Снимает три вещи, которые в готовом тексте читались как брак: служебный префикс корпуса,
 *  повтор имени позиции («в центре карты — в центре карты проще быть собой…») и приписанное к
 *  фразе короткое описание аркана, которое на странице уже сказано выше. */
function fragment(text: string, inside: string, short: string): string | null {
  let value = text.replace(CORPUS_PREFIX, "").trim().split(/(?<=[.!?…])\s+/)[0] ?? "";
  const head = inside.toLowerCase();
  if (value.toLowerCase().startsWith(head)) value = value.slice(inside.length);
  const needle = inline(short).split(/[.;:]/)[0]!.trim();
  if (needle.length > 20) {
    const at = value.toLowerCase().indexOf(needle.toLowerCase());
    // Фраза была оправой вокруг короткого описания аркана: «в центре карты проще быть собой
    // через тему: <описание>». Про позицию она не говорит ничего, и обрубок «проще быть собой
    // через тему» читается как брак — такого соседа в сравнение не берём.
    if (at >= 0) return null;
  }
  value = inline(value.replace(/^[\s:,—-]+/, "").replace(/[\s:,—-]+$/, ""));
  return value.length > 25 ? clip(value, 130) : null;
}

/** Перечисление словами корпуса: списки `plus`/`minus` уникальны для аркана и потому расходят
 *  страницы между собой сильнее любого шаблона. */
function listing(items: string[], said = ""): string {
  const spoken = inline(said);
  const parts = items
    .map(inline)
    .filter((x) => x && !(spoken && (spoken.includes(x) || x.includes(spoken))))
    .slice(0, 3);
  if (!parts.length) return "действует по своей сильной стороне";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} и ${parts.at(-1)}`;
}

function plural(count: number, word: "хвост" | "позиция"): string {
  const teen = count % 100 >= 11 && count % 100 <= 14;
  const last = count % 10;
  if (word === "хвост") return teen || last !== 1 ? "хвостах" : "хвосте";
  if (teen || last === 0 || last >= 5) return "позиций";
  return last === 1 ? "позиция" : "позиции";
}
