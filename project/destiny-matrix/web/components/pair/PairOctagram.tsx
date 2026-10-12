import { CHAKRA_COLORS, GREY, OctagramFrame, OctagramPoint, R, RIN } from "@/components/matrix/OctagramParts";
import type { Points, PointKey } from "@/lib/pair/engine";

const RMID = 195, RHALF = 71;

type Size = "s" | "i" | "m" | "b" | "c";
const SIZE: Record<Size, [number, number]> = { s: [13, 11], i: [15, 13], m: [19, 15.5], b: [24, 19], c: [31, 23] };

const NODES: Array<{ k: PointKey; angle: number; r: number; size: Size; color: string; muted?: boolean }> = [
  { k: "N", angle: 90, r: RMID, size: "s", color: GREY },
  { k: "O", angle: 180, r: RMID, size: "s", color: GREY },
  { k: "P", angle: -90, r: RMID, size: "s", color: GREY },
  { k: "Q", angle: 0, r: RMID, size: "s", color: GREY },
  { k: "S", angle: 180, r: RHALF, size: "s", color: GREY, muted: true },
  { k: "T", angle: -90, r: RHALF, size: "s", color: GREY, muted: true },
  { k: "R", angle: 45, r: RIN, size: "s", color: GREY },
  { k: "R1", angle: 67.5, r: RIN, size: "s", color: GREY },
  { k: "R2", angle: 22.5, r: RIN, size: "s", color: GREY },
  { k: "J", angle: 180, r: RIN, size: "i", color: GREY },
  { k: "K", angle: -90, r: RIN, size: "i", color: GREY },
  { k: "L", angle: 0, r: RIN, size: "i", color: GREY },
  { k: "M", angle: 90, r: RIN, size: "i", color: GREY },
  { k: "A", angle: 180, r: R, size: "b", color: CHAKRA_COLORS[2] },
  { k: "F", angle: 225, r: R, size: "m", color: CHAKRA_COLORS[5] },
  { k: "B", angle: -90, r: R, size: "b", color: CHAKRA_COLORS[6] },
  { k: "G", angle: -45, r: R, size: "m", color: CHAKRA_COLORS[5] },
  { k: "C", angle: 0, r: R, size: "b", color: CHAKRA_COLORS[4] },
  { k: "H", angle: 45, r: R, size: "m", color: CHAKRA_COLORS[3] },
  { k: "D", angle: 90, r: R, size: "b", color: CHAKRA_COLORS[0] },
  { k: "I", angle: 135, r: R, size: "m", color: CHAKRA_COLORS[1] },
  { k: "E", angle: 0, r: 0, size: "c", color: "#0e8f88" },
];

/** Карта партнёра или пары по буквам Лисовской; каждая точка ведёт к своему аркану. */
export default function PairOctagram({ m, label, title, href }: {
  m: Points;
  label: string;
  title: (n: number) => string;
  href?: (n: number) => string;
}) {
  return (
    <OctagramFrame label={label}>
      {NODES.map((n) => {
        const [size, font] = SIZE[n.size];
        return <OctagramPoint key={n.k} pointKey={n.k} angle={n.angle} radius={n.r} size={size} font={font}
          small={n.size === "s"} muted={n.muted} value={m[n.k]} color={n.color}
          title={`${label}: ${title(m[n.k])}`} href={href?.(m[n.k])} />;
      })}
    </OctagramFrame>
  );
}
