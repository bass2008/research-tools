import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedTariffs, type Tariff } from "@/lib/tariffs";

export const forLocale = localized((L: Locale) => {
  const { money, periodLabel, priceLabel } = localizedTariffs(L);

  // Состав результата собирается из `scope` тарифа, а не пишется в тексте документа: цена и то,
  // что за неё получают, обязаны совпадать с прайсом, по которому спишет касса.
  function included(t: Tariff): string {
    const parts = [
      D.legal.sections[L],
      t.scope.includes("all") ? D.legal.anyDate[L] : D.legal.oneDate[L],
    ];
    if (t.scope.includes("matrix")) parts.push(D.legal.storage[L]);
    parts.push(t.period_days === null
      ? D.legal.forever[L]
      : D.legal.untilEnd[L](periodLabel(t)));
    return parts.join("; ");
  }
  return { money, periodLabel, priceLabel, included };
});

export default function TariffScope({ locale: requestedLocale, ...localeProps }: ({ as: "table" | "list"; tariffs: Tariff[] }) & { locale?: Locale }
) {
  const L = requestedLocale ?? defaultLocale;
  const { as, tariffs } = localeProps;
  const { money, periodLabel, priceLabel, included } = forLocale(L);

  if (!tariffs.length) return <p>{D.legal.priceListOnPayPage[L]}</p>;
  if (as === "list") {
    return (
      <ul>
        {tariffs.map((t) => (
          <li key={t.id}>
            <b>{t.name}</b> — {priceLabel(t)}: {included(t)}.
          </li>
        ))}
      </ul>
    );
  }
  return (
    <table className="postab">
      <thead>
        <tr>
          <th>{D.legal.scopeHead[L]}</th>
          <th>{D.legal.priceHead[L]}</th>
          <th>{D.legal.includedHead[L]}</th>
        </tr>
      </thead>
      <tbody>
        {tariffs.map((t) => (
          <tr key={t.id}>
            <td className="pn">{t.name}</td>
            <td>
              <b>{money(t.price)} ₽</b>
              <br />
              <span className="small">{periodLabel(t)}</span>
            </td>
            <td className="vl">{included(t)}.</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
