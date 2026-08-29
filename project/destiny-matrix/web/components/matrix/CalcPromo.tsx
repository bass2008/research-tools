import { arcanumTitle } from "@/lib/arcana";

import ArcanumCard from "./ArcanumCard";
import MatrixForm from "./MatrixForm";

/**
 * Приглашение рассчитать матрицу на страницах справочника: слева карта аркана, справа та же
 * форма, что на главной, — буквально та же, а не её копия. Карту печатает главная: она читает
 * дату из браузера, поэтому на сервер дата не уходит и отсюда.
 */
export default function CalcPromo({
  arcanum,
  caption,
  title = "Постройте свою матрицу",
  lead = "Расчёт бесплатный, без регистрации. Карта строится сразу.",
  place = "encyclopedia",
}: {
  arcanum?: number;
  caption?: string;
  title?: string;
  lead?: string;
  place?: string;
}) {
  return (
    <div className={arcanum ? "promo" : "promo solo"} data-testid="calc-promo">
      {arcanum ? (
        <figure className="promocard">
          <ArcanumCard n={arcanum} size="big" decorative />
          <figcaption>{caption ?? `${arcanum}. ${arcanumTitle(arcanum)}`}</figcaption>
        </figure>
      ) : null}

      <MatrixForm
        name="promo"
        title={title}
        lead={lead}
        place={place}
        finish={{ kind: "go", href: "/#result" }}
      />
    </div>
  );
}
