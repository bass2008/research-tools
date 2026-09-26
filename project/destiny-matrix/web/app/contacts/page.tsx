import { requestSite } from "@/lib/siteProfile.server";
import Crumbs from "@/components/ui/Crumbs";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

const forLocale = localized((L: Locale, site) => {
  const { LEGAL, pageMeta } = localizedSite(L, site);

  const metadata: Metadata = pageMeta({
    title: D.pages.contactsTitle[L],
    description:
      D.pages.contactsDescription[L],
    path: "/contacts",
  });
  return { LEGAL, pageMeta, metadata };
});

// Реквизиты собраны здесь, а не в подвале каждой страницы: их читают дважды — при проверке
// исполнителя и при обращении. В юридических страницах они остаются: там это обязательная часть.
export default async function ContactsPage() {
  const L = await requestLocale();
  const { LEGAL } = forLocale(L, await requestSite());

  return (
    <main id="content" className="page">
      <div className="wrap prose">
        <Crumbs locale={L} trail={[{ name: D.nav.home[L], path: "/" }, { name: D.pages.contactsCrumb[L] }]} />
        <h1>{D.pages.contactsTitle[L]}</h1>

        <h2>{D.pages.contactsReach[L]}</h2>
        <p>
          {D.pages.contactsMailLead[L]}{" "}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
          {D.pages.contactsMailTail[L]}
        </p>
        <p>
          {D.pages.contactsSupportLead[L]}{" "}
          <Link href="/support">{D.pages.contactsSupportLink[L]}</Link>
          {D.pages.contactsSupportTail[L]}
        </p>
        {/* Про номер платежа — только там, где платят: на открытой витрине его не бывает. */}
        {ALL_FREE ? null : <p>{D.pages.contactsPaymentNote[L]}</p>}

        <h2>{D.pages.contactsSeller[L]}</h2>
        <dl className="kv">
          <dt>{D.pages.contactsName[L]}</dt>
          <dd>{LEGAL.entity}</dd>
          {/* Номера и вид деятельности нужны проверяющему российской кассы: наименование в чеке
              должно им соответствовать. Там, где кассы нет, нет и строк. */}
          {LEGAL.inn ? (
            <>
              <dt>{D.pages.contactsTaxId[L]}</dt>
              <dd>{LEGAL.inn}</dd>
              <dt>{D.pages.contactsRegistration[L]}</dt>
              <dd>{LEGAL.ogrnip}</dd>
              <dt>{D.pages.contactsActivity[L]}</dt>
              <dd>{D.pages.contactsActivityText[L]}</dd>
            </>
          ) : null}
          <dt>{D.pages.contactsSite[L]}</dt>
          <dd>{LEGAL.site}</dd>
          <dt>{D.pages.contactsEmail[L]}</dt>
          <dd>
            <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
          </dd>
          {/* телефон печатается только здесь и только когда задан: его требует эквайрер, закон — нет */}
          {LEGAL.phone ? (
            <>
              <dt>{D.pages.contactsPhone[L]}</dt>
              <dd>
                <a href={`tel:${LEGAL.phone.replace(/[^+\d]/g, "")}`}>{LEGAL.phone}</a>
              </dd>
            </>
          ) : null}
        </dl>

        <h2>{D.pages.contactsDocuments[L]}</h2>
        <p>
          <Link href="/terms">{D.nav.terms[L]}</Link> {D.pages.contactsTermsNote[L]}{" "}
          <Link href="/privacy">{D.nav.privacy[L]}</Link> {D.pages.contactsPrivacyNote[L]}{" "}
          <Link href="/refund">{D.nav.refund[L]}</Link> {D.pages.contactsRefundNote[L]}
        </p>
      </div>
    </main>
  );
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
