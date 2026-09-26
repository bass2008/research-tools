// Геометрия схемы карты для энциклопедии: где какая точка стоит, без чисел конкретной матрицы.
//
// Координаты взяты из `components/matrix/Octagram.tsx` — октаграммы, которую видит человек после
// расчёта. Одна и та же схема в двух местах: иначе «где находится визитка» в статье и в разборе
// показывало бы разные картинки.
//
// Производные точки линий (N, O, P, S, T, R, R1, R2) на октаграмме не нарисованы — там они не
// нужны, потому что линии печатаются списком чисел. Здесь они нужны: запрос «линия любви в
// матрице где» просит показать место. Положение выведено из формул метода по одному правилу —
// производная стоит между теми двумя точками, из которых считается (`spec/method.json`, `points`).
// Порядок следования линий сверен с источником: «R1 — на линии любви (M–R1–R), R2 — на линии
// денег (L–R2–R)» (`spec/sources/gadalkindom-metodika-raschyota.html`).

// Имена точек здесь намеренно не повторяют подписи позиций из платных разделов
// (`spec/sections.json`): модуль уезжает в клиентский чанк вместе с октаграммой бесплатного
// расчёта, а сторож пейволла в `scripts/check-build.cjs` ищет платные подписи именно там.
// Проверено сборкой: с прежними именами «Партнёрская точка», «Денежное направление»,
// «Пересечение денег и отношений» и «Средняя точка таланта» сторож даёт четыре провала.

import { D } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";

export interface MapPoint {
  /** ключ позиции в корпусе; у производных точек линий своей страницы может не быть */
  key: string;
  symbol: string;
  label: string;
  angle: number;
  radius: number;
  /** внешние восемь — крупные, центр — крупнее всех */
  size: "big" | "mid" | "small";
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {

  const MAP_SIZE = 620;

  const MAP_CENTER = 310;

  const R_OUT = 248;

  const R_IN = 142;

  const R_MID = (R_OUT + R_IN) / 2;

  const R_HALF = R_IN / 2;

  const MAP_POINTS: MapPoint[] = [
    // внешние восемь: четыре грани личного квадрата и четыре угла родового
    { key: "day", symbol: "A", label: D.mapPoints.day[L], angle: 180, radius: R_OUT, size: "big" },
    { key: "month", symbol: "B", label: D.mapPoints.month[L], angle: -90, radius: R_OUT, size: "big" },
    { key: "year", symbol: "C", label: D.mapPoints.year[L], angle: 0, radius: R_OUT, size: "big" },
    { key: "mission", symbol: "D", label: D.mapPoints.mission[L], angle: 90, radius: R_OUT, size: "big" },
    { key: "father_line", symbol: "F", label: D.mapPoints.father_line[L], angle: 225, radius: R_OUT, size: "mid" },
    { key: "mother_line", symbol: "G", label: D.mapPoints.mother_line[L], angle: -45, radius: R_OUT, size: "mid" },
    { key: "descendants", symbol: "H", label: D.mapPoints.descendants[L], angle: 45, radius: R_OUT, size: "mid" },
    { key: "inheritance", symbol: "I", label: D.mapPoints.inheritance[L], angle: 135, radius: R_OUT, size: "mid" },

    // внутренние четыре
    { key: "comfort_west", symbol: "J", label: D.mapPoints.comfort_west[L], angle: 180, radius: R_IN, size: "mid" },
    { key: "comfort_north", symbol: "K", label: D.mapPoints.comfort_north[L], angle: -90, radius: R_IN, size: "mid" },
    { key: "comfort_east", symbol: "L", label: D.mapPoints.comfort_east[L], angle: 0, radius: R_IN, size: "mid" },
    { key: "comfort_south", symbol: "M", label: D.mapPoints.comfort_south[L], angle: 90, radius: R_IN, size: "mid" },

    // середины между внешней и внутренней точкой одного луча: N = D + M, O = A + J, P = B + K
    { key: "karmic_tail_middle", symbol: "N", label: D.mapPoints.karmic_tail_middle[L], angle: 90, radius: R_MID, size: "small" },
    { key: "ajna_physics", symbol: "O", label: D.mapPoints.ajna_physics[L], angle: 180, radius: R_MID, size: "small" },
    { key: "ajna_energy", symbol: "P", label: D.mapPoints.ajna_energy[L], angle: -90, radius: R_MID, size: "small" },

    // середины между внутренней точкой и центром: S = J + E, T = K + E
    { key: "anahata_physics", symbol: "S", label: D.mapPoints.anahata_physics[L], angle: 180, radius: R_HALF, size: "small" },
    { key: "anahata_energy", symbol: "T", label: D.mapPoints.anahata_energy[L], angle: -90, radius: R_HALF, size: "small" },

    // нижний правый сектор: R между L и M, R1 между M и R, R2 между L и R
    { key: "money_love_crossing", symbol: "R", label: D.mapPoints.money_love_crossing[L], angle: 45, radius: R_IN, size: "small" },
    { key: "love_middle", symbol: "R1", label: D.mapPoints.love_middle[L], angle: 67.5, radius: R_IN, size: "small" },
    { key: "money_middle", symbol: "R2", label: D.mapPoints.money_middle[L], angle: 22.5, radius: R_IN, size: "small" },

    { key: "center", symbol: "E", label: D.mapPoints.center[L], angle: 0, radius: 0, size: "big" },
  ];

  const BY_KEY = new Map(MAP_POINTS.map((p) => [p.key, p]));

  /** Точки, которые нужно подсветить для позиции корпуса.
   *
   *  Для точки — она сама. Для раздела — все его точки: запрос «линия любви в матрице где» просит
   *  показать линию целиком, а не одно звено. Пустой список означает, что показывать нечего и
   *  схему на странице рисовать не надо. */
  function mapPointsFor(keys: readonly string[]): MapPoint[] {
    const out: MapPoint[] = [];
    for (const key of keys) {
      const point = BY_KEY.get(key);
      if (point && !out.includes(point)) out.push(point);
    }
    return out;
  }

  function mapPoint(key: string): MapPoint | null {
    return BY_KEY.get(key) ?? null;
  }

  function mapXY(point: MapPoint): [number, number] {
    const a = (point.angle * Math.PI) / 180;
    return [MAP_CENTER + point.radius * Math.cos(a), MAP_CENTER + point.radius * Math.sin(a)];
  }

  /** Чакра — это горизонтальная пара точек карты. Запрос «где находится свадхистана в матрице
   *  судьбы» (193 показа в месяц) просит показать место, а не значение. Символы берутся из
   *  `spec/method.json`, блок `chakras`. */
  function mapPointsBySymbol(symbols: readonly string[]): MapPoint[] {
    const out: MapPoint[] = [];
    for (const symbol of symbols) {
      const point = MAP_POINTS.find((p) => p.symbol === symbol);
      if (point && !out.includes(point)) out.push(point);
    }
    return out;
  }

  /** Разделы, которые в методе читаются линией целиком, а не набором отдельных точек.
   *
   *  Состав взят из `spec/method.json`, блок `ordered_results`. Без этого на страницах хвоста
   *  оставались подсвечены только вход M и кармическая задача D, а середина N — та самая, ради
   *  которой хвост и читают тройкой, — гасла. */
  const LINES: Record<string, readonly string[]> = {
    past_lives: ["comfort_south", "karmic_tail_middle", "mission"],
    money: ["comfort_east", "money_middle", "money_love_crossing"],
    relations: ["comfort_south", "love_middle", "money_love_crossing"],
    profession: ["month", "ajna_energy", "comfort_north"],
  };

  /** Что подсветить для раздела: линию, если она есть в методе, иначе точки раздела. */
  function mapPointsForSection(key: string, pointKeys: readonly string[]): MapPoint[] {
    return mapPointsFor(LINES[key] ?? pointKeys);
  }

  /** Ключи точек раздела для схемы: линия целиком, если она есть в методе. */
  function sectionLineKeys(key: string, pointKeys: readonly string[]): string[] {
    return [...(LINES[key] ?? pointKeys)];
  }
  return { MAP_SIZE, MAP_CENTER, MAP_POINTS, mapPointsFor, mapPoint, mapXY, mapPointsBySymbol, mapPointsForSection, sectionLineKeys };
});

// Compatibility for callers that explicitly use the deployment default.
export const { MAP_SIZE, MAP_CENTER, MAP_POINTS, mapPointsFor, mapPoint, mapXY, mapPointsBySymbol, mapPointsForSection, sectionLineKeys } = forLocale(defaultLocale);
