import { requestSite } from "@/lib/siteProfile.server";
import CalcHero from "@/components/matrix/CalcHero";
import CalculationProvider from "@/components/matrix/CalculationProvider";
import MatrixForm from "@/components/matrix/MatrixForm";
import MatrixReport from "@/components/matrix/MatrixReport";
import TariffsProvider from "@/components/pay/TariffsProvider";
import HashScroll from "@/components/ui/HashScroll";
import { ALL_FREE } from "@/lib/access";
import { forLocale as localizedHeroSlides } from "@/lib/heroSlides";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSections } from "@/lib/sections";
import { forLocale as localizedSite } from "@/lib/site";
import { forLocale as localizedTariffs, type Tariff } from "@/lib/tariffs";
import { getTariffs, getBilling } from "@/lib/tariffs.server";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { pickMatrix, readAccess, readSavedMatrices } from "./_lib/access";
import { SavedReport } from "./_lib/report";

// Цена — предмет договора, поэтому первый экран, разметка Offer и описание в поиске печатаются
// по запросу и берут прайс из базы. Пересборка для смены цены не нужна.
export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const forLocale = localized((L: Locale, site) => {
  const { LANDING_SLIDES } = localizedHeroSlides(L);
  const { freePositionArticles, freePositionTexts } = localizedSections(L);
  const { SITE, pageMeta } = localizedSite(L, site);
  const { lead, periodLabel, priceLabel } = localizedTariffs(L);

  function productJsonLd(tariffs: Tariff[]) {
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: D.homeMeta.productName[L],
      description: D.homeMeta.productDescription[L],
      brand: { "@type": "Brand", name: "Arcana Sense" },
      offers: tariffs.map((t) => ({
        "@type": "Offer",
        name: t.name,
        price: (t.price / 100).toFixed(2),
        priceCurrency: "RUB",
        availability: "https://schema.org/InStock",
        url: `${SITE.url}/pay/${t.id}`,
      })),
    };
  }
  return { LANDING_SLIDES, freePositionArticles, freePositionTexts, SITE, pageMeta, lead, periodLabel, priceLabel, productJsonLd };
});

export async function generateMetadata(): Promise<Metadata> {
  const L = await publicLocale();
  const { pageMeta, lead, priceLabel } = forLocale(L, await requestSite());

  // цену в описание страницы ставим, только если она известна: зашитая могла разойтись с базой
  const prices = await getTariffs();
  const main = prices.length ? lead(prices) : null;
  return pageMeta({
    title: D.homeMeta.title[L],
    description:
      D.homeMeta.descriptionHead[L] +
      (ALL_FREE
        ? D.homeMeta.descriptionFree[L]
        : D.homeMeta.descriptionPaidHead[L] +
        (main ? D.homeMeta.descriptionPaidPrice[L](priceLabel(main)) : ".")),
    path: "/",
  });
}

export default async function HomePage({ searchParams }: { searchParams: Search }) {
  const L = await requestLocale();
  const { LANDING_SLIDES, freePositionArticles, freePositionTexts, lead, periodLabel, priceLabel, productJsonLd } = forLocale(L, await requestSite());

  const wanted = (await searchParams).m;
  const { items: tariffs, providers } = await getBilling();
  // пустой список — API молчит: цену не называем, но страница открывается и считает карту
  const main = tariffs.length ? lead(tariffs) : null;
  let paidResult: ReactNode = null;

  // В URL только внутренний id, не дата рождения. Сам id ничего не открывает: список содержит
  // лишь записи владельца куки, а SavedReport ещё раз проверяет право именно на выбранную запись.
  if (wanted !== undefined) {
    const access = await readAccess();
    if (access.authenticated) {
      const saved = await readSavedMatrices();
      const chosen = pickMatrix(saved, wanted);
      if (chosen?.unlocked) {
        paidResult = (
          <div id="result">
            <section id="plans" className="wrap section-gap" style={{ padding: 0 }}>
              <SavedReport locale={L} chosen={chosen} saved={saved} access={access} embedded />
            </section>
          </div>
        );
      }
    }
  }

  return (
    <>
      {/* Offer печатаем только там, где есть что купить: на витрине без оплаты цена
          в разметке была бы обещанием несуществующей покупки. */}
      {ALL_FREE ? null : (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(tariffs)) }}
        />
      )}

      <HashScroll />

      {/* ориентир страницы: на остальных страницах <main> есть, а на главной его не было —
          скринридер не мог перейти к содержимому одной командой */}
      <main id="content">
        {/* цена уже прочитана на сервере: без этого клиентские кнопки шли за ней второй раз и
          при недоступном BFF писали «уточняется» рядом с напечатанным числом */}
        <TariffsProvider locale={L} server={tariffs} providers={providers}>
          <CalculationProvider locale={L}>
            <CalcHero locale={L}
              slides={LANDING_SLIDES}
              place="landing"
              fullReport={paidResult !== null}
              below={paidResult ?? <MatrixReport locale={L} texts={freePositionTexts()} articles={freePositionArticles()} />}
            >
              <MatrixForm locale={L} />
            </CalcHero>
          </CalculationProvider>

          {/* Цена и состав отчёта ушли из первого экрана под карусель: слева теперь композиция из
          колоды, и длинный список чипов её перегружал. */}
          <section className="wrap offerbar">
            <div className="pricelead">
              {ALL_FREE ? (
                <>
                  <b>{D.common.free[L][0].toUpperCase() + D.common.free[L].slice(1)}</b>
                  <span className="what">{D.home.freeAllSections[L]}</span>
                </>
              ) : main ? (
                <>
                  <b>{priceLabel(main)}</b>
                  <span className="what">{D.home.priceWhat[L](periodLabel(main))}</span>
                </>
              ) : (
                <span className="what">{D.home.priceUnknown[L]}</span>
              )}
              <span className="free">
                {ALL_FREE ? D.home.freeNoteAll[L] : D.home.freeNote[L]}
              </span>
            </div>
            <div className="chips">
              <span className="chip">✦ {D.home.chipSections[L]}</span>
              <span className="chip">✦ {D.home.chipChakras[L]}</span>
              <span className="chip">✦ {D.home.chipDecades[L]}</span>
              <span className="chip">
                ✦ {ALL_FREE ? D.home.chipNoPayment[L] : D.home.chipOnePayment[L]}
              </span>
            </div>
            <p className="small">
              {!ALL_FREE && tariffs.length
                ? D.home.tariffsLine[L](tariffs.map((t) => `${t.name} — ${priceLabel(t)}`).join(" · "))
                : ""}
              {/* Без кассы блока тарифов на странице нет, и якорь «#plans» никуда не ведёт:
              на витрине без оплаты ссылка отправляет к самому разбору. */}
              <Link href={ALL_FREE ? "#result" : "#plans"}>{D.home.plansLink[L]}</Link>
            </p>
          </section>

          <section className="edit">
            <div className="wrap">
              <span className="eyebrow">{D.home.pillarsEyebrow[L]}</span>
              <h2>{D.home.pillarsTitle[L]}</h2>
              <div className="pillars">
                <div className="pil">
                  <h3>{D.home.pillarCenter[L]}</h3>
                  <p>{D.home.pillarCenterText[L]}</p>
                </div>
                <div className="pil">
                  <h3>{D.home.pillarPortrait[L]}</h3>
                  <p>{D.home.pillarPortraitText[L]}</p>
                </div>
                <div className="pil">
                  <h3>{D.home.pillarMotivation[L]}</h3>
                  <p>{D.home.pillarMotivationText[L]}</p>
                </div>
                <div className="pil">
                  <h3>{D.home.pillarResources[L]}</h3>
                  <p>{D.home.pillarResourcesText[L]}</p>
                </div>
              </div>
              <div className="quote">
                <div className="qm">“</div>
                <p>{D.quote.text[L]}</p>
              </div>

              {/* Почта собирается и без оплаты: до этого лид приходил только из формы платежа. */}
              <div className="section-gap" style={{ display: "flex", justifyContent: "center" }}>
              </div>
            </div>
          </section>
        </TariffsProvider>
      </main>
    </>
  );
}
