// Факты о 97 хвостах пары для писателей статей: доля пар, сочетания личных хвостов, центр и ценности пары, учебные даты.
import { combine, computePair, personalPoints } from "../lib/pair/engine";
import { fold } from "../lib/matrix";
import { writeFileSync } from "node:fs";
const pad = (n: number) => String(n).padStart(2, "0");
type Rep = { p: any; n: number; date: string };
const reps = new Map<string, Rep>(); const byTail = new Map<string, Rep[]>(); const tailCount = new Map<string, number>();
const centers = new Set<number>(); let total = 0;
for (let y = 1900; y <= 2026; y++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= 31; d++) {
  const dt = new Date(Date.UTC(y, m - 1, d)); if (dt.getUTCMonth() !== m - 1) continue;
  if (y === 2026 && (m > 10 || (m === 10 && d > 26))) continue;
  const iso = `${y}-${pad(m)}-${pad(d)}`; const p = personalPoints(iso); total++; centers.add(p.E);
  const t = `${p.M}-${p.N}-${p.D}`; tailCount.set(t, (tailCount.get(t) ?? 0) + 1);
  const k = `${t}|${p.E}|${p.sky}|${p.ground}|${p.male}|${p.female}`;
  const r = reps.get(k); const good = y >= 1975 && y <= 2000;
  if (r) { r.n++; const rg = r.date >= "1975" && r.date <= "2001"; if (good && !rg) r.date = iso; }
  else { const nr = { p, n: 1, date: iso }; reps.set(k, nr); if (!byTail.has(t)) byTail.set(t, []); byTail.get(t)!.push(nr); }
}
const tails = [...tailCount.keys()]; const pairShare = new Map<string, number>();
const key = (a: string, b: string) => { const [am, an, ad] = a.split("-").map(Number), [bm, bn, bd] = b.split("-").map(Number); return `${fold(am + bm)}-${fold(an + bn)}-${fold(ad + bd)}`; };
for (const a of tails) for (const b of tails) { const k = key(a, b); pairShare.set(k, (pairShare.get(k) ?? 0) + tailCount.get(a)! * tailCount.get(b)!); }
const all = total * total; const ranked = [...pairShare.entries()].sort((x, y) => y[1] - x[1]);
const pc = [...centers].sort((a, b) => a - b);
const out: any = {};
for (const [T, share] of ranked) {
  const combos = new Map<string, number>(); const cen = new Map<number, number>(), sp = new Map<number, number>(); let w = 0, best = 0; let ex: any = null;
  for (const a of tails) for (const b of tails) {
    if (key(a, b) !== T) continue;
    const kk = [a, b].sort().join(" + "); combos.set(kk, (combos.get(kk) ?? 0) + tailCount.get(a)! * tailCount.get(b)!);
    for (const ra of byTail.get(a)!) for (const rb of byTail.get(b)!) {
      const p = combine(ra.p, rb.p); const ww = ra.n * rb.n; w += ww;
      cen.set(p.E, (cen.get(p.E) ?? 0) + ww); sp.set(p.spiritual, (sp.get(p.spiritual) ?? 0) + ww);
      const ok = ra.date >= "1975" && ra.date <= "2001" && rb.date >= "1975" && rb.date <= "2001";
      if (ok && ww > best) { best = ww; ex = [ra.date, rb.date]; }
    }
  }
  if (!ex) for (const a of tails) for (const b of tails) if (!ex && key(a, b) === T) ex = [byTail.get(a)![0].date, byTail.get(b)![0].date];
  const chk = computePair(ex[0], ex[1]); const ct = `${chk.p.M}-${chk.p.N}-${chk.p.D}`;
  if (ct !== T) throw new Error(`example mismatch ${T} ${ct}`);
  const [M, N, D] = T.split("-").map(Number);
  const needE = pc.filter((e) => fold(D + e) === M);
  const personal = tailCount.get(T) ?? 0;
  let why = "";
  if (!personal) {
    if (!needE.length) {
      const cand = Array.from({ length: 22 }, (_, i) => i + 1).filter((e) => fold(D + e) === M);
      why = cand.length
        ? `в личной матрице вход M = главная задача D + центр; чтобы при D = ${D} вход был ${M}, нужен центр ${cand.join(" или ")} — у человека такого центра не бывает`
        : `в личной матрице вход M = главная задача D + центр; при D = ${D} вход ${M} не получается ни при каком центре`;
    }
    else if (fold(M + D) !== N) why = `в личной матрице середина N = вход M + главная задача D (${M} + ${D} → ${fold(M + D)}), а здесь середина ${N}`;
    else why = "этой тройки нет среди личных хвостов движка";
  }
  const pct = (m: Map<number, number>) => [...m].sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, Math.round(1000 * v / w) / 10]);
  out[T] = {
    share: Math.round(100000 * share / all) / 1000, one_in: Math.round(all / share), rank: ranked.findIndex(([k]) => k === T) + 1,
    combos: [...combos].sort((x, y) => y[1] - x[1]).map(([k, v]) => [k, Math.round(100 * v / share)]),
    center: pct(cen), spiritual: pct(sp), example: ex, example_center: chk.p.E, example_spiritual: chk.p.spiritual,
    example_personal: [`${chk.a.M}-${chk.a.N}-${chk.a.D}`, `${chk.b.M}-${chk.b.N}-${chk.b.D}`],
    personal_dates: personal, why_not_personal: why, middle_is_sum: fold(M + D) === N,
    perms: ranked.map(([k]) => k).filter((k) => k !== T && k.split("-").sort().join() === T.split("-").sort().join()),
  };
}
writeFileSync(process.argv[2], JSON.stringify({ total_dates: total, personal_centers: pc, tails: out }, null, 1));
console.log("tails", Object.keys(out).length);
