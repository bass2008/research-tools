import type { Metadata } from "next";
import Link from "next/link";

import AccountView from "@/components/account/AccountView";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Личный кабинет",
  description: "Сохранённые матрицы, тариф и доступ к разделам разбора.",
  path: "/account",
  noindex: true,
});

export default function AccountPage() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <span>Кабинет</span>
        </p>
        <h1>Личный кабинет</h1>
        <AccountView />
      </div>
    </main>
  );
}
