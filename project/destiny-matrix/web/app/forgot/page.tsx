import type { Metadata } from "next";

import ForgotForm from "@/components/account/ForgotForm";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Восстановление пароля",
  description: "Пришлём ссылку для смены пароля на почту, указанную при оплате.",
  path: "/forgot",
  noindex: true,
});

export default function Page() {
  return (
    <main id="content" className="page">
      <div className="wrap">
        <ForgotForm />
      </div>
    </main>
  );
}
