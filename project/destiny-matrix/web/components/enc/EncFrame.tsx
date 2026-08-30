"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

import { useUrlParam } from "@/lib/useUrlParam";

// Каркас справочника: карусель и меню разделов стоят на месте, меняется только рабочая область.
// Раздел на самой /encyclopedia переключается здесь же, на детальных страницах он выводится
// из адреса — меню всегда показывает, где мы находимся.
export interface EncSectionMeta {
  key: string;
  title: string;
  count: number;
  hint: string;
}

const SEG_TO_SECTION: Record<string, string> = {
  arcanum: "arc",
  chakra: "chk",
  combination: "cmb",
  "karmic-tail": "tls",
};

interface Ctx {
  active: string;
  sections: EncSectionMeta[];
  /** на детальной странице списка нет: раздел показывает только меню */
  standalone: boolean;
}

const FrameCtx = createContext<Ctx | null>(null);

export function useEncFrame(): Ctx {
  const ctx = useContext(FrameCtx);
  if (!ctx) throw new Error("useEncFrame вне EncFrame");
  return ctx;
}

export default function EncFrame({
  sections,
  positionKinds,
  articlePaths = [],
  children,
}: {
  sections: EncSectionMeta[];
  /** ключ позиции → раздел: «Разделы отчёта» и «Позиции карты» лежат в одном роуте */
  positionKinds: Record<string, "sec" | "pts">;
  /** адреса статей-хабов: они вне /encyclopedia, но принадлежат разделу «Статьи» */
  articlePaths?: string[];
  children: ReactNode;
}) {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  const fromPath = useMemo(() => {
    if (articlePaths.includes(path)) return "art";
    if (parts[0] === "na-god") return "yer";
    if (parts[1] === "karmic-tail" && parts[2]) return "tls";
    if (parts[0] !== "encyclopedia") return null;
    if (parts.length === 1) return null;
    if (parts[1] === "position") return positionKinds[parts[2] ?? ""] ?? "sec";
    return SEG_TO_SECTION[parts[1]] ?? null;
  }, [parts, path, positionKinds, articlePaths]);

  const wanted = useUrlParam("sec");
  const chosen = wanted && sections.some((x) => x.key === wanted) ? wanted : null;
  const active = fromPath ?? chosen ?? sections[0]?.key ?? "arc";
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
    <FrameCtx.Provider value={{ active, sections, standalone }}>
      <div className="enc-layout">
        <nav className="enc-nav" ref={nav} aria-label="Разделы справочника">
          {sections.map((s) =>
            standalone ? (
              <Link
                key={s.key}
                className={s.key === active ? "enc-navi on" : "enc-navi"}
                href={`/encyclopedia?sec=${s.key}`}
              >
                {s.title}
                <i>{s.count}</i>
              </Link>
            ) : (
              <a
                key={s.key}
                className={s.key === active ? "enc-navi on" : "enc-navi"}
                aria-current={s.key === active}
                href={`/encyclopedia?sec=${s.key}`}
              >
                {s.title}
                <i>{s.count}</i>
              </a>
            ),
          )}
        </nav>

        <div className="enc-panes">{children}</div>
      </div>
    </FrameCtx.Provider>
  );
}

/** Рабочая область на самой /encyclopedia: показывает список выбранного раздела.
 *  Остальные разделы остаются в разметке скрытыми — иначе со страницы пропадают ссылки на
 *  пары, хвосты и год, а это вся внутренняя перелинковка справочника. */
export function EncSection({ sectionKey, children }: { sectionKey: string; children: ReactNode }) {
  const { active, sections } = useEncFrame();
  const meta = sections.find((s) => s.key === sectionKey);
  return (
    <section className={sectionKey === active ? "enc-pane on" : "enc-pane"}>
      {meta ? (
        <>
          <h2>{meta.title}</h2>
          <div className="cap">
            {meta.hint} · {meta.count}
          </div>
        </>
      ) : null}
      {children}
    </section>
  );
}
