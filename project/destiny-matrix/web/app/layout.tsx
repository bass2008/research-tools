import type { Metadata, Viewport } from "next";

import Footer from "@/components/ui/Footer";
import Header from "@/components/ui/Header";
import Metrika from "@/components/ui/Metrika";
import PulseBeacon from "@/components/ui/PulseBeacon";
import TariffsProvider from "@/components/pay/TariffsProvider";
import { FONT_CLASS, FONT_VARS } from "./fonts";
import { SITE } from "@/lib/site";
import { verification } from "@/lib/seo";

import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Матрица судьбы — расчёт по дате рождения с расшифровкой",
    template: "%s — Arcana Sense",
  },
  description:
    "Калькулятор матрицы судьбы: октаграмма 22 арканов, карта энергий по чакрам и разбор " +
    "по 20 разделам. Расчёт карты и два раздела разбора — бесплатно и без регистрации.",
  applicationName: SITE.name,
  // canonical задаёт каждая страница сама (pageMeta): в корневом layout он делал главную
  // канонической для всех 404, потому что при notFound() метаданные сегмента отбрасываются

  openGraph: {
    type: "website",
    // без явного значения og:title наследует заголовок главной — и 404 представлялся ею
    title: SITE.name,
    siteName: SITE.name,
    locale: "ru_RU",
    url: SITE.url,
    images: [{ url: SITE.ogImage, width: SITE.ogWidth, height: SITE.ogHeight, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", images: [SITE.ogImage] },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  formatDetection: { telephone: false },
  verification: verification(),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e8f88",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={FONT_CLASS}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FONT_VARS }} />
      </head>
      <body>
        <TariffsProvider>
          <Header />
          {children}
          <Footer />
        </TariffsProvider>
        <Metrika />
        <PulseBeacon />
      </body>
    </html>
  );
}
