import ReportSheet from "@/components/matrix/ReportSheet";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedMatrix } from "@/lib/matrix";
import { forLocale as localizedSections } from "@/lib/sections";
import { notFound } from "next/navigation";
import { readMatrixCard, type Access, type SavedMatrix } from "./access";

export const forLocale = localized((L: Locale) => {
  const { calculate } = localizedMatrix(L);
  const { build, withLockedPreview, withPositionArticles } = localizedSections(L);

  return { calculate, build, withLockedPreview, withPositionArticles };
});

/**
 * Рамка страницы разбора. Два экрана — свой разбор и сохранённая матрица — отличаются только
 * правилами входа и ссылкой внизу, поэтому сама рамка и тело общие.
 */
export function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <main id="content" className="page">
      <div className="wrap">{children}</div>
    </main>
  );
}

/** Разбор одной сохранённой матрицы: расчёт, права на неё и печать разделов. */
export async function SavedReport({ locale: requestedLocale, ...localeProps }: ({
  chosen: SavedMatrix;
  saved: SavedMatrix[];
  access: Access;
  embedded?: boolean;
}) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    chosen,
    saved,
    access,
    embedded = false,
  } = localeProps;
  const { calculate, build, withLockedPreview, withPositionArticles } = forLocale(L);

  let matrix;
  try {
    matrix = calculate(chosen.birth, chosen.sex);
  } catch {
    notFound();
  }

  const { unlocked, plan } = await readMatrixCard(chosen.id);
  return (
    <ReportSheet locale={L}
      matrix={matrix}
      sections={withLockedPreview(matrix, withPositionArticles(matrix, build(matrix, unlocked)))}
      planName={plan ?? D.sheet.planReading[L]}
      unlocked={unlocked}
      saved={saved}
      currentId={chosen.id}
      embedded={embedded}
    />
  );
}
