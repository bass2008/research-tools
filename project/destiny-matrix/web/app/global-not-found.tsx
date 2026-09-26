import { requestSite } from "@/lib/siteProfile.server";
import GlobalNotFoundContent from "@/components/ui/GlobalNotFoundContent";
import LocaleProvider from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSeo } from "@/lib/seo";
import type { Metadata } from "next";
import { FONT_CLASS, FONT_VARS } from "./fonts";
import "./globals.css";

const forLocale = localized((L: Locale, site) => {
  const { NOT_FOUND_META } = localizedSeo(L, site);

  const metadata: Metadata = NOT_FOUND_META;
  return { NOT_FOUND_META, metadata };
});

// Отдельная страница, а не not-found.tsx: несовпавший адрес Next отдавал стримом, и в HTML
// не было ни заголовка, ни текста — только RSC-пейлоад. Здесь документ собирается целиком.
export default async function GlobalNotFound() {
  const L = await requestLocale();
  const site = await requestSite();

  return (
    <html lang={D.meta.htmlLang[L]} className={FONT_CLASS}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FONT_VARS }} />
      </head>
      <body>
        <LocaleProvider locale={L} site={site} clientLocalized>
          <GlobalNotFoundContent />
        </LocaleProvider>
      </body>
    </html>
  );
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
