import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMeta } from "@/lib/site";
import { byId, getTariffs, money, periodLabel } from "@/lib/tariffs";

import PayScreen from "../PayScreen";

type Params = { tariff: string };

// Страница оплаты статикой быть не может: посетитель должен видеть ту цену, которую спишут.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const t = byId(await getTariffs(), (await params).tariff);
  if (!t) return {};
  return pageMeta({
    title: `Оплата тарифа «${t.name}» — ${money(t.price)} ₽`,
    description: `${t.name}: ${money(t.price)} ₽, ${periodLabel(t)}. Тариф можно сменить на самой странице оплаты.`,
    path: `/pay/${t.id}`,
    noindex: true,
  });
}

export default async function PayPage({ params }: { params: Promise<Params> }) {
  const tariffs = await getTariffs();
  const t = byId(tariffs, (await params).tariff);
  if (!t) notFound();

  return <PayScreen tariffs={tariffs} initial={t.id} />;
}
