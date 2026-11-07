import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { D } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";
import { OUTER_COLORS } from "@/lib/octagramColors";
import { sharedHeadline, sharedPoints } from "@/lib/sharedHeadline";
import { readShared } from "../../../_lib/access";

const size = { width: 1200, height: 630 };

export const dynamic = "force-dynamic";

const ANGLES = [180, 225, -90, -45, 0, 45, 90, 135];
const BIG = [true, false, true, false, true, false, true, false];
const BOX = 460, C = BOX / 2, R = 178;
const at = (deg: number, r: number) => [C + r * Math.cos((deg * Math.PI) / 180), C + r * Math.sin((deg * Math.PI) / 180)];
const font = (name: string) => readFile(join(process.cwd(), "public/fonts/og", name));

function frame(): string {
  const oct = ANGLES.map((d) => at(d, R).map((v) => v.toFixed(1)).join(",")).join(" ");
  const diamond = [0, 90, 180, 270].map((d) => at(d, 102).map((v) => v.toFixed(1)).join(",")).join(" ");
  const square = [45, 135, 225, 315].map((d) => at(d, 102).map((v) => v.toFixed(1)).join(",")).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BOX}" height="${BOX}"><circle cx="${C}" cy="${C}" r="200" fill="none" stroke="#cfdde2" stroke-width="2"/><circle cx="${C}" cy="${C}" r="186" fill="none" stroke="#dde7ea" stroke-width="2"/><polygon points="${oct}" fill="none" stroke="#8399a8" stroke-width="3"/><polygon points="${diamond}" fill="none" stroke="#b3c2cc" stroke-width="2"/><polygon points="${square}" fill="none" stroke="#b3c2cc" stroke-width="2"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const L = await requestLocale();
  const row = await readShared((await params).token, L);
  const head = row ? sharedHeadline(row, L) : { title: D.report.sharedTitle[L], dates: "" };
  const points = row ? sharedPoints(row, L) : null;
  const [serif, bold, regular] = await Promise.all([font("cormorant-garamond-600.ttf"), font("manrope-700.ttf"), font("manrope-400.ttf")]);
  const node = (value: number, x: number, y: number, r: number, color: string, size: number) => (
    <div key={`${x}-${y}`} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, background: color,
      display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "Manrope", fontWeight: 700, fontSize: size }}>{value}</div>
  );
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #e3f1ef 0%, #eef2f4 45%, #e9eef7 100%)", padding: "0 70px 0 80px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 30 }}>
        <div style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#0e8f88", textTransform: "uppercase" }}>Arcana Sense</div>
        <div style={{ fontFamily: "Cormorant", fontSize: 66, lineHeight: 1.05, color: "#16243a", marginTop: 18 }}>{head.title}</div>
        {head.dates ? <div style={{ fontFamily: "Manrope", fontWeight: 700, fontSize: 36, color: "#3a4a60", marginTop: 22 }}>{head.dates}</div> : null}
        <div style={{ fontFamily: "Manrope", fontWeight: 400, fontSize: 22, color: "#7a8a99", marginTop: 40 }}>arcana-sense.ru</div>
      </div>
      {points ? (
        <div style={{ position: "relative", width: BOX, height: BOX, display: "flex" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frame()} width={BOX} height={BOX} style={{ position: "absolute", left: 0, top: 0 }} alt="" />
          {ANGLES.map((d, i) => { const [x, y] = at(d, R); return node(points[i], x, y, BIG[i] ? 32 : 26, OUTER_COLORS[i], BIG[i] ? 26 : 22); })}
          {node(points[8], C, C, 42, "#0e8f88", 34)}
        </div>
      ) : null}
    </div>,
    { ...size, headers: { "Cache-Control": "public, max-age=3600" }, fonts: [{ name: "Cormorant", data: serif, weight: 600, style: "normal" }, { name: "Manrope", data: bold, weight: 700, style: "normal" }, { name: "Manrope", data: regular, weight: 400, style: "normal" }] },
  );
}
