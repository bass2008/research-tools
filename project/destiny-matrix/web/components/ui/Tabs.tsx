"use client";

import { usePathname, useRouter } from "next/navigation";

import { useUrlParam } from "@/lib/useUrlParam";
import type { ReactNode } from "react";

export interface Tab {
  key: string;
  title: string;
  body: ReactNode;
}

/** Вкладки рабочей области. Активная лежит в адресе (?tab=), поэтому обновление страницы и
 *  «Назад» с внутренней ссылки возвращают человека туда, где он был. */
export default function Tabs({ items, param = "tab" }: { items: Tab[]; param?: string }) {
  const router = useRouter();
  const path = usePathname();
  const wanted = useUrlParam(param);
  const current = items.find((t) => t.key === wanted) ?? items[0];

  function open(key: string) {
    const next = new URLSearchParams(window.location.search);
    if (key === items[0]?.key) next.delete(param);
    else next.set(param, key);
    const q = next.toString();
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  }

  // Стрелки — часть договора о вкладках: без них role="tab" обещает поведение, которого нет.
  function move(delta: number) {
    const at = items.findIndex((t) => t.key === current?.key);
    const next = items[(at + delta + items.length) % items.length];
    if (!next) return;
    open(next.key);
    const el = document.getElementById(`tab-${next.key}`);
    el?.focus();
  }

  return (
    <div className="tabs">
      <div className="tabbar" role="tablist">
        {items.map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={t.key === current?.key}
            aria-controls={`tabpanel-${t.key}`}
            tabIndex={t.key === current?.key ? 0 : -1}
            className={t.key === current?.key ? "tab on" : "tab"}
            onClick={() => open(t.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
              if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
              if (e.key === "Home") { e.preventDefault(); open(items[0].key); }
              if (e.key === "End") { e.preventDefault(); open(items[items.length - 1].key); }
            }}
          >
            {t.title}
          </button>
        ))}
      </div>
      {/* Все вкладки остаются в разметке: иначе со страницы пропадают ссылки на пары,
          позиции и год — вся перелинковка, ради которой они и собраны. */}
      {items.map((t) => (
        <div
          key={t.key}
          id={`tabpanel-${t.key}`}
          role="tabpanel"
          aria-labelledby={`tab-${t.key}`}
          className={t.key === current?.key ? "tabbody" : "tabbody off"}
        >
          {/* заголовок раздела в структуре документа: без него страница шла h1 → h3, и
              вкладки не читались как разделы ни поисковиком, ни скринридером */}
          <h2 className="vh">{t.title}</h2>
          {t.body}
        </div>
      ))}
    </div>
  );
}
