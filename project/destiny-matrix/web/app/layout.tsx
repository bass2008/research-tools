import { requestSite } from "@/lib/siteProfile.server";
import TariffsProvider from "@/components/pay/TariffsProvider";
import Footer from "@/components/ui/Footer";
import Header from "@/components/ui/Header";
import LocaleProvider from "@/components/ui/LocaleProvider";
import Metrika from "@/components/ui/Metrika";
import PulseBeacon from "@/components/ui/PulseBeacon";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { requestLocale, publicLocale } from "@/lib/i18n/request";
import { forLocale as localizedSeo } from "@/lib/seo";
import { forLocale as localizedSite } from "@/lib/site";
import type { Metadata, Viewport } from "next";
import { FONT_CLASS, FONT_VARS } from "./fonts";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e8f88",
};

const forLocale = localized((L: Locale, site) => {
  const { SITE } = localizedSite(L, site);
  const { verification } = localizedSeo(L, site);

  const metadata: Metadata = {
    metadataBase: new URL(SITE.url),
    title: {
      default: D.meta.siteTitle[L],
      template: "%s — Arcana Sense",
    },
    description: D.meta.siteDescription[L],
    applicationName: SITE.name,
    // canonical задаёт каждая страница сама (pageMeta): в корневом layout он делал главную
    // канонической для всех 404, потому что при notFound() метаданные сегмента отбрасываются

    openGraph: {
      type: "website",
      // без явного значения og:title наследует заголовок главной — и 404 представлялся ею
      title: SITE.name,
      siteName: SITE.name,
      locale: D.meta.ogLocale[L],
      url: SITE.url,
      images: [{ url: SITE.ogImage, width: SITE.ogWidth, height: SITE.ogHeight, alt: SITE.name }],
    },
    twitter: { card: "summary_large_image", images: [SITE.ogImage] },
    icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
    formatDetection: { telephone: false },
    verification: verification(),
  };
  return { SITE, verification, metadata };
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const L = await requestLocale();
  const site = await requestSite();

  return (
    <html lang={D.meta.htmlLang[L]} className={FONT_CLASS} data-metrika-id={site.metrikaId ?? 0}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FONT_VARS }} />
      </head>
      <body>
        <LocaleProvider locale={L} site={site}>
          <TariffsProvider locale={L}>
            <Header locale={L} />
            {children}
            <Footer locale={L} />
          </TariffsProvider>
          <Metrika />
          <PulseBeacon />
        </LocaleProvider>
      </body>
    </html>
  );
}
export async function generateMetadata() {
  return forLocale(await publicLocale(), await requestSite()).metadata;
}
