import type { Metadata } from "next";

import AuthForm from "@/components/AuthForm";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Вход в кабинет",
  description: "Вход в личный кабинет: сохранённые матрицы и доступ к разделам разбора.",
  path: "/login",
  noindex: true,
});

export default function LoginPage() {
  return (
    <main className="page">
      <div className="wrap">
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
