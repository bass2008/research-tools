"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface SearchItem {
  href: string;
  title: string;
  hint: string;
  group: string;
}

export default function EncyclopediaSearch({ items }: { items: SearchItem[] }) {
  const [q, setQ] = useState("");
  const norm = q.trim().toLowerCase();

  const found = useMemo(() => {
    if (norm.length < 2) return [];
    return items
      .filter((i) => `${i.title} ${i.hint} ${i.group}`.toLowerCase().includes(norm))
      .slice(0, 24);
  }, [items, norm]);

  return (
    <div className="panel">
      <h3>Поиск по энциклопедии</h3>
      <div className="cap">Аркан, позиция карты, чакра или сочетание — например «14» или «деньги»</div>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Что ищем?"
        aria-label="Поиск по энциклопедии"
      />
      {norm.length >= 2 ? (
        found.length ? (
          <ul className="poslist" style={{ marginTop: 12 }}>
            {found.map((i) => (
              <li key={i.href}>
                <span className="lb">
                  <Link href={i.href}>{i.title}</Link> <span className="small">· {i.group}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small" style={{ marginTop: 12 }}>
            Ничего не нашлось. Попробуйте номер аркана или слово из названия раздела.
          </p>
        )
      ) : null}
    </div>
  );
}
