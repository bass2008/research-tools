// Колода лежит готовыми webp 520×780 в public/img/arcana — оптимизатор next/image не нужен,
// иначе standalone потребовал бы sharp и рантайм-обработку на той же виртуалке.
import { arcanumTitle } from "@/lib/arcana";

const WIDTH = { big: 260, grid: 132, mini: 56 } as const;
// кадр обрезается снизу (см. .arccard в globals.css): подпись на самом изображении —
// генеративный мусор, а имя аркана печатается рядом текстом
const RATIO = 700 / 520;

export type CardSize = keyof typeof WIDTH;

export function arcanumImage(n: number, half = false): string {
  return `/img/arcana/${half ? "half/" : ""}gen-${String(n).padStart(2, "0")}.webp`;
}

export default function ArcanumCard({
  n,
  size = "grid",
  eager = false,
  decorative = false,
  half = false,
}: {
  n: number;
  size?: CardSize;
  /** печать в PDF: карта вкладывается в файл целиком, поэтому берём половинный файл */
  half?: boolean;
  /** первый экран страницы: карту грузим сразу, иначе она мигает пустым местом */
  eager?: boolean;
  /** карта дублирует соседний текст — тогда скринридеру она не нужна */
  decorative?: boolean;
}) {
  const width = WIDTH[size];
  return (
    <img
      className={`arccard ${size}`}
      src={arcanumImage(n, half)}
      width={width}
      height={Math.round(width * RATIO)}
      alt={decorative ? "" : `Аркан ${n} — ${arcanumTitle(n)}`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
