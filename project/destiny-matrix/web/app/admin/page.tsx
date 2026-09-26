import { forLocale as adminLocale } from "@/lib/adminLocale";
import { requestLocale } from "@/lib/i18n/request";
import type { Metadata } from "next";
import Link from "next/link";

import AdminView from "@/components/admin/AdminView";
import { forLocale } from "@/lib/site";
import { requestSite } from "@/lib/siteProfile.server";

// Данные приходят в браузер по куке, поэтому страница печатается на запрос и в индекс не идёт.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await requestSite();
  const L = await requestLocale();
  const { t } = adminLocale(L);
  return forLocale(L, site).pageMeta({
  title: t("Админка"),
  description: t("Пользователи и платежи: служебная страница."),
  path: "/admin",
  noindex: true,
  });
}

export default async function AdminPage() {
  const { t } = adminLocale(await requestLocale());
  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/account">{t("Кабинет")}</Link> <span>/</span> <span>{t("Админка")}</span>
        </p>
        <h1>{t("Админка")}</h1>
        <AdminView />
      </div>
    </main>
  );
}
