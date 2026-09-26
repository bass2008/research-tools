import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedPublicLabels } from "@/lib/i18n/publicLabels";
import type { Matrix } from "@/lib/matrix";
import { forLocale as localizedSite } from "@/lib/site";
import Link from "next/link";

export const forLocale = localized((L: Locale, site) => {
  const { columnTitle } = localizedPublicLabels(L);
  const { publicHref } = localizedSite(L, site);

  /**
   * Карта энергий: семь уровней в трёх колонках.
   *
   * Одним компонентом, а не копией в двух файлах: цвета подписей приходилось править дважды, и
   * контраст на странице матрицы оставался прежним, пока правку не повторяли вручную.
   *
   * Цвет подписи выбирается по фону: белым на жёлтом и голубом уровнях контраст падал до 2,1 : 1,
   * а тёмным на них выходит 5,1–8,4 : 1. Палитра уровней при этом не меняется.
   */
  const LEVELS: Record<string, { bg: string; ink: string }> = {
    sahasrara: { bg: "#8e5bc4", ink: "#fff" },
    ajna: { bg: "#3f5ec9", ink: "#fff" },
    vishuddha: { bg: "#1f9ed6", ink: "#14181c" },
    anahata: { bg: "#159c69", ink: "#14181c" },
    manipura: { bg: "#d9ac1e", ink: "#14181c" },
    svadhisthana: { bg: "#dd7b2a", ink: "#14181c" },
    muladhara: { bg: "#c9453a", ink: "#fff" },
  };
  return { columnTitle, publicHref, LEVELS };
});

export default function ChakraTable({ site = DEFAULT_SITE, locale: requestedLocale, ...localeProps }: ({
  m: Matrix;
  /** уровень заголовка задаёт страница: на карте это раздел, в разборе — панель внутри него */
  heading?: "h2" | "h3";
  /** печать в PDF: адреса становятся абсолютными, иначе ссылки ведут на внутренний хост */
  printing?: boolean;
}) & { locale?: Locale; site?: SiteProfile }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    m,
    heading = "h3",
    printing = false,
  } = localeProps;
  const { columnTitle, publicHref, LEVELS } = forLocale(L, site);

  const Heading = heading;
  const href = (key: string) => {
    const path = `/encyclopedia/chakra/${key}`;
    return printing ? publicHref(path) : path;
  };

  return (
    <div className="panel">
      <Heading>{D.report.chakraTitle[L]}</Heading>
      <div className="cap">{D.report.chakraHint[L]}</div>
      <table className="chak">
        <thead>
          <tr>
            <th>{D.report.chakraLevel[L]}</th>
            <th>{columnTitle("physics")}</th>
            <th>{columnTitle("energy")}</th>
            <th>{columnTitle("emotions")}</th>
          </tr>
        </thead>
        <tbody>
          {m.chakras.map((r, i) => (
            <tr key={r.key}>
              <td style={{ background: LEVELS[r.key]?.bg }}>
                <Link href={href(r.key)} style={{ color: LEVELS[r.key]?.ink }}>
                  {7 - i}. {r.title}
                </Link>
              </td>
              <td>{r.physics}</td>
              <td>{r.energy}</td>
              <td>{r.emotions}</td>
            </tr>
          ))}
          <tr className="tot">
            <td>{D.report.chakraTotal[L]}</td>
            <td>{m.chakra_totals.physics}</td>
            <td>{m.chakra_totals.energy}</td>
            <td>{m.chakra_totals.emotions}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
