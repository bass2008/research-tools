import { D, L } from "@/lib/i18n";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { pageMeta } from "@/lib/site";

import { pickMatrix, readAccess, readSavedMatrices } from "../../_lib/access";
import { SavedReport, Sheet } from "../../_lib/report";

// Сохранённая матрица: дата рождения и разбор печатаются на запрос и только владельцу куки.
// Ни предрендера, ни кеша — иначе чужая дата рождения (специальная категория ПД) осела бы в
// готовом HTML или в кеше прокси.
export const dynamic = "force-dynamic";

// canonical объявляли на /matrices — маршрута верхнего уровня нет, и все сохранённые матрицы
// разом канонизировались в 404. Каждая страница канонична сама себе.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return pageMeta({
    title: D.pages.savedMatrixTitle[L],
    description: D.pages.savedMatrixDescription[L],
    path: `/matrices/${encodeURIComponent(id)}`,
    noindex: true,
  });
}

const OTHER = <Link href="/report">{D.nav.myReading[L]}</Link>;

export default async function SavedMatrixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await readAccess();

  if (!access.authenticated) {
    return (
      <Sheet other={OTHER}>
        <div className="panel narrow">
          {/* заголовок страницы, а не подзаголовок панели: у гостя это единственный экран */}
          <h1 className="panel-h1">{D.account.needSignIn[L]}</h1>
          <p className="dim">
            {access.offline
              ? D.pages.savedMatrixOffline[L]
              : D.pages.savedMatrixOwnerOnly[L]}
          </p>
          <Link className="btn wide" href="/login">
            {D.auth.signIn[L]}
          </Link>
          <p className="hint">
            {D.pages.calcWithoutSignup[L]}{" "}
            <Link href="/#calc">{D.pages.calcInBrowser[L]}</Link>.
          </p>
        </div>
      </Sheet>
    );
  }

  const saved = await readSavedMatrices();
  const chosen = pickMatrix(saved, id);
  if (!chosen) notFound();

  return (
    <Sheet other={OTHER}>
      <SavedReport chosen={chosen} saved={saved} access={access} />
    </Sheet>
  );
}
