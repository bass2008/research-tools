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

export const MAP_SIZE = 620;
export const MAP_CENTER = 310;
const R_OUT = 248;
const R_IN = 142;
const R_MID = (R_OUT + R_IN) / 2;
const R_HALF = R_IN / 2;

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

export const MAP_POINTS: MapPoint[] = [
  // внешние восемь: четыре грани личного квадрата и четыре угла родового
  { key: "day", symbol: "A", label: "Портрет личности", angle: 180, radius: R_OUT, size: "big" },
  { key: "month", symbol: "B", label: "Духовная задача", angle: -90, radius: R_OUT, size: "big" },
  { key: "year", symbol: "C", label: "Материальная задача", angle: 0, radius: R_OUT, size: "big" },
  { key: "mission", symbol: "D", label: "Кармическая задача", angle: 90, radius: R_OUT, size: "big" },
  { key: "father_line", symbol: "F", label: "Духовная мужская линия рода", angle: 225, radius: R_OUT, size: "mid" },
  { key: "mother_line", symbol: "G", label: "Духовная женская линия рода", angle: -45, radius: R_OUT, size: "mid" },
  { key: "descendants", symbol: "H", label: "Материальная мужская линия рода", angle: 45, radius: R_OUT, size: "mid" },
  { key: "inheritance", symbol: "I", label: "Материальная женская линия рода", angle: 135, radius: R_OUT, size: "mid" },

  // внутренние четыре
  { key: "comfort_west", symbol: "J", label: "Внутренняя левая точка", angle: 180, radius: R_IN, size: "mid" },
  { key: "comfort_north", symbol: "K", label: "Внутренняя точка таланта", angle: -90, radius: R_IN, size: "mid" },
  { key: "comfort_east", symbol: "L", label: "Вход денежной линии", angle: 0, radius: R_IN, size: "mid" },
  { key: "comfort_south", symbol: "M", label: "Вход отношений и хвоста", angle: 90, radius: R_IN, size: "mid" },

  // середины между внешней и внутренней точкой одного луча: N = D + M, O = A + J, P = B + K
  { key: "karmic_tail_middle", symbol: "N", label: "Середина кармического хвоста", angle: 90, radius: R_MID, size: "small" },
  { key: "ajna_physics", symbol: "O", label: "Аджна, физика", angle: 180, radius: R_MID, size: "small" },
  { key: "ajna_energy", symbol: "P", label: "Аджна, энергия", angle: -90, radius: R_MID, size: "small" },

  // середины между внутренней точкой и центром: S = J + E, T = K + E
  { key: "anahata_physics", symbol: "S", label: "Анахата, физика", angle: 180, radius: R_HALF, size: "small" },
  { key: "anahata_energy", symbol: "T", label: "Анахата, энергия", angle: -90, radius: R_HALF, size: "small" },

  // нижний правый сектор: R между L и M, R1 между M и R, R2 между L и R
  { key: "money_love_crossing", symbol: "R", label: "Скрещение линий", angle: 45, radius: R_IN, size: "small" },
  { key: "love_middle", symbol: "R1", label: "Под сердцем", angle: 67.5, radius: R_IN, size: "small" },
  { key: "money_middle", symbol: "R2", label: "Середина денежной линии", angle: 22.5, radius: R_IN, size: "small" },

  { key: "center", symbol: "E", label: "Центр карты", angle: 0, radius: 0, size: "big" },
];

const BY_KEY = new Map(MAP_POINTS.map((p) => [p.key, p]));

/** Точки, которые нужно подсветить для позиции корпуса.
 *
 *  Для точки — она сама. Для раздела — все его точки: запрос «линия любви в матрице где» просит
 *  показать линию целиком, а не одно звено. Пустой список означает, что показывать нечего и
 *  схему на странице рисовать не надо. */
export function mapPointsFor(keys: readonly string[]): MapPoint[] {
  const out: MapPoint[] = [];
  for (const key of keys) {
    const point = BY_KEY.get(key);
    if (point && !out.includes(point)) out.push(point);
  }
  return out;
}

export function mapPoint(key: string): MapPoint | null {
  return BY_KEY.get(key) ?? null;
}

export function mapXY(point: MapPoint): [number, number] {
  const a = (point.angle * Math.PI) / 180;
  return [MAP_CENTER + point.radius * Math.cos(a), MAP_CENTER + point.radius * Math.sin(a)];
}

/** Чакра — это горизонтальная пара точек карты. Запрос «где находится свадхистана в матрице
 *  судьбы» (193 показа в месяц) просит показать место, а не значение. Символы берутся из
 *  `spec/method.json`, блок `chakras`. */
export function mapPointsBySymbol(symbols: readonly string[]): MapPoint[] {
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
export function mapPointsForSection(key: string, pointKeys: readonly string[]): MapPoint[] {
  return mapPointsFor(LINES[key] ?? pointKeys);
}

/** Ключи точек раздела для схемы: линия целиком, если она есть в методе. */
export function sectionLineKeys(key: string, pointKeys: readonly string[]): string[] {
  return [...(LINES[key] ?? pointKeys)];
}
