"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  encyclopediaSection,
  encyclopediaSectionFromExternalRoot,
  encyclopediaSectionFromSegment,
  encyclopediaSectionHref,
} from "@/lib/encyclopediaNavigation";

// Путь показывается один раз, над каркасом: последний шаг выводится из адреса, поэтому
// детальные страницы не рисуют своих крошек.
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
    const section = encyclopediaSection("art");
    trail.push({ name: section.title, href: encyclopediaSectionHref(section.key) });
    trail.push({ name: articles[path] });
  } else if (encyclopediaSectionFromExternalRoot(parts[0])) {
    const section = encyclopediaSection(encyclopediaSectionFromExternalRoot(parts[0])!);
    trail.push({ name: section.title, href: encyclopediaSectionHref(section.key) });
    trail.push({
      name: /^\d{4}$/.test(parts[1]) ? `Матрица судьбы на ${parts[1]} год` : `${parts[1]} на год`,
    });
  } else if (positions[parts[1]]) {
    const key = parts[1];
    const pos = positions[key];
    const section = encyclopediaSection("sec");
    trail.push({ name: section.title, href: encyclopediaSectionHref(section.key) });
    if (pos) trail.push({ name: pos.title, href: `/encyclopedia/position/${key}` });
    if (parts[2]) trail.push({ name: parts[2] });
  } else if (parts[1] === "position") {
    const pos = positions[parts[2] ?? ""];
    const section = encyclopediaSection(pos?.kind ?? "sec");
    trail.push({ name: section.title, href: encyclopediaSectionHref(section.key) });
    if (pos) trail.push({ name: pos.title });
  } else if (parts[1] && encyclopediaSectionFromSegment(parts[1])) {
    const section = encyclopediaSection(encyclopediaSectionFromSegment(parts[1])!);
    trail.push({ name: section.title, href: encyclopediaSectionHref(section.key) });
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
