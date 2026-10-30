import LocalizedAnchor from "@/components/ui/LocalizedAnchor";
import type { CSSProperties, ReactNode } from "react";
import styles from "./ChakraMapHover.module.css";

// Геометрия перенесена из рукописного лендинга: viewBox 620×620, центр 310, внешний радиус 248,
// внутренний 142. Одна на личную схему, карты партнёров и карту пары.
export const C = 310;
export const R = 248;
export const RIN = 142;
export const CHAKRA_COLORS = ["#c9453a", "#dd7b2a", "#d9ac1e", "#159c69", "#1f9ed6", "#3f5ec9", "#8e5bc4"];
export const GREY = "#7d92a1";

export function pt(angle: number, radius: number): [number, number] {
  const a = (angle * Math.PI) / 180;
  return [C + radius * Math.cos(a), C + radius * Math.sin(a)];
}

export const fmt = (n: number) => n.toFixed(1);

export function OctagramFrame({ label, under, children }: { label: string; under?: ReactNode; children: ReactNode }) {
  const outer = [180, 225, -90, -45, 0, 45, 90, 135];
  const poly = (angles: number[], radius: number) => angles.map((a) => pt(a, radius).map(fmt).join(",")).join(" ");
  return (
    <svg className="oct" viewBox="0 0 620 620" role="img" aria-label={label}>
      <circle className="ring" cx={C} cy={C} r={R + 38} />
      <circle className="ring" cx={C} cy={C} r={R + 22} />
      {under}
      <polygon className="side" points={poly(outer, R)} />
      <polygon className="diag" points={poly([-90, 0, 90, 180], RIN)} />
      <polygon className="diag" points={poly([-45, 45, 135, 225], RIN)} />
      {[180, 225, -90, -45].map((a) => {
        const [x1, y1] = pt(a, R);
        const [x2, y2] = pt(a + 180, R);
        return <line key={`ax${a}`} className="axis" x1={fmt(x1)} y1={fmt(y1)} x2={fmt(x2)} y2={fmt(y2)} />;
      })}
      {children}
    </svg>
  );
}

/** Точка схемы: кружок с числом; со ссылкой — переход к аркану, как у всех карт сайта. */
export function OctagramPoint({ angle, radius, size, font, value, color, title, href, small = false, muted = false,
  pointKey, chakras }: {
  angle: number; radius: number; size: number; font: number; value: number; color: string; title: string;
  href?: string; small?: boolean; muted?: boolean; pointKey: string;
  /** чакры, строки которых подсвечивают точку при наведении на атлас */
  chakras?: string;
}) {
  const [x, y] = pt(angle, radius);
  const props = {
    className: styles.node,
    style: { "--point-color": color } as CSSProperties,
    "data-map-point": pointKey,
    "data-map-chakras": chakras || undefined,
    "data-muted": muted || undefined,
  };
  const body = (
    <>
      <title>{title}</title>
      {chakras ? <circle className={styles.halo} data-chakra-halo="true" cx={fmt(x)} cy={fmt(y)} r={size + 7} aria-hidden="true" /> : null}
      <circle cx={fmt(x)} cy={fmt(y)} r={size} fill={color} />
      <text className={small ? "n sm" : "n"} x={fmt(x)} y={fmt(y)} fontSize={font}>{value}</text>
    </>
  );
  return href ? <LocalizedAnchor href={href} aria-label={title} {...props}>{body}</LocalizedAnchor> : <g aria-label={title} {...props}>{body}</g>;
}
