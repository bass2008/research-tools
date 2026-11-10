import type { Metadata } from "next";
import DeleteAccount from "@/components/account/DeleteAccount";
import { requestLocale } from "@/lib/i18n/request";
export async function generateMetadata(): Promise<Metadata> {
  const en = (await requestLocale()) === "en";
  return { title: en ? "Delete or restore account" : "Удаление и восстановление аккаунта", robots: { index: false, follow: false } };
}
export default function Page() {
  return <main id="content" className="page"><div className="wrap"><DeleteAccount /></div></main>;
}
