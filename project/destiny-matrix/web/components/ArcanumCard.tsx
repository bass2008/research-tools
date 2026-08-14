// Колода лежит готовыми webp 520×780 в public/img/arcana — оптимизатор next/image не нужен,
// иначе standalone потребовал бы sharp и рантайм-обработку на той же виртуалке.
import { arcanumTitle } from "@/lib/arcana";

const WIDTH = { big: 260, grid: 132, mini: 56 } as const;
const RATIO = 780 / 520;

export type CardSize = keyof typeof WIDTH;

export function arcanumImage(n: number): string {
  return `/img/arcana/gen-${String(n).padStart(2, "0")}.webp`;
}

export default function ArcanumCard({
  n,
  size = "grid",
  eager = false,
  decorative = false,
}: {
  n: number;
  size?: CardSize;
  /** первый экран страницы: карту грузим сразу, иначе она мигает пустым местом */
  eager?: boolean;
  /** карта дублирует соседний текст — тогда скринридеру она не нужна */
  decorative?: boolean;
}) {
  const width = WIDTH[size];
  return (
    <img
      className={`arccard ${size}`}
      src={arcanumImage(n)}
      width={width}
      height={Math.round(width * RATIO)}
      alt={decorative ? "" : `Аркан ${n} — ${arcanumTitle(n)}`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
