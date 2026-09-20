import { D, L } from "@/lib/i18n";
import { arcanumTitle } from "@/lib/arcana";
import { mapPoint } from "@/lib/matrixMap";
import { publicHref } from "@/lib/site";
import type { Matrix } from "@/lib/matrix";

// Геометрия перенесена из рукописного лендинга: viewBox 620×620, центр 310,
// внешний радиус 248, внутренний 142. Возрастная шкала идёт по кругу от запада
// по часовой стрелке — тем же порядком, что age_scale в движке.
const C = 310;
const R = 248;
const RIN = 142;

const CHAKRA_COLORS = ["#c9453a", "#dd7b2a", "#d9ac1e", "#159c69", "#1f9ed6", "#3f5ec9", "#8e5bc4"];

type NodeSpec = {
  angle: number;
  value: number;
  label: string;
  color: string;
  big?: boolean;
  /** только у точек второго порядка: они стоят не на общем радиусе своего круга */
  radius?: number;
};

function pt(angle: number, radius: number): [number, number] {
  const a = (angle * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

function fmt(n: number): string {
  return n.toFixed(1);
}

export default function Octagram({
  m,
  linked = true,
  printing = false,
}: {
  m: Matrix;
  linked?: boolean;
  /** В PDF относительный адрес указывает на внутренний хост службы печати: 12 кружков карты
   *  уезжали покупателю ссылками на `http://web:3000`. */
  printing?: boolean;
}) {
  const outer: NodeSpec[] = [
    { angle: 180, value: m.day, label: D.octagram.portrait[L], color: CHAKRA_COLORS[2], big: true },
    { angle: 225, value: m.father_line, label: D.octagram.fatherLine[L], color: CHAKRA_COLORS[5] },
    { angle: -90, value: m.month, label: D.octagram.spiritualTask[L], color: CHAKRA_COLORS[6], big: true },
    { angle: -45, value: m.mother_line, label: D.octagram.motherLine[L], color: CHAKRA_COLORS[5] },
    { angle: 0, value: m.year, label: D.octagram.materialTask[L], color: CHAKRA_COLORS[4], big: true },
    { angle: 45, value: m.descendants, label: D.octagram.descendants[L], color: CHAKRA_COLORS[3] },
    { angle: 90, value: m.mission, label: D.octagram.karmicTask[L], color: CHAKRA_COLORS[0], big: true },
    { angle: 135, value: m.inheritance, label: D.octagram.inheritance[L], color: CHAKRA_COLORS[1] },
  ];

  const inner: NodeSpec[] = [
    { angle: 180, value: m.comfort_west, label: D.octagram.innerLeft[L], color: "#7d92a1" },
    { angle: -90, value: m.comfort_north, label: D.octagram.talentPoint[L], color: "#7d92a1" },
    { angle: 0, value: m.comfort_east, label: D.octagram.moneyEntry[L], color: "#7d92a1" },
    { angle: 90, value: m.comfort_south, label: D.octagram.loveEntry[L], color: "#7d92a1" },
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
    const [x, y] = pt(spec.angle, spec.radius ?? radius);
    const title = D.octagram.nodeTitle[L](spec.label, spec.value, arcanumTitle(spec.value));
    const body = (
      <>
        <title>{title}</title>
        <circle cx={fmt(x)} cy={fmt(y)} r={size} fill={spec.color} />
        <text className={small ? "n sm" : "n"} x={fmt(x)} y={fmt(y)} fontSize={font}>
          {spec.value}
        </text>
      </>
    );
    return linked ? (
      <a
        key={key}
        href={printing
          ? publicHref(`/encyclopedia/arcanum/${spec.value}`)
          : `/encyclopedia/arcanum/${spec.value}`}
        aria-label={title}
      >
        {body}
      </a>
    ) : (
      <g key={key} aria-label={title}>
        {body}
      </g>
    );
  };

  const octagon = outer.map((o) => pt(o.angle, R).map(fmt).join(",")).join(" ");
  const square1 = [-90, 0, 90, 180].map((a) => pt(a, RIN).map(fmt).join(",")).join(" ");
  const square2 = [-45, 45, 135, 225].map((a) => pt(a, RIN).map(fmt).join(",")).join(" ");

  return (
    <svg
      className="oct"
      viewBox="0 0 620 620"
      role="img"
      aria-label={D.octagram.diagramAria[L]}
    >
      <circle className="ring" cx={C} cy={C} r={R + 38} />
      <circle className="ring" cx={C} cy={C} r={R + 22} />
      {ticks}
      <polygon className="side" points={octagon} />
      <polygon className="diag" points={square1} />
      <polygon className="diag" points={square2} />
      {[180, 225, -90, -45].map((a) => {
        const [x1, y1] = pt(a, R);
        const [x2, y2] = pt(a + 180, R);
        return <line key={`ax${a}`} className="axis" x1={fmt(x1)} y1={fmt(y1)} x2={fmt(x2)} y2={fmt(y2)} />;
      })}
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
        { angle: 0, value: m.center, label: D.octagram.centre[L], color: "#0e8f88" },
        0,
        31,
        23,
        "center",
      )}
    </svg>
  );
}
