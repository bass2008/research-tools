import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readAdminReading } from "@/app/_lib/access";
import { forLocale as reportLocale, Sheet } from "@/app/_lib/report";
import ReportSheet from "@/components/matrix/ReportSheet";
import PairReport from "@/components/pair/PairReport";
import { pairView } from "@/components/pair/pairView";
import Link from "@/components/ui/LocalizedLink";
import { requestLocale } from "@/lib/i18n/request";
import { pairUnits } from "@/lib/pair/corpus";
import { forLocale } from "@/lib/site";
import { requestSite } from "@/lib/siteProfile.server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const L = await requestLocale();
  return forLocale(L, await requestSite()).pageMeta({
    title: L === "en" ? "Reading — administration" : "Разбор — администрирование",
    description: L === "en" ? "Administrator preview of a user's reading." : "Просмотр разбора пользователя администратором.",
    path: "/admin",
    noindex: true,
  });
}

export default async function AdminReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const reading = await readAdminReading(Number(id));
  if (!reading) notFound();
  const L = await requestLocale();
  let report;
  let title = true;
  if (reading.product === "personal") {
    const { birth, sex } = reading.inputs;
    if (typeof birth !== "string" || (sex !== "m" && sex !== "f")) notFound();
    const { calculate, build, withPositionArticles } = reportLocale(L);
    const matrix = calculate(birth, sex);
    report = <ReportSheet locale={L} matrix={matrix}
      sections={withPositionArticles(matrix, build(matrix, true))}
      planName={L === "en" ? "Administrator preview" : "Просмотр администратором"}
      unlocked saved={[]} currentId={reading.id} embedded showPdf={false} />;
  } else if (reading.product === "pair") {
    const view = pairView(reading.inputs, L);
    if (!view) notFound();
    report = <PairReport locale={L} {...view} mode="full"
      units={pairUnits(L, view.result, view.dates, true)} />;
    title = false;
  } else {
    notFound();
  }
  return <Sheet>
    <p className="crumbs">
      <Link href="/admin">{L === "en" ? "Administration" : "Администрирование"}</Link> <span>/</span>{" "}
      <Link href={`/admin/users/${reading.owner.id}`}>{reading.owner.email}</Link> <span>/</span>{" "}
      <span>{L === "en" ? "Reading" : "Разбор"}</span>
    </p>
    {title && <h1>{reading.title}</h1>}
    {report}
  </Sheet>;
}
