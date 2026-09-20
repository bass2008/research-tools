import { D, L } from "@/lib/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ALL_FREE } from "@/lib/access";
import { pageMeta } from "@/lib/site";
import { getTariffs, testPayments } from "@/lib/tariffs.server";
import { lead } from "@/lib/tariffs";

import PayScreen from "./PayScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: D.pay.pageTitle[L],
  description: D.pay.pageDescription[L],
  path: "/pay",
  noindex: true,
});

export default async function PayChoicePage() {
  // на витрине без оплаты кассы нет: страница не существует, а не показывает пустой прайс
  if (ALL_FREE) notFound();
  const tariffs = await getTariffs();
  return <PayScreen tariffs={tariffs} initial={lead(tariffs)?.id ?? ""} test={await testPayments()} />;
}
