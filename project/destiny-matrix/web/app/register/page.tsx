import type { Metadata } from "next";

import AuthForm from "@/components/account/AuthForm";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Регистрация",
  description: "Создание аккаунта: хранение сохранённых матриц и доступ к платным разделам.",
  path: "/register",
  noindex: true,
});

export default function RegisterPage() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <AuthForm mode="register" />
      </div>
    </main>
  );
}
