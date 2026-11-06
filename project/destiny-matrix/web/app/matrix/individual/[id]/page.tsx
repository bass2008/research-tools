import type { Metadata } from "next";
import IndividualArticleView from "@/components/account/IndividualArticleView";
import IndividualReadingAccess from "@/components/account/IndividualReadingAccess";
import EncFrame from "@/components/enc/EncFrame";
import { requestLocale } from "@/lib/i18n/request";
import { individualCardLinks } from "@/lib/individualCardLinks";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const en = (await requestLocale()) === "en";
  return {
    title: en ? "Individual reading" : "Индивидуальный разбор",
    robots: { index: false, follow: false, noarchive: true },
    referrer: "no-referrer",
  };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const L = await requestLocale();
  return <IndividualReadingAccess id={Number((await params).id)}>
    <main id="content" className="page individual-page theme-gold"><div className="wrap">
      <EncFrame locale={L} tocOnly mobileToc><IndividualArticleView links={individualCardLinks(L)} /></EncFrame>
    </div></main>
  </IndividualReadingAccess>;
}
