import { D, L } from "@/lib/i18n";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ALL_FREE } from "@/lib/access";
import { pageMeta } from "@/lib/site";
import { getTariffs, testPayments } from "@/lib/tariffs.server";
import { byId, periodLabel, priceLabel } from "@/lib/tariffs";
import { NOT_FOUND_META } from "@/lib/seo";

import PayScreen from "../PayScreen";

type Params = { tariff: string };

// Страница оплаты статикой быть не может: посетитель должен видеть ту цену, которую спишут.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  if (ALL_FREE) return NOT_FOUND_META;
  const t = byId(await getTariffs(), (await params).tariff);
  // Пустые метаданные оставляли на 404 заголовок главной: в истории браузера и в выдаче
  // несуществующая страница выглядела как главная.
  if (!t) return NOT_FOUND_META;
  return pageMeta({
    title: D.pay.tariffTitle[L](t.name, priceLabel(t)),
    description: D.pay.tariffDescription[L](t.name, priceLabel(t), periodLabel(t)),
    path: `/pay/${t.id}`,
    noindex: true,
  });
}

export default async function PayPage({ params }: { params: Promise<Params> }) {
  if (ALL_FREE) notFound();
  const tariffs = await getTariffs();
  const t = byId(tariffs, (await params).tariff);
  if (!t) notFound();

  return <PayScreen tariffs={tariffs} initial={t.id} test={await testPayments()} />;
}
