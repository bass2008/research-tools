import { D, DR, L } from "./i18n";
import {
  arcanumContent,
  indexedKarmicTailKeys,
  indexedPositionArcanumRows,
  karmicTail,
  positionArcanumRows,
  positionContent,
} from "./content";
import type { PositionArcanumRow } from "./content";
import { karmicTailHref, positionHref } from "./encyclopedia";
import { sectionLineKeys } from "./matrixMap";
import { clip } from "./text";

// Страница на пересечении «аркан N в позиции X». Отдельная от каталога позиции и от страницы
// аркана намеренно: спрашивают именно пересечение — «8 аркан профессии», «9 в хвосте матрицы
// судьбы», — а каталог из 22 карточек формально содержит ответ, но ответом не является. Замер на
// самом сайте: единственный раздел, где адрес повторяет запрос, стоит на медиане 5, каталоги
// позиций — на 33–42.
//
// Текст собирается из корпуса, а не пишется под каждый адрес: 836 позиционных трактовок (22 × 38)
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
    h1: (n) => DR.crossing.tailH1[L](n),
    seo: (n) => DR.crossing.tailH1[L](n),
    inside: DR.crossing.tailInside[L],
    alias: DR.crossing.tailAlias[L],
  },
  program: {
    h1: (n) => DR.crossing.programH1[L](n),
    seo: (n) => DR.crossing.programH1[L](n),
    inside: DR.crossing.tailInside[L],
    alias: DR.crossing.programAlias[L],
  },
  center: {
    h1: (n) => DR.crossing.centerH1[L](n),
    seo: (n) => DR.crossing.centerSeo[L](n),
    inside: DR.crossing.centerInside[L],
  },
  relations: {
    h1: (n) => DR.crossing.relationsH1[L](n),
    seo: (n) => DR.crossing.relationsH1[L](n),
    inside: DR.crossing.relationsInside[L],
  },
  money: {
    h1: (n) => DR.crossing.moneyH1[L](n),
    seo: (n) => DR.crossing.moneyH1[L](n),
    inside: DR.crossing.moneyInside[L],
  },
  heart: {
    h1: (n) => DR.crossing.heartH1[L](n),
    seo: (n) => DR.crossing.heartH1[L](n),
    inside: DR.crossing.heartInside[L],
  },
  talent: {
    h1: (n) => DR.crossing.talentH1[L](n),
    seo: (n) => DR.crossing.talentH1[L](n),
    inside: DR.crossing.talentInside[L],
  },
  card: {
    h1: (n) => DR.crossing.cardH1[L](n),
    seo: (n) => DR.crossing.cardH1[L](n),
    inside: DR.crossing.cardInside[L],
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
const CORPUS_PREFIX = D.clause.corpusPrefix[L];

/** Фраза для склейки: с заглавной и с точкой на конце. Куски корпуса написаны по-разному —
 *  часть без завершающей точки, часть со строчной, — и без этого получалось «значение.
 *  кармический хвост M–N–D: … D Поэтому одна и та же энергия». */
function sentence(text: string): string {
  const value = text.trim().replace(/\s+/g, " ");
  if (!value) return "";
  const head = value[0]!.toUpperCase() + value.slice(1);
  // Закрывающая кавычка после знака — тоже конец фразы: без этого «…послушать?» получало
  // вторую точку, и склейка уезжала в описание страницы.
  return /[.!?…][»"”']?$/.test(head) ? head : `${head}.`;
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
    strength: middle[0] ? inline(middle[0]) : `${D.clause.subject[L]} ${inline(plus)}`,
    risk: middle[1] ? inline(middle[1]) : `${D.clause.subject[L]} ${inline(minus)}`,
    action: sentence(parts.at(-1)!),
  };
}

export function registryItems(): RegistryItem[] {
  return positionArcanumRows();
}

/** Записи, которые видит поиск. Остальные страницы существуют ради продукта: человек с картой
 *  должен дочитать про своё число, даже если этого числа никто не спрашивает. */
export function indexedRegistryItems(): RegistryItem[] {
  return indexedPositionArcanumRows();
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
  /** Что подсветить на схеме карты: точка отмечает себя, раздел — все свои точки. */
  mapKeys: string[];
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
    content.plus[0] ?? D.clause.fallbackStrength[L],
    content.minus[0] ?? D.clause.fallbackRisk[L],
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
    // Суть идёт только сюда. Раньше она же стояла первым экраном и в первом ответе FAQ, и на
    // странице одна и та же фраза читалась трижды подряд; теперь первый экран называет аркан,
    // а этот абзац отвечает на свой заголовок. Исключение — одиннадцать текстов корпуса, где
    // суть написана в три слова («Дар видеть иначе.»): абзацем такая строка не работает, и к
    // ней возвращается описание аркана, даже ценой повтора первого экрана.
    {
      h2: DR.crossing.meaningH2[L](arcanum, name.inside),
      paragraphs: [
        read.essence.length >= 60
          ? read.essence
          : DR.crossing.meaningFallback[L](read.essence, content.title, inline(clip(content.short, 150))),
      ],
    },
    {
      h2: DR.crossing.worksH2[L],
      paragraphs: [
        DR.crossing.worksPlus[L](sentence(read.strength), listing(content.plus, read.strength)),
        DR.crossing.worksMinus[L](read.risk, listing(content.minus, read.risk)),
      ],
    },
    {
      h2: DR.crossing.actionH2[L],
      paragraphs: [read.action + (content.repeat ? ` ${sentence(content.repeat)}` : "")],
    },
  ];

  if (contrasts.length) {
    sections.push({
      h2: DR.crossing.differsH2[L](arcanum),
      paragraphs: [
        DR.crossing.differsFirst[L](arcanum, contrasts.length, contrasts.join("; ")),
        DR.crossing.differsSecond[L](name.inside),
      ],
    });
  }

  // У двух арканов из восьмидесяти своя страница только одна, и раздела сравнения у них нет.
  // Вместо него — собственное значение аркана: оно уникально для аркана, поэтому не сближает
  // страницу с остальными страницами этой же позиции, в отличие от объяснения самой позиции.
  if (!contrasts.length && content.meaning[0]) {
    sections.push({
      h2: DR.crossing.energyH2[L],
      paragraphs: [content.meaning[0], ...(content.meaning[1] ? [content.meaning[1]] : [])],
    });
  }

  if (tails.length) {
    sections.push({
      h2: DR.crossing.triplesH2[L](arcanum),
      paragraphs: [
        DR.crossing.triplesText[L](arcanum, tails.length, tails.map((t) => t.key).join(", ")),
      ],
    });
  }

  const alias = name.alias ? DR.crossing.aliasNote[L](name.alias) : "";

  const faq: Array<{ q: string; a: string }> = [
    { q: DR.crossing.faqMeaning[L](inline(name.h1(arcanum))), a: `${read.essence}${alias}` },
    {
      q: DR.crossing.faqMinus[L](arcanum),
      a: DR.crossing.faqMinusAnswer[L](sentence(read.risk), listing(content.minus, read.risk)),
    },
  ];

  if (contrasts[0]) {
    faq.push({
      q: DR.crossing.faqOther[L](arcanum),
      a: DR.crossing.faqOtherAnswer[L](contrasts[0]),
    });
  }

  if (tails.length) {
    faq.push({
      q: DR.crossing.faqTail[L](arcanum),
      a: DR.crossing.faqTailAnswer[L](arcanum, tails.length, tails.map((t) => t.key).join(", ")),
    });
  }

  return {
    position,
    arcanum,
    title: name.h1(arcanum),
    seo: {
      title: DR.crossing.seoTitle[L](name.seo(arcanum)),
      description: describe(name.h1(arcanum), read),
      queries: buildQueries(item, arcanum, name),
    },
    short: shortLead(name.h1(arcanum), content.title, content.short, read),
    sections,
    faq,
    tails,
    positionTitle: place.title,
    positionHref: positionHref(position),
    // Раздел-линия подсвечивается целиком: у хвоста это M–N–D, и середина N важнее краёв.
    mapKeys: place.kind === "section"
      ? sectionLineKeys(position, place.points.map((x) => x.key))
      : [position],
  };
}

/** Запросы страницы: главный из реестра, остальные — вторые формулировки того же пересечения.
 *  У записи вне индекса головного запроса нет — заявить его значило бы увести выдачу у той
 *  страницы, которая по нему и стоит. */
function buildQueries(item: RegistryItem, arcanum: number, name: Naming): string[] {
  if (!item.primaryQuery) return [];
  const out = [item.primaryQuery];
  const head = inline(name.h1(arcanum));
  const extras = [
    DR.crossing.matrixWord[L].test(head) ? head : DR.crossing.queryMatrix[L](head),
    name.alias ? DR.crossing.queryAlias[L](name.alias, arcanum) : "",
  ];
  for (const extra of extras) {
    const value = extra.trim();
    if (value && !out.some((q) => q.toLowerCase() === value.toLowerCase())) out.push(value);
  }
  return out;
}

/** Первый экран: что это за аркан и где он стоит. Суть сюда не идёт — она отвечает на свой
 *  заголовок ниже, а дословный повтор в двух абзацах подряд читался как брак. Если короткое
 *  описание аркана в два слова («Дар видеть иначе.»), первым экраном его одного мало. */
function shortLead(head: string, title: string, short: string, read: Role): string {
  // Точка, а не двоеточие: у девятнадцати арканов из двадцати двух своё двоеточие уже стоит
  // внутри короткого описания («глубина и поиск смысла: доходит до сути»), и подводка читалась
  // с двумя двоеточиями подряд.
  const base = DR.crossing.shortLead[L](head, title, sentence(clip(short, 150)));
  return base.length >= 80 ? base : `${base} ${sentence(read.essence)}`;
}

/** Описание для выдачи: 160 знаков, обрыв посреди слова там читается как брак. Действие
 *  добавляется только целиком. */
function describe(head: string, read: Role): string {
  const base = clip(DR.crossing.describe[L](head, inline(read.essence)), 160);
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

/** Цепочки в три слова: по ним видно, что пункт списка уже сказан рядом другими словами. */
function chains(text: string): Set<string> {
  const words = text.toLowerCase().match(/[а-яёa-z0-9]+/g) ?? [];
  const out = new Set<string>();
  for (let i = 0; i + 3 <= words.length; i++) out.add(words.slice(i, i + 3).join(" "));
  return out;
}

/** Перечисление словами корпуса: списки `plus`/`minus` уникальны для аркана и потому расходят
 *  страницы между собой сильнее любого шаблона.
 *
 *  Пункт выбрасывается не только при дословном совпадении с уже сказанным, но и при общей цепочке
 *  в три слова: текст корпуса часто пересказывает `plus` своими словами, и рядом вставало
 *  «видит перекос раньше других и называет его прямо. Вообще в плюсе этот аркан — про человека,
 *  который видит перекос и называет его прямо». */
function listing(items: string[], said = ""): string {
  const spoken = inline(said);
  const spokenChains = spoken ? chains(spoken) : new Set<string>();
  const parts = items
    .map(inline)
    .filter((x) => x && !(spoken && (spoken.includes(x) || x.includes(spoken))))
    .filter((x) => ![...chains(x)].some((c) => spokenChains.has(c)))
    .slice(0, 3);
  if (!parts.length) return D.clause.fallbackStrength[L];
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} ${D.clause.and[L]} ${parts.at(-1)}`;
}
