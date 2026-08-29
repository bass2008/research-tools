import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AdminUserView from "@/components/admin/AdminUserView";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Пользователь — админка",
  description: "Матрицы и платежи пользователя: служебная страница.",
  path: "/admin",
  noindex: true,
});

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
