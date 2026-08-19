import type { Metadata } from "next";

import { pageMeta } from "@/lib/site";
import { getTariffs, lead } from "@/lib/tariffs";

import PayScreen from "./PayScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "Оплата — выбор тарифа",
  description: "Выбор тарифа и оплата полного разбора матрицы судьбы.",
  path: "/pay",
  noindex: true,
});

export default async function PayChoicePage() {
  const tariffs = await getTariffs();
  return <PayScreen tariffs={tariffs} initial={lead(tariffs).id} />;
}
