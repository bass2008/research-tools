import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n/hosts";
import { INTERNATIONAL_RU } from "@/lib/legal/international";
import { PRIVACY } from "@/lib/legal/privacy";
import { REFUND } from "@/lib/legal/refund";
import { SUPPORT } from "@/lib/legal/support";
import { TERMS } from "@/lib/legal/terms";
import type { Chunk, LegalDoc } from "@/lib/legal/types";
import type { ContentBlock, MobileArticle } from "@/lib/mobileContentContract";
import { forLocale as siteForLocale } from "@/lib/site";
import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";

/** Same document selection as the website: selecting Russian never switches the seller. */
export function legalDocument(path: string, locale: Lang, site: SiteProfile = DEFAULT_SITE): LegalDoc | null {
  const key = path.slice(1);
  if (key === "support") return SUPPORT[locale];
  if (key !== "privacy" && key !== "terms" && key !== "refund") return null;
  if (site.legalLocale === "en" && locale === "ru") return INTERNATIONAL_RU[key];
  return { privacy: PRIVACY, terms: TERMS, refund: REFUND }[key][locale];
}

export function legalArticle(path: string, locale: Lang, site: SiteProfile = DEFAULT_SITE): { document: MobileArticle; doc: LegalDoc | null } | null {
  const doc = legalDocument(path, locale, site);
  if (!doc && path !== "/contacts") return null;
  const { LEGAL, DISCLAIMER, SUPPORT_BOT } = siteForLocale(locale, site);
  const blocks: ContentBlock[] = [];
  const addLink = (label: string, href: string): ContentBlock => ({ type: "link", label, href });
  function chunks(items: Chunk[], links: ContentBlock[]): string {
    return items.map((item): string => {
      if (typeof item === "string") return item;
      if ("b" in item) return `**${item.b}**`;
      if ("legal" in item) return LEGAL[item.legal];
      if ("mail" in item) { links.push(addLink(LEGAL.email, `mailto:${LEGAL.email}`)); return LEGAL.email; }
      if ("link" in item) { links.push(addLink(item.text, item.link)); return item.text; }
      if ("out" in item) { links.push(addLink(item.text, item.out)); return item.text; }
      if ("bot" in item) { links.push(addLink(`@${SUPPORT_BOT}`, `https://t.me/${SUPPORT_BOT}`)); return `@${SUPPORT_BOT}`; }
      if ("paid" in item) return ALL_FREE ? "" : chunks(item.paid, links);
      if ("free" in item) return ALL_FREE ? chunks(item.free, links) : "";
      // A native article must never borrow a RUB web price for a Google Play product.
      if ("price" in item) return D.legal.priceListOnPayPage[locale];
      return DISCLAIMER;
    }).join("");
  }
  const leadLinks: ContentBlock[] = [];
  const lead = doc?.lead ? chunks(doc.lead, leadLinks) : "";
  blocks.push(...leadLinks);
  if (doc) for (const block of doc.blocks) {
    if (block.only && block.only !== (ALL_FREE ? "free" : "paid")) continue;
    const links: ContentBlock[] = [];
    if ("h2" in block) blocks.push({ type: "heading", level: 2, text: block.h2 });
    else if ("p" in block) blocks.push({ type: "paragraph", text: chunks(block.p, links) });
    else if ("ul" in block) blocks.push({ type: "list", ordered: false, items: block.ul.map((row) => chunks(row, links)) });
    else blocks.push({ type: "paragraph", text: D.legal.priceListOnPayPage[locale] });
    blocks.push(...links);
  }
  else {
    blocks.push({ type: "heading", level: 2, text: D.pages.contactsReach[locale] },
      { type: "paragraph", text: `${D.pages.contactsMailLead[locale]} ${LEGAL.email}${D.pages.contactsMailTail[locale]}` }, addLink(LEGAL.email, `mailto:${LEGAL.email}`),
      { type: "paragraph", text: `${D.pages.contactsSupportLead[locale]} ${D.pages.contactsSupportLink[locale]}${D.pages.contactsSupportTail[locale]}` }, addLink(D.pages.contactsSupportLink[locale], "/support"));
    if (!ALL_FREE) blocks.push({ type: "paragraph", text: D.pages.contactsPaymentNote[locale] });
    blocks.push({ type: "heading", level: 2, text: D.pages.contactsSeller[locale] }, {
      type: "table", head: [], rows: [[D.pages.contactsName[locale], LEGAL.entity],
        ...(LEGAL.inn ? [[D.pages.contactsTaxId[locale], LEGAL.inn], [D.pages.contactsRegistration[locale], LEGAL.ogrnip]] : []),
        [D.pages.contactsSite[locale], LEGAL.site], [D.pages.contactsEmail[locale], LEGAL.email], ...(LEGAL.phone ? [[D.pages.contactsPhone[locale], LEGAL.phone]] : [])],
    });
    if (LEGAL.phone) blocks.push(addLink(LEGAL.phone, `tel:${LEGAL.phone.replace(/[^+\d]/g, "")}`));
    blocks.push({ type: "heading", level: 2, text: D.pages.contactsDocuments[locale] }, addLink(D.nav.terms[locale], "/terms"),
      { type: "paragraph", text: D.pages.contactsTermsNote[locale] }, addLink(D.nav.privacy[locale], "/privacy"),
      { type: "paragraph", text: D.pages.contactsPrivacyNote[locale] }, addLink(D.nav.refund[locale], "/refund"), { type: "paragraph", text: D.pages.contactsRefundNote[locale] });
  }
  const title = doc?.h1 ?? D.pages.contactsTitle[locale];
  return { doc, document: { schemaVersion: 1, path, locale, title, lead, blocks,
    breadcrumbs: [{ label: D.nav.home[locale], href: "/" }, { label: title }], access: "public", accessUntil: null } };
}
