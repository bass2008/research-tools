"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { track } from "@/lib/analytics";
import { LANDING_SLIDES, type HeroSlide } from "@/lib/heroSlides";

import ArcanumCard from "@/components/matrix/ArcanumCard";
import Price from "@/components/pay/Price";

// Первый экран главной и энциклопедии: слева карусель композиций из колоды, справа виджет
// расчёта. Виджет приходит через children и не участвует в листании — он один и тот же.
const SLIDE_MS = 10_000;

const FAN = [2, 6, 10, 1, 14, 18, 21];
const RING = [1, 3, 6, 8, 13, 15, 18, 21];
const TAPE = [4, 7, 9, 11, 2, 6, 10, 1, 14, 18, 21, 13, 16, 20];
const MOSAIC = Array.from({ length: 32 }, (_, i) => (i % 22) + 1);

function Star() {
  return (
    <svg className="emb" viewBox="0 0 120 120" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <circle cx="60" cy="60" r="54" opacity=".35" />
        <circle cx="60" cy="60" r="44" opacity=".2" />
        <rect x="24" y="24" width="72" height="72" />
        <rect x="24" y="24" width="72" height="72" transform="rotate(45 60 60)" />
      </g>
      <g fill="currentColor">
        <circle cx="60" cy="60" r="4.5" />
        <circle cx="60" cy="6" r="2.4" />
        <circle cx="60" cy="114" r="2.4" />
        <circle cx="6" cy="60" r="2.4" />
        <circle cx="114" cy="60" r="2.4" />
      </g>
    </svg>
  );
}

function Seal({ monogram = false }: { monogram?: boolean }) {
  return (
    <svg className="emb" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1" opacity=".3" />
      <circle cx="60" cy="60" r="47" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <g stroke="currentColor" strokeWidth="1.1" opacity=".55">
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return (
            <line
              key={i}
              x1="60"
              y1="60"
              x2={(60 + 56 * Math.cos(a)).toFixed(1)}
              y2={(60 + 56 * Math.sin(a)).toFixed(1)}
            />
          );
        })}
      </g>
      <circle cx="60" cy="60" r="34" fill="var(--card)" />
      {monogram ? (
        <text
          x="60"
          y="72"
          textAnchor="middle"
          fontFamily="var(--ser)"
          fontSize="30"
          fontWeight="600"
          fill="currentColor"
        >
          AS
        </text>
      ) : null}
    </svg>
  );
}

function Rhomb() {
  return (
    <svg className="emb" viewBox="0 0 120 120" aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <path d="M60 4 116 60 60 116 4 60Z" strokeWidth="1.6" />
        <path d="M60 22 98 60 60 98 22 60Z" strokeWidth="1" opacity=".45" />
        <path d="M60 4V116M4 60H116" strokeWidth=".8" opacity=".3" />
      </g>
      <circle cx="60" cy="60" r="5" fill="currentColor" />
    </svg>
  );
}

function Fan({ eager }: { eager: boolean }) {
  const mid = (FAN.length - 1) / 2;
  return (
    <div className="fanwrap">
      {FAN.map((n, i) => {
        const off = i - mid;
        return (
          <i
            key={n}
            className="fanc"
            style={{
              left: `calc(50% + ${off * 62}px)`,
              transform: `translateX(-50%) rotate(${(off * 6.5).toFixed(1)}deg) translateY(${
                Math.abs(off) ** 2 * 3
              }px)`,
              zIndex: 20 - Math.round(Math.abs(off) * 2),
            }}
          >
            <ArcanumCard n={n} size="grid" decorative eager={eager} />
          </i>
        );
      })}
    </div>
  );
}

function Ring() {
  return (
    <div className="ringwrap">
      {RING.map((n, i) => {
        const a = ((-90 + (i * 360) / RING.length) * Math.PI) / 180;
        return (
          <i
            key={n}
            className="ringc"
            // радиус — переменная --r у .ringwrap: на узких экранах кольцо сжимается целиком,
            // и карты остаются внутри своего бокса
            style={{
              left: `calc(50% + var(--r) * ${Math.cos(a).toFixed(4)})`,
              top: `calc(50% + var(--r) * ${Math.sin(a).toFixed(4)})`,
              transform: `translate(-50%,-50%) rotate(${((i * 360) / RING.length).toFixed(0)}deg)`,
            }}
          >
            <ArcanumCard n={n} size="grid" decorative />
          </i>
        );
      })}
      <span className="ringcore">
        <Seal />
        <span className="rc-t">
          22
          <br />
          аркана
        </span>
      </span>
    </div>
  );
}

export default function CalcHero({
  slides = LANDING_SLIDES,
  h1 = true,
  place = "hero",
  children,
  below,
}: {
  /** пять надписей: своя на каждую композицию */
  slides?: HeroSlide[];
  /** заголовок первого слайда становится h1 страницы; на странице со своим h1 — false */
  h1?: boolean;
  place?: string;
  /** виджет расчёта: стоит вне карусели и не листается */
  children: ReactNode;
  /** что стоит под первым экраном внутри той же сетки — например, бесплатный разбор.
   *  Слот, а не флаг: страница, которой отчёт не нужен, просто его не передаёт. */
  below?: ReactNode;
}) {
  const path = usePathname();
  const total = slides.length;
  const [i, setI] = useState(0);
  const [live, setLive] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((next: number) => setI(((next % total) + total) % total), [total]);

  // Отсчёт перезапускается на каждой смене слайда: после ручного переключения следующий
  // приходит через полный интервал, а не через остаток прежнего.
  useEffect(() => {
    if (!live) return;
    // системная настройка «меньше движения» отключает автолистание: слайд меняется только руками
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    timer.current = setInterval(() => setI((v) => (v + 1) % total), SLIDE_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [live, total, i]);

  // Кнопка не должна вести туда, где человек уже стоит. Раньше сравнивался только путь, и на
  // /encyclopedia все ссылки вида «?sec=…» считались текущей страницей — три слайда подряд
  // предлагали один и тот же «Каталог матриц».
  function secondLink(s: HeroSlide) {
    const [href, query] = s.link.href.split("?");
    const here = href.replace(/\/$/, "") === path.replace(/\/$/, "");
    if (!here || query) return s.link;
    return { label: "Каталог матриц", href: "/matrix" };
  }

  function text(s: HeroSlide, k: number) {
    const heading =
      h1 && k === i ? <h1>{s.heading}</h1> : <div className="hero-h">{s.heading}</div>;
    return (
      <>
        <span className="eyebrow">{s.eyebrow}</span>
        {heading}
        <div className="btnrow">
          <Link
            className="btn gold"
            href="/#plans"
            onClick={() => track("buy_click", { place: `${place}-hero` })}
          >
            Купить полный разбор — <Price />
          </Link>
          <Link className="btn ghost" href={secondLink(s).href}>
            {secondLink(s).label}
          </Link>
        </div>
      </>
    );
  }

  function body(s: HeroSlide, k: number) {
    switch (k) {
      case 1:
        return (
          <div className="offer v-ring">
            <Ring />
            <div className="ringtext">{text(s, k)}</div>
          </div>
        );
      case 2:
        return (
          <div className="offer v-tri">
            <div className="trihead">
              <span className="rule" />
              <span className="triemb">
                <Rhomb />
              </span>
              <span className="rule" />
            </div>
            <div className="triwrap">
              <i className="tric">
                <ArcanumCard n={8} size="grid" decorative />
              </i>
              <i className="tric mid">
                <ArcanumCard n={1} size="grid" decorative />
              </i>
              <i className="tric">
                <ArcanumCard n={18} size="grid" decorative />
              </i>
            </div>
            {text(s, k)}
          </div>
        );
      case 3:
        return (
          <div className="offer v-tape">
            <div className="tapewrap">
              <div className="tape">
                {TAPE.map((n, j) => (
                  <i className="tapec" key={`${n}-${j}`}>
                    <ArcanumCard n={n} size="grid" decorative />
                  </i>
                ))}
              </div>
              <span className="tapemed">
                <Seal monogram />
              </span>
            </div>
            {text(s, k)}
          </div>
        );
      case 4:
        return (
          <div className="offer v-light">
            <div className="mosaic">
              {MOSAIC.map((n, j) => (
                <i className="mos" key={`${n}-${j}`}>
                  <ArcanumCard n={n} size="grid" decorative />
                </i>
              ))}
            </div>
            <div className="lightbody">
              <span className="demb">
                <Star />
              </span>
              {text(s, k)}
            </div>
          </div>
        );
      default:
        return (
          <div className="offer v-fan">
            <Fan eager={k === 0} />
            <div className="markline">
              <span className="eyebrow">{s.eyebrow}</span>
            </div>
            {h1 && k === i ? <h1>{s.heading}</h1> : <div className="hero-h">{s.heading}</div>}
            <div className="btnrow">
              <Link
                className="btn gold"
                href="/#plans"
                onClick={() => track("buy_click", { place: `${place}-hero` })}
              >
                Купить полный разбор — <Price />
              </Link>
              <Link className="btn ghost" href={secondLink(s).href}>
                {secondLink(s).label}
              </Link>
            </div>
          </div>
        );
    }
  }

  return (
    <section className="hero">
      <div className="wrap hgrid">
        {/* пауза только под курсором: остановка по фокусу глушила листание насовсем — после
            клика по точке кнопка оставалась в фокусе, и blur больше не приходил */}
        <div
          className="car"
          onMouseEnter={() => setLive(false)}
          onMouseLeave={() => setLive(true)}
          // Клавиатурный фокус тоже останавливает листание: иначе слайд с фокусом получал
          // inert, и фокус улетал в body посреди чтения. По клику мышью пауза не включается —
          // иначе после нажатия точки карусель вставала насовсем.
          onFocusCapture={(e) => {
            if ((e.target as HTMLElement).matches(":focus-visible")) setLive(false);
          }}
          onBlurCapture={(e) => {
            const next = e.relatedTarget as Node | null;
            if (!next || !e.currentTarget.contains(next)) setLive(true);
          }}
        >
          <div className="cview">
            <div className="ctrack" style={{ transform: `translateX(-${i * (100 / total)}%)` }}>
              {slides.map((s, k) => (
                <div className="slide" key={s.heading} aria-hidden={k !== i} inert={k !== i}>
                  {body(s, k)}
                </div>
              ))}
            </div>
          </div>
          <div className="cui">
            <div className="pips">
              {slides.map((s, k) => (
                <button
                  key={s.heading}
                  type="button"
                  className={k === i ? "pip on" : "pip"}
                  aria-label={`Показать: ${s.heading}`}
                  aria-current={k === i}
                  onClick={() => go(k)}
                />
              ))}
            </div>
            <div className="pair">
              <button type="button" className="arw" aria-label="Предыдущее" onClick={() => go(i - 1)}>
                ‹
              </button>
              <button type="button" className="arw" aria-label="Следующее" onClick={() => go(i + 1)}>
                ›
              </button>
            </div>
          </div>
        </div>

        {children}
        {below}
      </div>
    </section>
  );
}
