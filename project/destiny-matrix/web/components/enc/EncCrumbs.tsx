"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Путь показывается один раз, над каркасом: последний шаг выводится из адреса, поэтому
// детальные страницы не рисуют своих крошек.
const SECTION: Record<string, { title: string; sec: string }> = {
  arcanum: { title: "22 аркана", sec: "arc" },
  chakra: { title: "Семь чакр", sec: "chk" },
  combination: { title: "Сочетания арканов", sec: "cmb" },
  "karmic-tail": { title: "Кармические хвосты", sec: "tls" },
};

export default function EncCrumbs({
  arcana,
  positions,
  chakras,
  articles,
}: {
  arcana: string[];
  positions: Record<string, { title: string; kind: "sec" | "pts" }>;
  chakras: Record<string, string>;
  /** адрес статьи-хаба → её заголовок */
  articles: Record<string, string>;
}) {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  const trail: { name: string; href?: string }[] = [
    { name: "Главная", href: "/" },
    { name: "Энциклопедия", href: "/encyclopedia" },
  ];

  if (articles[path]) {
    trail.push({ name: "Статьи", href: "/encyclopedia?sec=art" });
    trail.push({ name: articles[path] });
  } else if (parts[0] === "na-god") {
    trail.push({ name: "Матрица судьбы на год", href: "/encyclopedia?sec=yer" });
    trail.push({
      name: /^\d{4}$/.test(parts[1]) ? `Матрица судьбы на ${parts[1]} год` : `${parts[1]} на год`,
    });
  } else if (parts[1] === "position") {
    const pos = positions[parts[2] ?? ""];
    const sec = pos?.kind === "pts" ? "Позиции карты" : "Разделы отчёта";
    trail.push({ name: sec, href: `/encyclopedia?sec=${pos?.kind ?? "sec"}` });
    if (pos) trail.push({ name: pos.title });
  } else if (parts[1] && SECTION[parts[1]]) {
    const { title, sec } = SECTION[parts[1]];
    trail.push({ name: title, href: `/encyclopedia?sec=${sec}` });
    const slug = parts[2];
    if (slug) {
      if (parts[1] === "arcanum") {
        const n = Number(slug);
        trail.push({ name: `${n} · ${arcana[n - 1] ?? ""}`.trim() });
      } else if (parts[1] === "combination") {
        trail.push({ name: slug.replace("-", " и ") });
      } else if (parts[1] === "chakra") {
        trail.push({ name: chakras[slug] ?? slug });
      } else {
        trail.push({ name: slug });
      }
    }
  }

  return (
    <p className="crumbs enc-crumbs">
      {trail.map((c, i) => (
        <span key={`${c.name}-${i}`} className="crumb">
          {i > 0 ? <span className="csep">/</span> : null}
          {c.href && i < trail.length - 1 ? <Link href={c.href}>{c.name}</Link> : <span>{c.name}</span>}
        </span>
      ))}
    </p>
  );
}
