"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, type ReactNode } from "react";

import { useUrlParam } from "@/lib/useUrlParam";
import {
  encyclopediaSectionFromPath,
  encyclopediaSectionHref,
  type EncyclopediaSectionKey,
  type EncyclopediaSectionMeta,
  type PositionSectionKey,
} from "@/lib/encyclopediaNavigation";

// Каркас справочника: карусель и меню разделов стоят на месте, меняется только рабочая область.
// Раздел на самой /encyclopedia переключается здесь же, на детальных страницах он выводится
// из адреса — меню всегда показывает, где мы находимся.
export interface EncSectionMeta extends EncyclopediaSectionMeta {
  count: number;
}

export default function EncFrame({
  sections,
  positionKinds,
  articlePaths = [],
  children,
}: {
  sections: EncSectionMeta[];
  /** ключ позиции → раздел: «Разделы отчёта» и «Позиции карты» лежат в одном роуте */
  positionKinds: Record<string, PositionSectionKey>;
  /** адреса статей-хабов: они вне /encyclopedia, но принадлежат разделу «Статьи» */
  articlePaths?: string[];
  children: ReactNode;
}) {
  const path = usePathname();
  const fromPath = useMemo(
    () => encyclopediaSectionFromPath(path, positionKinds, articlePaths),
    [path, positionKinds, articlePaths],
  );

  const wanted = useUrlParam("sec");
  const chosen = wanted && sections.some((x) => x.key === wanted)
    ? wanted as EncyclopediaSectionKey
    : null;
  // На самой /encyclopedia не подсвечено ничего: это оглавление разделов, а не рабочая область
  // одного из них. Раньше здесь по умолчанию вставал первый раздел, и меню утверждало, что
  // открыты «22 аркана», хотя на странице их списка нет.
  const active = fromPath ?? chosen;
  const standalone = fromPath !== null;

  const nav = useRef<HTMLElement | null>(null);
  // на узком экране меню свёрнуто в горизонтальную полосу: без этого активный пункт оставался
  // за кадром, и человек не видел, в каком разделе он находится
  useEffect(() => {
    const bar = nav.current;
    const on = bar?.querySelector(".enc-navi.on");
    if (!bar || !on) return;
    if (bar.scrollWidth <= bar.clientWidth) return;
    // двигаем саму полосу, а не страницу: scrollIntoView прокручивал документ на 270 px вниз
    // и срезал первый экран на телефоне
    const el = on as HTMLElement;
    const barRect = bar.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // offsetLeft относится к внешнему enc-layout и включает левый отступ всей полосы. Из-за
    // этого длинный активный пункт уезжал влево на 18–30 px. Считаем координату внутри nav.
    const relativeLeft = bar.scrollLeft + elRect.left - barRect.left;
    const wanted = relativeLeft - (bar.clientWidth - elRect.width) / 2;
    const max = Math.max(0, bar.scrollWidth - bar.clientWidth);
    bar.scrollLeft = Math.min(max, Math.max(0, wanted));
  }, [active]);

  return (
    <div className="enc-layout">
        <nav className="enc-nav" ref={nav} aria-label="Разделы справочника">
          {sections.map((s) =>
            standalone ? (
              <Link
                key={s.key}
                className={s.key === active ? "enc-navi on" : "enc-navi"}
                href={encyclopediaSectionHref(s.key)}
              >
                {s.title}
                <i>{s.count}</i>
              </Link>
            ) : (
              <a
                key={s.key}
                className={s.key === active ? "enc-navi on" : "enc-navi"}
                aria-current={s.key === active}
                href={encyclopediaSectionHref(s.key)}
              >
                {s.title}
                <i>{s.count}</i>
              </a>
            ),
          )}
        </nav>

      <div className="enc-panes">{children}</div>
    </div>
  );
}
