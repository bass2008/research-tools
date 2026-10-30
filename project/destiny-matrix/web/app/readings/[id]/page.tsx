import { publicPath } from "@/lib/publicRouting";
import { requestSite } from "@/lib/siteProfile.server";
import SavePdfButton from "@/components/matrix/SavePdfButton";
import PairReport from "@/components/pair/PairReport";
import { pairView } from "@/components/pair/pairView";
import { D } from "@/lib/i18n";
import { DP } from "@/lib/i18n/dict/pair";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale } from "@/lib/i18n/request";
import { pairUnits } from "@/lib/pair/corpus";
import { forLocale as localizedSite } from "@/lib/site";
import { forLocale as localizedTariffs } from "@/lib/tariffs";
import { getBilling } from "@/lib/tariffs.server";
import type { Metadata } from "next";
import Link from "@/components/ui/LocalizedLink";
import { notFound, redirect } from "next/navigation";
import { buyHref } from "@/lib/readingLinks";
import Plans from "@/components/pay/Plans";
import TariffsProvider from "@/components/pay/TariffsProvider";
import { readAccess, readReading } from "../../_lib/access";
import { Sheet } from "../../_lib/report";

// Сохранённый разбор: ввод и толкования печатаются на запрос и только владельцу куки. Платные
// сферы попадают в HTML, только если разбор открыт.
export const dynamic = "force-dynamic";

const forLocale = localized((L: Locale, site) => {
  const { pageMeta } = localizedSite(L, site);
  return { pageMeta };
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const L = await requestLocale();
  const { pageMeta } = forLocale(L, await requestSite());
  const { id } = await params;
  return pageMeta({
    title: DP.savedTitle[L],
    description: DP.savedDescription[L],
    path: `/readings/${encodeURIComponent(id)}`,
    noindex: true,
  });
}

export default async function ReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const L = await requestLocale();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const access = await readAccess();

  if (!access.authenticated) {
    return (
      <Sheet>
        <div className="panel narrow">
          <h1 className="panel-h1">{D.account.needSignIn[L]}</h1>
          <p className="dim">{access.offline ? D.pages.savedMatrixOffline[L] : D.pages.savedReadingOwnerOnly[L]}</p>
          <Link className="btn wide" href="/login">{D.auth.signIn[L]}</Link>
        </div>
      </Sheet>
    );
  }

  const reading = await readReading(Number(id));
  if (!reading) notFound();
  // у личного разбора своя страница, со всей её навигацией по датам
  if (reading.product === "personal") redirect(publicPath(`/matrices/${reading.id}`, L));
  if (reading.product !== "pair") notFound();
  const view = pairView(reading.inputs, L);
  if (!view) notFound();

  const units = pairUnits(L, view.result, view.dates, reading.unlocked);
  const billing = reading.unlocked ? null : await getBilling("pair");
  const offer = billing?.items.find((t) => t.id === "pair");
  const sells = billing !== null && (billing.providers === null || billing.providers.length > 0);

  return (
    <Sheet>
      <PairReport
        locale={L}
        {...view}
        units={units}
        mode={reading.unlocked ? "full" : "free"}
        pdf={reading.unlocked ? <SavePdfButton locale={L} readingId={reading.id} hint={reading.title ?? undefined} /> : null}
        buyHref={sells ? buyHref("pair", reading.id) : undefined}
        plans={billing ? (
          <TariffsProvider product={billing.product} locale={L} server={billing.items} providers={billing.providers}>
            <Plans locale={L} place="pair" carry={{ r: String(reading.id) }} />
          </TariffsProvider>
        ) : null}
        price={offer ? localizedTariffs(L).priceLabel(offer) : null}
      />
    </Sheet>
  );
}
