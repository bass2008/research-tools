import type { Metadata } from "next";

import { pageMeta } from "@/lib/site";
import { getTariffs, testPayments } from "@/lib/tariffs.server";
import { lead } from "@/lib/tariffs";

import PayScreen from "./PayScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Оплата разбора",
  description: "Оплата полного разбора матрицы судьбы: 20 разделов по вашей дате рождения.",
  path: "/pay",
  noindex: true,
});

export default async function PayChoicePage() {
  const tariffs = await getTariffs();
  return <PayScreen tariffs={tariffs} initial={lead(tariffs)?.id ?? ""} test={await testPayments()} />;
}
