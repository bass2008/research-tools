// Колода лежит готовыми webp 520×780 в public/img/arcana — оптимизатор next/image не нужен,
// иначе standalone потребовал бы sharp и рантайм-обработку на той же виртуалке.
import { forLocale as localizedArcana } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";

const WIDTH = { big: 260, grid: 132, mini: 56 } as const;

export type CardSize = keyof typeof WIDTH;

export const forLocale = localized((L: Locale) => {
  const { arcanumTitle } = localizedArcana(L);

  // кадр обрезается снизу (см. .arccard в globals.css): подпись на самом изображении —
  // генеративный мусор, а имя аркана печатается рядом текстом
  const RATIO = 700 / 520;

  function arcanumImage(n: number, half = false): string {
    return `/img/arcana/${half ? "half/" : ""}gen-${String(n).padStart(2, "0")}.webp`;
  }
  return { arcanumTitle, WIDTH, RATIO, arcanumImage };
});

export const { arcanumImage } = forLocale(defaultLocale);

export default function ArcanumCard({ locale: requestedLocale, ...localeProps }: ({
  n: number;
  size?: CardSize;
  /** печать в PDF: карта вкладывается в файл целиком, поэтому берём половинный файл */
  half?: boolean;
  /** первый экран страницы: карту грузим сразу, иначе она мигает пустым местом */
  eager?: boolean;
  /** карта дублирует соседний текст — тогда скринридеру она не нужна */
  decorative?: boolean;
}) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    n,
    size = "grid",
    eager = false,
    decorative = false,
    half = false,
  } = localeProps;
  const { arcanumTitle, WIDTH, RATIO, arcanumImage } = forLocale(L);

  const width = WIDTH[size];
  return (
    <img
      className={`arccard ${size}`}
      src={arcanumImage(n, half)}
      width={width}
      height={Math.round(width * RATIO)}
      alt={decorative ? "" : D.octagram.cardAlt[L](n, arcanumTitle(n))}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
