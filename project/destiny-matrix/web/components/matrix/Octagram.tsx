import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import type { Matrix } from "@/lib/matrix";
import { forLocale as localizedMatrixMap } from "@/lib/matrixMap";
import { forLocale as localizedSite } from "@/lib/site";
import chakraLevels from "@/lib/__fixtures__/chakras.json";
import { C, CHAKRA_COLORS, fmt, OctagramFrame, OctagramPoint, pt, R, RIN } from "./OctagramParts";

type NodeSpec = {
  pointKey: string;
  angle: number;
  value: number;
  label: string;
  color: string;
  big?: boolean;
  /** только у точек второго порядка: они стоят не на общем радиусе своего круга */
  radius?: number;
};

export const forLocale = localized((L: Locale, site) => {
  const { arcanumTitle } = localizedArcana(L);
  const { mapPoint } = localizedMatrixMap(L);
  const { publicHref } = localizedSite(L, site);

  return { arcanumTitle, mapPoint, publicHref };
});

export default function Octagram({ site = DEFAULT_SITE, locale: requestedLocale, ...localeProps }: ({
  m: Matrix;
  linked?: boolean;
  /** В PDF относительный адрес указывает на внутренний хост службы печати: 12 кружков карты
   *  уезжали покупателю ссылками на `http://web:3000`. */
  printing?: boolean;
}) & { locale?: Locale; site?: SiteProfile }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    m,
    linked = true,
    printing = false,
  } = localeProps;
  const { arcanumTitle, mapPoint, publicHref } = forLocale(L, site);

  const outer: NodeSpec[] = [
    { pointKey: "day", angle: 180, value: m.day, label: D.octagram.portrait[L], color: CHAKRA_COLORS[2], big: true },
    { pointKey: "father_line", angle: 225, value: m.father_line, label: D.octagram.fatherLine[L], color: CHAKRA_COLORS[5] },
    { pointKey: "month", angle: -90, value: m.month, label: D.octagram.spiritualTask[L], color: CHAKRA_COLORS[6], big: true },
    { pointKey: "mother_line", angle: -45, value: m.mother_line, label: D.octagram.motherLine[L], color: CHAKRA_COLORS[5] },
    { pointKey: "year", angle: 0, value: m.year, label: D.octagram.materialTask[L], color: CHAKRA_COLORS[4], big: true },
    { pointKey: "descendants", angle: 45, value: m.descendants, label: D.octagram.descendants[L], color: CHAKRA_COLORS[3] },
    { pointKey: "mission", angle: 90, value: m.mission, label: D.octagram.karmicTask[L], color: CHAKRA_COLORS[0], big: true },
    { pointKey: "inheritance", angle: 135, value: m.inheritance, label: D.octagram.inheritance[L], color: CHAKRA_COLORS[1] },
  ];

  const inner: NodeSpec[] = [
    { pointKey: "comfort_west", angle: 180, value: m.comfort_west, label: D.octagram.innerLeft[L], color: "#7d92a1" },
    { pointKey: "comfort_north", angle: -90, value: m.comfort_north, label: D.octagram.talentPoint[L], color: "#7d92a1" },
    { pointKey: "comfort_east", angle: 0, value: m.comfort_east, label: D.octagram.moneyEntry[L], color: "#7d92a1" },
    { pointKey: "comfort_south", angle: 90, value: m.comfort_south, label: D.octagram.loveEntry[L], color: "#7d92a1" },
  ];

  // Точки второго порядка — те, что метод считает из внутренних: середины линий любви, денег,
  // хвоста и таланта плюс чакровые пары аджны и анахаты. Их значения продукт и так показывает
  // в разделах и в таблице чакр, но на самой карте их не было — человек читал «10 под сердцем»
  // и не находил на схеме места, о котором речь. Координаты берутся из общей геометрии
  // (`lib/matrixMap`), чтобы карта здесь и схема в энциклопедии не разъехались.
  const chakra = (key: string) => m.chakras.find((row) => row.key === key);
  const derived: NodeSpec[] = ([
    ["karmic_tail_middle", m.karmic_tail[1]],
    ["money_love_crossing", m.love[2]],
    ["love_middle", m.love[1]],
    ["money_middle", m.money[1]],
    ["ajna_physics", chakra("ajna")?.physics],
    ["ajna_energy", m.talent[1]],
    ["anahata_physics", chakra("anahata")?.physics],
    ["anahata_energy", chakra("anahata")?.energy],
  ] as const)
    .map(([key, value]): NodeSpec | null => {
      const place = mapPoint(key);
      if (!place || value === undefined) return null;
      return {
        pointKey: key,
        angle: place.angle,
        radius: place.radius,
        value,
        label: `${place.label} · ${place.symbol}`,
        color: "#7d92a1",
      };
    })
    .filter((spec): spec is NodeSpec => spec !== null);

  const ticks = [];
  for (let i = 0; i < 80; i++) {
    const a = 180 + i * 4.5;
    const [x1, y1] = pt(a, R + 22);
    const [x2, y2] = pt(a, R + 29);
    ticks.push(
      <line
        key={`t${i}`}
        x1={fmt(x1)}
        y1={fmt(y1)}
        x2={fmt(x2)}
        y2={fmt(y2)}
        stroke="#b9c6ce"
        strokeWidth={i % 5 ? 0.6 : 1.2}
      />,
    );
    if (i % 10 === 0 && i) {
      // подпись возраста стоит дальше кружков (радиус 248 + 24): на узком экране шрифт крупнее,
      // и цифры наезжали на арканы внешнего круга
      const [tx, ty] = pt(a, R + 44);
      ticks.push(
        <text key={`a${i}`} className="age" x={fmt(tx)} y={fmt(ty)}>
          {i}
        </text>,
      );
    }
  }

  const node = (spec: NodeSpec, radius: number, size: number, font: number, key: string, small = false) => {
    const symbol = mapPoint(spec.pointKey)?.symbol;
    // Сопоставляем позиции по канону, а не одинаковые номера арканов в разных местах карты.
    const chakras = chakraLevels.filter((level) => level.physics === symbol || level.energy === symbol)
      .map((level) => level.key).join(" ");
    const href = `/encyclopedia/arcanum/${spec.value}`;
    return (
      <OctagramPoint key={key} pointKey={spec.pointKey} angle={spec.angle} radius={spec.radius ?? radius}
        size={size} font={font} small={small} value={spec.value} color={spec.color}
        title={D.octagram.nodeTitle[L](spec.label, spec.value, arcanumTitle(spec.value))}
        href={linked ? (printing ? publicHref(href) : href) : undefined}
        chakras={printing ? undefined : chakras} />
    );
  };

  return (
    <OctagramFrame label={D.octagram.diagramAria[L]} under={ticks}>
      {/* небо — вертикальная ось точек комфорта, земля — горизонтальная. Подписи «небо» стоят
          внутри квадрата: снаружи, на радиусе 195, теперь сидят точки P и N. */}
      <text className="lbl" x={C} y={C - RIN + 30}>
        {D.octagram.sky[L]}
      </text>
      <text className="lbl" x={C} y={C + RIN - 30}>
        {D.octagram.sky[L]}
      </text>
      <text className="lbl" x={C - RIN + 4} y={C - 30}>
        {D.octagram.earth[L]}
      </text>
      <text className="lbl" x={C + RIN - 4} y={C - 30}>
        {D.octagram.earth[L]}
      </text>
      {derived.map((s, i) => node(s, RIN, 13, 11, `d${i}`, true))}
      {inner.map((s, i) => node(s, RIN, 15, 13, `i${i}`))}
      {outer.map((s, i) => node(s, R, s.big ? 24 : 19, s.big ? 19 : 15.5, `o${i}`))}
      {node(
        { pointKey: "center", angle: 0, value: m.center, label: D.octagram.centre[L], color: "#0e8f88" },
        0,
        31,
        23,
        "center",
      )}
    </OctagramFrame>
  );
}
