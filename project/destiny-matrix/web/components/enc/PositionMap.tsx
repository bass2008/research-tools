import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedMatrixMap, type MapPoint } from "@/lib/matrixMap";

export const forLocale = localized((L: Locale) => {
  const { MAP_CENTER, MAP_POINTS, mapXY } = localizedMatrixMap(L);

  // Схема карты с подсвеченной точкой. Отвечает на запрос «где находится визитка в матрице судьбы»
  // буквально — картинкой, а не фразой «внешняя точка A». Чисел здесь нет: они у каждого свои и
  // появляются после расчёта, а статья объясняет место, а не значение.

  // Размеры считаются в координатах viewBox 620, а на экране картинка ужимается до 520 px —
  // то есть каждый кегль делится примерно на 1,2. Меньше 13 в этой системе на телефоне
  // нечитаемо, поэтому подписи крупнее, чем кажется по числам.
  const SIZE = { big: 23, mid: 19, small: 15 } as const;

  const FONT = { big: 18, mid: 16, small: 13 } as const;

  function fmt(n: number): string {
    return n.toFixed(1);
  }
  return { MAP_CENTER, MAP_POINTS, mapXY, SIZE, FONT, fmt };
});

export default function PositionMap({ locale: requestedLocale, ...localeProps }: ({
  highlight: MapPoint[];
  caption: string;
}) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    highlight,
    caption,
  } = localeProps;
  const { MAP_CENTER, MAP_POINTS, mapXY, SIZE, FONT, fmt } = forLocale(L);

  if (!highlight.length) return null;
  const marked = new Set(highlight.map((p) => p.key));
  const names = highlight.map((p) => `${p.label} · ${p.symbol}`).join(", ");

  const ring = (radius: number, cls: string) => (
    <circle className={cls} cx={MAP_CENTER} cy={MAP_CENTER} r={radius} />
  );
  // Каркас считается по углам, а не по списку точек: на диагоналях внутреннего ромба точек нет
  // (там сидят R, R1 и R2 под своими углами), и поиск по совпадению угла возвращал undefined.
  const at = (angle: number, radius: number): [number, number] => {
    const a = (angle * Math.PI) / 180;
    return [MAP_CENTER + radius * Math.cos(a), MAP_CENTER + radius * Math.sin(a)];
  };
  const poly = (angles: number[], radius: number) =>
    angles.map((a) => at(a, radius).map(fmt).join(",")).join(" ");
  const octagon = poly([180, 225, -90, -45, 0, 45, 90, 135], 248);

  return (
    <figure className="posmap">
      <svg className="oct posmap-svg" viewBox="0 0 620 620" role="img" aria-label={D.octagram.mapAria[L](names)}>
        {ring(286, "ring")}
        {ring(270, "ring")}
        <polygon className="side" points={octagon} />
        <polygon className="diag" points={poly([-90, 0, 90, 180], 142)} />
        <polygon className="diag" points={poly([-45, 45, 135, 225], 142)} />
        {[180, 225, -90, -45].map((a) => {
          const [x1, y1] = at(a, 248);
          const [x2, y2] = at(a + 180, 248);
          return <line key={`ax${a}`} className="axis" x1={fmt(x1)} y1={fmt(y1)} x2={fmt(x2)} y2={fmt(y2)} />;
        })}
        {MAP_POINTS.map((p) => {
          const [x, y] = mapXY(p);
          const on = marked.has(p.key);
          return (
            <g key={p.key} className={on ? "spot on" : "spot"}>
              <title>{`${p.label} · ${p.symbol}`}</title>
              {on ? <circle className="halo" cx={fmt(x)} cy={fmt(y)} r={SIZE[p.size] + 9} /> : null}
              <circle cx={fmt(x)} cy={fmt(y)} r={SIZE[p.size]} />
              <text x={fmt(x)} y={fmt(y)} fontSize={FONT[p.size]}>
                {p.symbol}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
