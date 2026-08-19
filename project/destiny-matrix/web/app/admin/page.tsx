import type { Metadata } from "next";
import Link from "next/link";

import AdminView from "@/components/AdminView";
import { pageMeta } from "@/lib/site";

// Данные приходят в браузер по куке, поэтому страница печатается на запрос и в индекс не идёт.
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Админка",
  description: "Пользователи и платежи: служебная страница.",
  path: "/admin",
  noindex: true,
});

export default function AdminPage() {
  return (
    <main className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/account">Кабинет</Link> <span>/</span> <span>Админка</span>
        </p>
        <h1>Админка</h1>
        <AdminView />
      </div>
    </main>
  );
}
