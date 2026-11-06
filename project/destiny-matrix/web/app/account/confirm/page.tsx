import ConfirmOperation from "@/components/account/ConfirmOperation";
import type { Metadata } from "next";
import { requestLocale } from "@/lib/i18n/request";
export async function generateMetadata(): Promise<Metadata> {
  const en = (await requestLocale()) === "en";
  return { title: en ? "Email confirmation" : "Подтверждение почты", robots: { index: false, follow: false }, referrer: "no-referrer" };
}
export default function Page() { return <main id="content" className="page"><div className="wrap"><ConfirmOperation /></div></main>; }
