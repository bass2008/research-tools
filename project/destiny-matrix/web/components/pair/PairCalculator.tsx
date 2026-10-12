"use client";

import { useSession } from "@/components/account/useSession";
import CalcHero from "@/components/matrix/CalcHero";
import { useOfferMode } from "@/components/pay/useOfferMode";
import { useLocale } from "@/components/ui/LocaleProvider";
import { track } from "@/lib/analytics";
import { forLocale as localizedApi, type ReadingItem } from "@/lib/api";
import type { HeroSlide } from "@/lib/heroSlides";
import { useHydrated } from "@/lib/hydrated";
import { useMessage } from "@/lib/i18n/useMessage";
import { D } from "@/lib/i18n";
import { DP } from "@/lib/i18n/dict/pair";
import { forLocale as localizedMatrix, MatrixError } from "@/lib/matrix";
import { BUSINESS_FREE, businessMatrix, businessPoints, businessUnitKeys } from "@/lib/pair/business";
import { pairChakraKeys } from "@/lib/pair/chakraReading";
import { computePair, personalPoints, type PairResult } from "@/lib/pair/engine";
import { unitKeys, visible, type PairUnit } from "@/lib/pair/spheres";
import { pairTitle } from "@/lib/pair/title";
import { savePair, type StoredPair } from "@/lib/storage";
import { forLocale as localizedTariffs, type Tariff } from "@/lib/tariffs";
import { browserDay, exampleDay } from "@/lib/today";
import { usePair } from "@/lib/usePair";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import DateFields from "@/components/matrix/DateFields";
import SavePdfButton from "@/components/matrix/SavePdfButton";
import { buyHref } from "@/lib/readingLinks";
import Plans from "@/components/pay/Plans";
import PairReport from "./PairReport";
import styles from "./Pair.module.css";

const PREVIEW = ["A", "B", "E", "M", "N", "D", "spiritual"] as const;

interface Fields { name: string; day: number; month: number; year: number }
type FormState = { a: Fields; b: Fields };

function fields(birth: string, name?: string): Fields {
  const [year, month, day] = birth.split("-").map(Number);
  return { name: name ?? "", day, month, year };
}

// Первый экран и форма — как на главной: карусель слева, форма справа, до первого расчёта в
// форме даты примера, а под ними сам пример с замками и без покупки. Тексты примера сервер
// кладёт в HTML страницы.
/** Своя пара из кабинета, выбранная сервером: открывается сразу, как «Мой разбор» открывает свою матрицу. */
export interface MinePair {
  id: number;
  pair: StoredPair;
  unlocked: boolean;
  units: Record<string, PairUnit | null>;
}

const datesKey = (a?: string, b?: string) => [a, b].sort().join("|");

export default function PairCalculator({ example, mine = null, top, lead, sells = true }: {
  example: { a: string; b: string; units: Record<string, PairUnit | null> };
  /** в регионе есть способ оплаты: иначе кнопок покупки нет */
  sells?: boolean;
  mine?: MinePair | null;
  top?: ReactNode;
  lead?: string;
}) {
  const L = useLocale();
  const stored = usePair();
  const hydrated = useHydrated();
  const shown = stored ?? mine?.pair ?? null;
  const isExample = !shown;
  const pair: StoredPair = shown ?? {
    a: { birth: example.a, name: DP.partnerA[L] },
    b: { birth: example.b, name: DP.partnerB[L] },
  };
  const [draft, setDraft] = useState<FormState | null>(null);
  const [namesShown, setNamesShown] = useState(false);
  const [error, setError] = useMessage(L);
  const [units, setUnits] = useState<Record<string, PairUnit | null>>({});
  const [price, setPrice] = useState<string | null>(null);
  const form: FormState = draft ?? {
    a: fields(shown?.a.birth ?? example.a, shown?.a.name),
    b: fields(shown?.b.birth ?? example.b, shown?.b.name),
  };
  const { daysInMonth, toIso } = localizedMatrix(L);
  // имена свёрнуты: в форме только даты, как на главной; у пары с именами поля открыты сразу
  const namesOpen = namesShown || Boolean(form.a.name || form.b.name);
  // верхний год в HTML — от даты корпуса, после гидратации — фактический, как на главной
  const maxYear = hydrated ? browserDay().year : exampleDay().year;
  const session = useSession();
  const signedIn = session.status === "user";
  const unlimited = useOfferMode("pair") !== "sell";
  const router = useRouter();
  const [owned, setOwned] = useState<ReadingItem[]>([]);
  const [opening, setOpening] = useState(false);

  // Купленную пару и подписку человек открывает отсюда же: иначе кнопка вела бы на оплату,
  // а там — отказ «уже открыт».
  useEffect(() => {
    if (!signedIn) {
      setOwned([]);
      return;
    }
    localizedApi(L).api.readings("pair").then((res) => setOwned(res.items)).catch(() => setOwned([]));
  }, [signedIn, L]);

  const result: PairResult | null = useMemo(() => {
    try {
      return computePair(pair.a.birth, pair.b.birth, L);
    } catch {
      return null;
    }
  }, [pair.a.birth, pair.b.birth, L]);

  // Подписчику полный разбор виден сразу, и у примера тоже: тексты приходят по ключам юнитов.
  const biz = useMemo(() => (result ? businessPoints(businessMatrix(pair.a.birth, pair.b.birth, L)) : null),
    [result, pair.a.birth, pair.b.birth, L]);
  const fullKeys = result && biz && unlimited
    ? [...new Set([
      ...visible(result.a, result.b).flatMap((s) => unitKeys(s, result.a, result.b, result.p)),
      ...businessUnitKeys(biz),
      ...pairChakraKeys(L, { a: pair.a.birth, b: pair.b.birth }),
    ])].join(",")
    : "";
  const [full, setFull] = useState<{ keys: string; units: Record<string, PairUnit | null> } | null>(null);
  useEffect(() => {
    if (!fullKeys) return;
    let alive = true;
    fetch(`/api/pair/units?keys=${encodeURIComponent(fullKeys)}`, { headers: { "Accept-Language": L } })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (alive && body?.units) setFull({ keys: fullKeys, units: body.units as Record<string, PairUnit | null> });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fullKeys, L]);
  const fullUnits = fullKeys && full?.keys === fullKeys ? full.units : null;

  // Пара, которая уже есть в кабинете, открывается здесь же, а не кнопкой «Открыть разбор».
  const subject = datesKey(pair.a.birth, pair.b.birth);
  const mineHere = mine && datesKey(mine.pair.a.birth, mine.pair.b.birth) === subject ? mine : null;
  const ownedRow = owned.find((row) => datesKey((row.inputs.a as { birth?: string } | undefined)?.birth,
    (row.inputs.b as { birth?: string } | undefined)?.birth) === subject) ?? null;
  const openId = mineHere?.unlocked ? mineHere.id : ownedRow && ownedRow.access !== "locked" ? ownedRow.id : null;
  const savedId = mineHere?.id ?? ownedRow?.id ?? null;
  const serverUnits = mineHere?.unlocked && mineHere.id === openId ? mineHere.units : null;
  const [ownUnits, setOwnUnits] = useState<{ id: number; units: Record<string, PairUnit | null> } | null>(null);
  useEffect(() => {
    if (!openId || serverUnits) return;
    let alive = true;
    fetch(`/api/pair/reading-units?id=${openId}`, { headers: { "Accept-Language": L } })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (alive && body?.units) setOwnUnits({ id: openId, units: body.units as Record<string, PairUnit | null> });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [openId, serverUnits, L]);
  const openUnits = serverUnits ?? (openId && ownUnits?.id === openId ? ownUnits.units : null);

  const query = result && biz && !isExample
    ? [...PREVIEW.map((k) => `${k}=${result.p[k]}`), ...BUSINESS_FREE.map((id) => `${id}=${biz[id]}`)].join("&")
    : "";
  useEffect(() => {
    if (!query) return;
    let alive = true;
    fetch(`/api/pair/preview?${query}`, { headers: { "Accept-Language": L } })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (alive && body?.units) setUnits(body.units as Record<string, PairUnit | null>);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [query, L]);

  useEffect(() => {
    let alive = true;
    fetch("/api/tariffs?product=pair", { cache: "no-store", headers: { "Accept-Language": L } })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const offer = (body?.items as Tariff[] | undefined)?.find((t) => t.id === "pair");
        if (alive && offer) setPrice(localizedTariffs(L).priceLabel(offer));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [L]);

  const field = (who: "a" | "b", key: keyof Fields, value: string | number) => {
    setError(null);
    setDraft({ ...form, [who]: { ...form[who], [key]: value } });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = {} as StoredPair;
    for (const [who, label] of [["a", DP.first], ["b", DP.second]] as const) {
      const { name, day, month, year } = form[who];
      const maxDay = daysInMonth(year, month);
      if (day > maxDay) {
        setError((locale) => {
          const why = D.calc.tooManyDays[locale](maxDay);
          return DP.dateError[locale](label[locale], why[0].toLowerCase() + why.slice(1));
        });
        return;
      }
      const birth = toIso({ year, month, day });
      try {
        personalPoints(birth, L);
      } catch (err) {
        setError((locale) => DP.dateError[locale](label[locale], err instanceof MatrixError ? err.messageFor(locale) : String(err)));
        return;
      }
      next[who] = { birth, name: name.trim() || undefined };
    }
    savePair(next);
    setDraft(null);
    track("pair_calc");
  };

  const partner = (who: "a" | "b", title: string) => (
    <div className={styles.who}>
      <p className={styles.whoT}>{title}</p>
      {namesOpen ? (
        <div className={styles.whoName}>
          <label htmlFor={`pair-${who}-name`}>{DP.name[L]} <span className={styles.opt}>· {DP.optional[L]}</span></label>
          <input id={`pair-${who}-name`} name={`${who}-name`} type="text" maxLength={60} value={form[who].name}
            onChange={(e) => field(who, "name", e.target.value)} disabled={!hydrated} />
        </div>
      ) : null}
      <DateFields locale={L} id={(part) => `pair-${who}-${part}`} testId={(part) => `pair-${who}-${part}`}
        value={form[who]} maxYear={maxYear} disabled={!hydrated} onChange={(part, value) => field(who, part, value)} />
    </div>
  );

  const calculator = (
    <form className="form" onSubmit={submit} autoComplete="off" noValidate id="pair-form" data-testid="pair-form">
      <h2 className="fh2">{DP.formTitle[L]}</h2>
      <div className="sub">{DP.formHint[L]}</div>
      {partner("a", DP.first[L])}
      {partner("b", DP.second[L])}
      {namesOpen ? null : (
        <button type="button" className={`linkbtn ${styles.addNames}`} disabled={!hydrated} data-testid="pair-add-names"
          onClick={() => {
            setNamesShown(true);
            requestAnimationFrame(() => document.getElementById("pair-a-name")?.focus());
          }}>
          + {DP.addNames[L]}
        </button>
      )}
      <button className={`btn wide ${styles.submit}`} type="submit" disabled={!hydrated} data-testid="pair-submit">
        {hydrated ? DP.submit[L] : D.calc.submitWaiting[L]}
      </button>
      {error ? <div className="err" role="alert" aria-live="assertive">{error}</div> : null}
    </form>
  );

  const slides: HeroSlide[] = DP.slides.map((s) => ({
    eyebrow: s.eyebrow[L],
    heading: s.heading[L],
    link: { label: s.link[L], href: s.href },
  }));
  // форма стоит рядом с кнопкой на компьютере и под каруселью на телефоне: кнопка ведёт к ней
  const toForm = (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById("pair-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById("pair-a-d")?.focus({ preventScroll: true });
  };
  const hero = (below?: ReactNode) => (
    <CalcHero locale={L} slides={slides} place="pair" top={top} lead={lead} below={below}
      action={<a className="btn gold" href="#pair-form" onClick={toForm}>{DP.submit[L]}</a>}>
      {calculator}
    </CalcHero>
  );

  if (!result) return hero();

  const openSaved = async () => {
    setOpening(true);
    setError(null);
    try {
      const row = await localizedApi(L).api.saveReading("pair", pair);
      router.push(`/readings/${row.id}`);
    } catch {
      setOpening(false);
      setError(DP.openFailed);
    }
  };
  const open = isExample || openId ? undefined : unlimited ? (
    <button type="button" className={`${styles.btn} ${styles.btnGold}`} onClick={openSaved} disabled={opening}
      data-testid="pair-open">{opening ? DP.opening[L] : fullUnits ? DP.saveToAccount[L] : DP.openFull[L]}</button>
  ) : undefined;

  return hero(
    <div id="result">
      <PairReport
      locale={L}
      result={result}
      title={pairTitle(L, pair.a, pair.b)}
      names={{ a: pair.a.name || DP.partnerA[L], b: pair.b.name || DP.partnerB[L] }}
      dates={{ a: pair.a.birth, b: pair.b.birth }}
      units={openUnits ?? fullUnits ?? (isExample ? example.units : mineHere ? mineHere.units : units)}
      mode={openUnits || fullUnits ? "full" : "free"}
      example={isExample}
      buyHref={isExample || !sells ? undefined : buyHref("pair", savedId)}
      open={open}
      pdf={openId && openUnits ? <SavePdfButton locale={L} readingId={openId} /> : fullUnits ? open : undefined}
      price={price}
      plans={<Plans locale={L} place="pair" carry={{ r: savedId ? String(savedId) : undefined }} />}
      heading="h2"
      />
    </div>,
  );
}
