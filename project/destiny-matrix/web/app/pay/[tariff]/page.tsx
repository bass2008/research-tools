import { requestSite } from "@/lib/siteProfile.server";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import { forLocale as localizedTariffs } from "@/lib/tariffs";
import { getBilling } from "@/lib/tariffs.server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PayScreen from "../PayScreen";

type Params = { tariff: string };

// Страница оплаты статикой быть не может: посетитель должен видеть ту цену, которую спишут.
export const dynamic = "force-dynamic";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);
  const { byId, periodLabel, priceLabel } = localizedTariffs(L);
  const { NOT_FOUND_META } = localizedSeo(L, site);

  return { pageMeta, byId, periodLabel, priceLabel, NOT_FOUND_META };
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const L = await requestLocale();
  const { pageMeta, byId, periodLabel, priceLabel, NOT_FOUND_META } = forLocale(L, await requestSite());

  if (ALL_FREE) return NOT_FOUND_META;
  const slug = (await params).tariff;
  const billing = await getBilling();
  // Недоступный справочник не доказывает, что тариф удалён.
  if (billing.providers === null) return pageMeta({
    title: D.pay.pageTitle[L],
    description: D.pay.pageDescription[L],
    path: `/pay/${slug}`,
    noindex: true,
  });
  const t = byId(billing.items, slug);
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
  const L = await requestLocale();
  const { byId } = forLocale(L, await requestSite());

  if (ALL_FREE) notFound();
  const { items: tariffs, providers, test } = await getBilling();
  const slug = (await params).tariff;
  const t = byId(tariffs, slug);
  if (!t && providers !== null) notFound();

  return <PayScreen locale={L} tariffs={tariffs} initial={t?.id ?? slug} test={test} providers={providers} />;
}
