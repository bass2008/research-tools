import type { Metadata } from "next";

import ResetForm from "@/components/ResetForm";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Новый пароль",
  description: "Смена пароля по ссылке из письма.",
  path: "/reset",
  noindex: true,
});

export default function Page() {
  return (
    <main className="page">
      <div className="wrap">
        <ResetForm />
      </div>
    </main>
  );
}
