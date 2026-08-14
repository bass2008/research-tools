import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PayForm from "@/components/PayForm";
import { pageMeta } from "@/lib/site";
import { byId, getTariffs, money, periodLabel } from "@/lib/tariffs";

type Params = { tariff: string };

// Страница оплаты статикой быть не может: посетитель должен видеть ту цену, которую спишут.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const t = byId(await getTariffs(), (await params).tariff);
  if (!t) return {};
  return pageMeta({
    title: `Оплата тарифа «${t.name}» — ${money(t.price)} ₽`,
    description: `${t.name}: ${money(t.price)} ₽, ${periodLabel(t)}. Один платёж, без подписки и автосписаний.`,
    path: `/pay/${t.id}`,
    noindex: true,
  });
}

export default async function PayPage({ params }: { params: Promise<Params> }) {
  const tariffs = await getTariffs();
  const t = byId(tariffs, (await params).tariff);
  if (!t) notFound();

  return (
    <main className="page">
      <div className="wrap">
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <Link href="/#plans">Тарифы</Link> <span>/</span>{" "}
          <span>{t.name}</span>
        </p>
        <h1>Оплата: {t.name}</h1>
        <p className="dim">
          Один платёж, без подписки и автосписаний. Приём оплаты сейчас тестовый — провайдер подключается
          за тем же интерфейсом.
        </p>
        {t.scope.includes("all") ? null : (
          <p className="dim">
            Дата в платёж не передаётся. Оплаченной станет первая дата, которую вы сохраните после
            оплаты, — а если вы уже сохраняли дату, откроется она.
          </p>
        )}
        <PayForm tariff={t} />
        <p className="small center" style={{ marginTop: 16 }}>
          Другие тарифы:{" "}
          {tariffs.filter((o) => o.id !== t.id).map((o, i) => (
            <span key={o.id}>
              {i ? " · " : ""}
              <Link href={`/pay/${o.id}`}>
                {o.name} — {money(o.price)} ₽
              </Link>
            </span>
          ))}
        </p>
      </div>
    </main>
  );
}
