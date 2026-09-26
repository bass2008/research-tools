import { requestSite } from "@/lib/siteProfile.server";
import type { SiteProfile } from "@/lib/siteProfile";
import TariffScope from "@/components/legal/TariffScope";
import Price from "@/components/pay/Price";
import Crumbs from "@/components/ui/Crumbs";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import type { Block, Chunk, LegalDoc } from "@/lib/legal/types";
import { forLocale as localizedSite } from "@/lib/site";
import type { Tariff } from "@/lib/tariffs";
import Link from "next/link";
import { Fragment } from "react";

export const forLocale = localized((L: Locale, site) => {
  const { DISCLAIMER, LEGAL, SUPPORT_BOT } = localizedSite(L, site);

  function shown(block: Block): boolean {
    if (!block.only) return true;
    return block.only === (ALL_FREE ? "free" : "paid");
  }
  return { DISCLAIMER, LEGAL, SUPPORT_BOT, shown };
});

function Piece({ site, locale: requestedLocale, ...localeProps }: ({ chunk: Chunk; site: SiteProfile }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { chunk } = localeProps;
  const { DISCLAIMER, LEGAL, SUPPORT_BOT } = forLocale(L, site);

  if (typeof chunk === "string") return <>{chunk}</>;
  if ("b" in chunk) return <b>{chunk.b}</b>;
  if ("legal" in chunk) return <span className="placeholder">{LEGAL[chunk.legal]}</span>;
  if ("mail" in chunk) return <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>;
  if ("link" in chunk) return <Link href={chunk.link}>{chunk.text}</Link>;
  if ("out" in chunk) return <a href={chunk.out} target="_blank" rel="noopener">{chunk.text}</a>;
  if ("bot" in chunk) {
    return (
      <a href={`https://t.me/${SUPPORT_BOT}`} target="_blank" rel="noopener">@{SUPPORT_BOT}</a>
    );
  }
  if ("price" in chunk) return <Price locale={L} />;
  if ("paid" in chunk) return ALL_FREE ? null : <Line site={site} locale={L} chunks={chunk.paid} />;
  if ("free" in chunk) return ALL_FREE ? <Line site={site} locale={L} chunks={chunk.free} /> : null;
  return <>{DISCLAIMER}</>;
}

function Line({ site, locale: requestedLocale, ...localeProps }: ({ chunks: Chunk[]; site: SiteProfile }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { chunks } = localeProps;

  return (
    <>
      {chunks.map((chunk, i) => (
        <Fragment key={i}>
          <Piece site={site} locale={L} chunk={chunk} />
        </Fragment>
      ))}
    </>
  );
}

export default async function LegalDocView({ locale: requestedLocale, ...localeProps }: ({ doc: LegalDoc; crumb: string; tariffs?: Tariff[] }) & { locale?: Locale }
) {
  const L = requestedLocale ?? defaultLocale;
  const { doc, crumb, tariffs = [] } = localeProps;
  const site = await requestSite();
  const { shown } = forLocale(L, site);

  return (
    <main id="content" className="page">
      <div className="wrap prose">
        <Crumbs locale={L} trail={[{ name: D.nav.home[L], path: "/" }, { name: crumb }]} />
        <h1>{doc.h1}</h1>
        {doc.lead ? <p className="updated"><Line site={site} locale={L} chunks={doc.lead} /></p> : null}
        {doc.blocks.filter(shown).map((block, i) => {
          if ("h2" in block) return <h2 key={i}>{block.h2}</h2>;
          if ("p" in block) return <p key={i}><Line site={site} locale={L} chunks={block.p} /></p>;
          if ("ul" in block) {
            return (
              <ul key={i}>
                {block.ul.map((item, j) => <li key={j}><Line site={site} locale={L} chunks={item} /></li>)}
              </ul>
            );
          }
          return <TariffScope locale={L} key={i} as={block.tariffs} tariffs={tariffs} />;
        })}
      </div>
    </main>
  );
}
