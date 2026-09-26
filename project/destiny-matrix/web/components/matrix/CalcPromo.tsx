import { forLocale as localizedArcana } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import ArcanumCard from "./ArcanumCard";
import MatrixForm from "./MatrixForm";

export const forLocale = localized((L: Locale) => {
  const { arcanumTitle } = localizedArcana(L);

  return { arcanumTitle };
});

/**
 * Приглашение рассчитать матрицу на страницах справочника: слева карта аркана, справа та же
 * форма, что на главной, — буквально та же, а не её копия. Карту печатает главная: она читает
 * дату из браузера, поэтому на сервер дата не уходит и отсюда.
 */
export default function CalcPromo({ locale: requestedLocale, ...localeProps }: ({
  arcanum?: number;
  caption?: string;
  title?: string;
  lead?: string;
  place?: string;
}) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    arcanum,
    caption,
    title = D.home.promoTitle[L],
    lead = D.calc.formLead[L],
    place = "encyclopedia",
  } = localeProps;
  const { arcanumTitle } = forLocale(L);

  return (
    <div className={arcanum ? "promo" : "promo solo"} data-testid="calc-promo">
      {arcanum ? (
        <figure className="promocard">
          <ArcanumCard locale={L} n={arcanum} size="big" decorative />
          <figcaption>{caption ?? `${arcanum}. ${arcanumTitle(arcanum)}`}</figcaption>
        </figure>
      ) : null}

      <MatrixForm locale={L}
        name="promo"
        title={title}
        lead={lead}
        place={place}
        finish={{ kind: "go", href: "/#result" }}
      />
    </div>
  );
}
