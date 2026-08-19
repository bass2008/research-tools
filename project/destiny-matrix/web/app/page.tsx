import type { Metadata } from "next";
import Link from "next/link";

import LeadForm from "@/components/LeadForm";
import MatrixForm from "@/components/MatrixForm";
import { freePositionTexts } from "@/lib/sections";
import { SITE, pageMeta } from "@/lib/site";
import { getTariffs, lead, money, periodLabel, type Tariff } from "@/lib/tariffs";

// Цена — предмет договора, поэтому первый экран, разметка Offer и описание в поиске печатаются
// по запросу и берут прайс из базы. Пересборка для смены цены не нужна.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const main = lead(await getTariffs());
  return pageMeta({
    title: "Матрица судьбы — расчёт по дате рождения с расшифровкой",
    description:
      "Рассчитайте матрицу судьбы по дате рождения: октаграмма 22 арканов, карта энергий по чакрам, " +
      `20 разделов разбора. Расчёт и два раздела бесплатно, полный разбор — ${money(main.price)} ₽.`,
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
  const main = lead(tariffs);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd(tariffs)) }}
      />

      <section className="hero">
        <div className="wrap hgrid">
          <div className="offer">
            <span className="eyebrow">Arcana Sense · матрица судьбы по 22 арканам</span>
            <h1>Разбор по дате рождения: что вам дано и через что это работает</h1>
            <p className="lede">
              Октаграмма со всеми позициями, линии рода, денежный канал, карта энергий по чакрам и
              разбор по годам до 80 лет — в одном отчёте, собранном по вашей дате.
            </p>
            <div className="pricelead">
              <b>{money(main.price)} ₽</b>
              <span className="what">
                полный разбор, все 20 разделов, {periodLabel(main) === "навсегда" ? "один платёж" : periodLabel(main)}
              </span>
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
                ✦ <b>Разбор по годам</b> до 80 лет
              </span>
              <span className="chip">✦ Один платёж, без списаний</span>
            </div>
            <p className="small" style={{ marginTop: 12 }}>
              Тарифы: {tariffs.map((t) => `${t.name} — ${money(t.price)} ₽`).join(" · ")}.{" "}
              <Link href="#plans">Что входит</Link>
            </p>
          </div>

          <MatrixForm texts={freePositionTexts()} />
        </div>
      </section>

      <section className="edit">
        <div className="wrap">
          <span className="eyebrow">Что вы держите в руках</span>
          <h2>Опоры персональной модели личности</h2>
          <div className="pillars">
            <div className="pil">
              <h4>Центр карты</h4>
              <p>
                Ядро матрицы: центральное число, к которому сходятся все линии. С него начинают читать
                карту и к нему возвращаются в конце.
              </p>
            </div>
            <div className="pil">
              <h4>Личность</h4>
              <p>
                Как вас считывают люди в первые минуты и какую роль вы занимаете в группе — часто не ту,
                которую выбрали бы сами.
              </p>
            </div>
            <div className="pil">
              <h4>Внутренняя мотивация</h4>
              <p>Глубинные причины решений: что вами двигает, когда вы устали и уже не притворяетесь.</p>
            </div>
            <div className="pil">
              <h4>Системные ресурсы</h4>
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
    </>
  );
}
