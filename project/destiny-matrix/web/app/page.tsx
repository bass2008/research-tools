import type { Metadata } from "next";
import Link from "next/link";

import CalcHero from "@/components/matrix/CalcHero";
import HashScroll from "@/components/ui/HashScroll";
import LeadForm from "@/components/pay/LeadForm";
import MatrixForm from "@/components/matrix/MatrixForm";
import MatrixReport from "@/components/matrix/MatrixReport";
import TariffsProvider from "@/components/pay/TariffsProvider";
import { LANDING_SLIDES } from "@/lib/heroSlides";
import { freePositionTexts } from "@/lib/sections";
import { SITE, pageMeta } from "@/lib/site";
import { getTariffs, lead, money, periodLabel, type Tariff } from "@/lib/tariffs";

// Цена — предмет договора, поэтому первый экран, разметка Offer и описание в поиске печатаются
// по запросу и берут прайс из базы. Пересборка для смены цены не нужна.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  // цену в описание страницы ставим, только если она известна: зашитая могла разойтись с базой
  const prices = await getTariffs();
  const main = prices.length ? lead(prices) : null;
  return pageMeta({
    title: "Матрица судьбы — расчёт по дате рождения с расшифровкой",
    description:
      "Рассчитайте матрицу судьбы по дате рождения: октаграмма 22 арканов, карта энергий по чакрам, " +
      "20 разделов разбора. Расчёт и два раздела бесплатно" +
      (main ? `, полный разбор — ${money(main.price)} ₽.` : "."),
    path: "/",
  });
}

function productJsonLd(tariffs: Tariff[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Матрица судьбы — полный разбор",
    description:
      "Персональный разбор по дате рождения: октаграмма арканов, карта энергий по чакрам, 20 разделов.",
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

export default async function HomePage() {
  const tariffs = await getTariffs();
  // пустой список — API молчит: цену не называем, но страница открывается и считает карту
  const main = tariffs.length ? lead(tariffs) : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(tariffs)) }}
      />

      <HashScroll />

      {/* ориентир страницы: на остальных страницах <main> есть, а на главной его не было —
          скринридер не мог перейти к содержимому одной командой */}
      <main id="content">
      {/* цена уже прочитана на сервере: без этого клиентские кнопки шли за ней второй раз и
          при недоступном BFF писали «уточняется» рядом с напечатанным числом */}
      <TariffsProvider server={tariffs}>
      <CalcHero
        slides={LANDING_SLIDES}
        place="landing"
        below={<MatrixReport texts={freePositionTexts()} />}
      >
        <MatrixForm />
      </CalcHero>

      {/* Цена и состав отчёта ушли из первого экрана под карусель: слева теперь композиция из
          колоды, и длинный список чипов её перегружал. */}
      <section className="wrap offerbar">
        <div className="pricelead">
          {main ? (
            <>
              <b>{money(main.price)} ₽</b>
              <span className="what">
                полный разбор, все 20 разделов,{" "}
                {periodLabel(main) === "навсегда" ? "один платёж" : periodLabel(main)}
              </span>
            </>
          ) : (
            <span className="what">
              Цена уточняется — справочник сейчас недоступен. Расчёт карты работает и без него.
            </span>
          )}
          <span className="free">карта и 2 раздела — бесплатно, без регистрации</span>
        </div>
        <div className="chips">
          <span className="chip">
            ✦ <b>20 разделов</b> отчёта
          </span>
          <span className="chip">
            ✦ <b>Карта энергий</b> по чакрам
          </span>
          <span className="chip">
            ✦ <b>Разбор по десятилетиям</b> до 80 лет
          </span>
          <span className="chip">✦ Один платёж, без списаний</span>
        </div>
        <p className="small">
          {tariffs.length
            ? `Тарифы: ${tariffs.map((t) => `${t.name} — ${money(t.price)} ₽`).join(" · ")}. `
            : ""}
          <Link href="#plans">Что входит</Link>
        </p>
      </section>

      <section className="edit">
        <div className="wrap">
          <span className="eyebrow">Что вы держите в руках</span>
          <h2>Опоры персональной модели личности</h2>
          <div className="pillars">
            <div className="pil">
              <h3>Центр карты</h3>
              <p>
                Ядро матрицы: центральное число, к которому сходятся все линии. С него начинают читать
                карту и к нему возвращаются в конце.
              </p>
            </div>
            <div className="pil">
              <h3>Личность</h3>
              <p>
                Как вас считывают люди в первые минуты и какую роль вы занимаете в группе — часто не ту,
                которую выбрали бы сами.
              </p>
            </div>
            <div className="pil">
              <h3>Внутренняя мотивация</h3>
              <p>Глубинные причины решений: что вами двигает, когда вы устали и уже не притворяетесь.</p>
            </div>
            <div className="pil">
              <h3>Системные ресурсы</h3>
              <p>
                Родовая поддержка и накопленный опыт: на что можно опереться, даже если сейчас так не
                кажется.
              </p>
            </div>
          </div>
          <div className="quote">
            <div className="qm">“</div>
            <p>
              В матрице нет приговора: есть склонности и цена, которую каждая из них берёт. Куда
              вложить силы, а где не спорить с собой — решаете вы.
            </p>
          </div>

          {/* Почта собирается и без оплаты: до этого лид приходил только из формы платежа. */}
          <div className="section-gap" style={{ display: "flex", justifyContent: "center" }}>
            <LeadForm source="landing" />
          </div>
        </div>
      </section>
      </TariffsProvider>
      </main>
    </>
  );
}
