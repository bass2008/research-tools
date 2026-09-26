import { forLocale as adminLocale } from "@/lib/adminLocale";
import { requestLocale } from "@/lib/i18n/request";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AdminUserView from "@/components/admin/AdminUserView";
import { forLocale } from "@/lib/site";
import { requestSite } from "@/lib/siteProfile.server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await requestSite();
  const L = await requestLocale();
  const { t } = adminLocale(L);
  return forLocale(L, site).pageMeta({
  title: t("Пользователь — админка"),
  description: t("Матрицы и платежи пользователя: служебная страница."),
  path: "/admin",
  noindex: true,
  });
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  return (
    <main id="content" className="page">
      <div className="wrap">
        <AdminUserView id={Number(id)} />
      </div>
    </main>
  );
}
