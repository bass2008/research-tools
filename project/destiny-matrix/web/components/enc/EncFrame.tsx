"use client";

import { useLocale } from "@/components/ui/LocaleProvider";
import {
  forLocale as localizedEncyclopediaNavigation,
  type EncyclopediaSectionKey,
  type EncyclopediaSectionMeta,
  type PositionSectionKey
} from "@/lib/encyclopediaNavigation";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { useUrlParam } from "@/lib/useUrlParam";
import Link from "@/components/ui/LocalizedLink";
import LocalizedAnchor from "@/components/ui/LocalizedAnchor";
import { splitPublicPath } from "@/lib/publicRouting";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";

// Каркас справочника: карусель и меню разделов стоят на месте, меняется только рабочая область.
// Раздел на самой /encyclopedia переключается здесь же, на детальных страницах он выводится
// из адреса — меню всегда показывает, где мы находимся.
export interface EncSectionMeta extends EncyclopediaSectionMeta {
  count: number;
}

interface TocItem {
  id: string;
  title: string;
}

export const forLocale = localized((L: Locale) => {
  const { encyclopediaSectionFromPath, encyclopediaSectionHref } = localizedEncyclopediaNavigation(L);

  return { encyclopediaSectionFromPath, encyclopediaSectionHref };
});

export default function EncFrame({ locale: requestedLocale, ...localeProps }: ({
  sections: EncSectionMeta[];
  /** ключ позиции → раздел: «Разделы отчёта» и «Позиции карты» лежат в одном роуте */
  positionKinds: Record<string, PositionSectionKey>;
  /** адреса статей-хабов: они вне /encyclopedia, но принадлежат разделу «Статьи» */
  articlePaths?: string[];
  children: ReactNode;
}) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const {
    sections,
    positionKinds,
    articlePaths = [],
    children,
  } = localeProps;
  const { encyclopediaSectionFromPath, encyclopediaSectionHref } = forLocale(L);

  const path = splitPublicPath(usePathname()).path;
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

  const [toc, setToc] = useState<TocItem[] | null>(null);
  const [pane, setPane] = useState<"enc" | "art">("enc");
  const [current, setCurrent] = useState(-1);
  const reading = useRef<boolean | null>(null);
  const panes = useRef<HTMLDivElement | null>(null);

  // Оглавление собирается из заголовков самой статьи (TocHeading) и следует за ними: статья
  // меняется не только с адресом, но и при переключении языка на месте. Показывать ли вкладки,
  // решает разметка data-toc-root ещё на сервере — через CSS.
  useEffect(() => {
    const box = panes.current;
    if (!box) return;
    let frame = 0;
    const collect = () => {
      frame = 0;
      const heads = box.querySelector("[data-toc-root]") ? [...box.querySelectorAll<HTMLElement>("[data-toc]")] : [];
      const next = heads.map((head) => ({ id: head.id, title: head.textContent?.trim() ?? "" }));
      setToc((prev) => {
        const same = (prev?.length ?? 0) === next.length
          && next.every((item, i) => item.id === prev![i].id && item.title === prev![i].title);
        return same ? prev : next.length ? next : null;
      });
    };
    collect();
    const watch = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(collect); });
    watch.observe(box, { childList: true, subtree: true, characterData: true });
    return () => {
      watch.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    reading.current = null;
    setPane("enc");
    setCurrent(-1);
  }, [path]);

  // Пока читают статью, меню само переключается на её оглавление, а у начала страницы —
  // обратно на энциклопедию. Ручной выбор вкладки держится до следующего такого перехода.
  useEffect(() => {
    if (!toc) return;
    reading.current = null;
    let frame = 0;
    const track = () => {
      frame = 0;
      const line = innerHeight * 0.3;
      const heads = toc.map((item) => document.getElementById(item.id));
      let at = -1;
      heads.forEach((head, i) => { if (head && head.getBoundingClientRect().top < line) at = i; });
      setCurrent(at);
      const first = heads[0];
      const now = !!first && first.getBoundingClientRect().top < innerHeight * 0.6;
      if (now !== reading.current) {
        reading.current = now;
        setPane(now ? "art" : "enc");
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(track); };
    track();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [toc]);

  // Обычный переход по якорю добавляет запись истории без состояния роутера Next.js: «Назад» со
  // следующей страницы менял адрес, но оставлял её содержимое. Якорь меняем на месте.
  const jump = (e: MouseEvent, id: string) => {
    const head = document.getElementById(id);
    if (!head || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    head.scrollIntoView();
    history.replaceState(history.state, "", `#${id}`);
  };

  const tocList = useRef<HTMLOListElement | null>(null);
  // длинное оглавление прокручивается внутри меню: текущий раздел держим в поле зрения
  useEffect(() => {
    const list = tocList.current;
    const box = list?.closest("nav");
    const on = list?.querySelector<HTMLElement>("a.on");
    if (!box || !on || box.scrollHeight <= box.clientHeight) return;
    const a = on.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    if (a.top < b.top + 60 || a.bottom > b.bottom - 20) box.scrollTo({ top: box.scrollTop + a.top - b.top - b.height / 3 });
  }, [current, pane]);

  const nav = useRef<HTMLDivElement | null>(null);
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
    // A translation changes the widths of the preceding items while the active
    // section stays the same. Re-center it after switching language as well.
  }, [active, L]);

  const cats = sections.map((s) =>
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
      <LocalizedAnchor
        key={s.key}
        className={s.key === active ? "enc-navi on" : "enc-navi"}
        aria-current={s.key === active}
        href={encyclopediaSectionHref(s.key)}
      >
        {s.title}
        <i>{s.count}</i>
      </LocalizedAnchor>
    ),
  );

  return (
    <div className="enc-layout">
      <nav className="enc-nav" data-pane={pane} aria-label={D.octagram.encNavAria[L]}>
        <div className="enc-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={pane === "enc"}
            onClick={() => setPane("enc")}>{D.enc.navEncyclopedia[L]}</button>
          <button type="button" role="tab" aria-selected={pane === "art"}
            onClick={() => setPane("art")}>{D.enc.navThisArticle[L]}</button>
        </div>
        <div className="enc-cats" ref={nav} hidden={pane === "art"}>{cats}</div>
        <ol className="enc-toc" ref={tocList} hidden={pane !== "art"} aria-label={D.enc.navTocAria[L]}>
          {(toc ?? []).map((item, i) => (
            <li key={item.id}>
              <a href={`#${item.id}`} className={i === current ? "on" : i < current ? "done" : undefined}
                aria-current={i === current ? "location" : undefined} onClick={(e) => jump(e, item.id)}>{item.title}</a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="enc-panes" ref={panes}>{children}</div>
    </div>
  );
}
