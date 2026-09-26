import { requestSite } from "@/lib/siteProfile.server";
import { resolvePrintLinkSite } from "@/lib/siteProfile.config";
// Разбор, напечатанный сервером: сюда попадают толкования платных разделов, поэтому компонент
// серверный и вызывается только после того, как кука подтвердила тариф.
import MatrixResult, { forLocale as localizedMatrixResult } from "@/components/matrix/MatrixResult";
import ReportSections from "@/components/matrix/ReportSections";
import SavePdfButton from "@/components/matrix/SavePdfButton";
import UnlockCta from "@/components/pay/UnlockCta";
import LockIcon from "@/components/ui/LockIcon";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import type { Matrix } from "@/lib/matrix";
import type { SectionOut } from "@/lib/publicSpec";
import { forLocale as localizedSite } from "@/lib/site";
import Link from "next/link";

export interface SavedMatrix {
  id: number;
  birth: string;
  sex: "m" | "f";
  title: string | null;
}

export const forLocale = localized((L: Locale, site) => {
  const { DISCLAIMER, SITE } = localizedSite(L, site);
  const { birthLabel } = localizedMatrixResult(L);
  const printedBy = `${SITE.name} · ${new URL(SITE.url).host}`;

  return { DISCLAIMER, birthLabel, printedBy };
});

export default async function ReportSheet({ locale: requestedLocale, ...localeProps }: ({
  matrix: Matrix;
  sections: SectionOut[];
  planName: string;
  /** Доступ к платным разделам подтверждён именно для этой сохранённой матрицы. */
  unlocked: boolean;
  saved: SavedMatrix[];
  currentId: number;
  /** страница печатается в PDF: кнопки и переключатели в файл не нужны */
  printing?: boolean;
  /** Отчёт стоит внутри главной, где h1 и навигационная цепочка уже есть. */
  embedded?: boolean;
}) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const site = await requestSite();
  const {
    matrix,
    sections,
    planName,
    unlocked,
    saved,
    currentId,
    printing = false,
    embedded = false,
  } = localeProps;
  const linkSite = printing ? resolvePrintLinkSite(site, L) : site;
  const { DISCLAIMER, birthLabel, printedBy } = forLocale(L, site);

  const open = sections.filter((s) => s.positions.length).length;
  const locked = sections.filter((s) => !s.positions.length);
  const Heading = embedded ? "h2" : "h1";

  return (
    <>
      {printing || embedded ? null : (
        <p className="crumbs">
          <Link href="/">{D.nav.home[L]}</Link> <span>/</span>{" "}
          <Link href="/account">{D.nav.account[L]}</Link> <span>/</span>{" "}
          <span>{D.nav.myReading[L]}</span>
        </p>
      )}
      <Heading>{D.sheet.title[L]}</Heading>
      <div className="rsub">
        <p className="dim">
          {birthLabel(matrix.birth)} ·{" "}
          {matrix.sex === "f" ? D.calc.femaleChartLabel[L] : D.calc.maleChartLabel[L]} ·{" "}
          {/* тариф называем только там, где он есть: без кассы имя тарифа обещает покупку */}
          {!ALL_FREE && unlocked ? D.sheet.planNamed[L](planName) : D.sheet.freeAccess[L]} —{" "}
          {D.sheet.openOf[L](open, sections.length)}
        </p>
        {printing || locked.length ? null : (
          /* кнопка и её сообщение живут в одной ячейке: иначе текст ошибки становился третьим
             элементом строки и сдвигал кнопку от правого края.
             На закрытом разборе кнопки нет вовсе: она была активной и всегда отвечала
             «Разбор этой даты не оплачен» — обещание, которого страница не выполняет */
          <span className="pdfslot">
            <SavePdfButton locale={L} matrixId={currentId} hint={birthLabel(matrix.birth)} />
          </span>
        )}
      </div>

      <div className="section-gap">
        <MatrixResult site={linkSite} locale={L} m={matrix} printing={printing} />
      </div>

      <ReportSections site={linkSite} locale={L} sections={sections} matrixId={currentId} printing={printing} />

      {locked.length && !printing ? (
        <div className="allbox">
          <h3>{D.sheet.moreInFull[L](locked.length)}</h3>
          <p>{D.sheet.moreInFullText[L]}</p>
          <div className="alllist">
            {locked.map((s) => (
              <span key={s.key}>
                <LockIcon /> {s.title}
              </span>
            ))}
          </div>
          <UnlockCta locale={L} place="report_upgrade" matrixId={currentId}>
            {D.nav.buy[L]}
          </UnlockCta>
        </div>
      ) : null}

      {/* Оговорку печатает подвал сайта, а страница печати подвала не выводит: в скачанном PDF
          её не было вовсе, хотя на каждой странице сайта она стоит. Файл уходит наружу и живёт
          отдельно от сайта, поэтому несёт её сам. */}
      {printing ? (
        <p className="small section-gap dim">
          {printedBy}
          <br />
          {DISCLAIMER}
        </p>
      ) : null}
    </>
  );
}
