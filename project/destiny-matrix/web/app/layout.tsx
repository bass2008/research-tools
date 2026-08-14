import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import Metrika from "@/components/Metrika";
import TariffsProvider from "@/components/TariffsProvider";
import { SITE } from "@/lib/site";

import "./globals.css";

// Шрифты лежат в public/fonts (подмножества latin + cyrillic + ₽, см. public/fonts/OFL.txt).
// Запросов к fonts.googleapis.com и fonts.gstatic.com нет намеренно: обе площадки — Google LLC,
// США, а политика сайта обещает, что трансграничной передачи не происходит.
// Имя семейства next/font берёт из имени константы, поэтому они названы по шрифтам.
const cormorantGaramond = localFont({
  src: [{ path: "../public/fonts/cormorant-garamond-600.woff2", weight: "600", style: "normal" }],
  variable: "--font-ser",
  display: "swap",
  fallback: ["Georgia", "serif"],
  preload: true,
});

const manrope = localFont({
  src: [
    { path: "../public/fonts/manrope-400.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/manrope-600.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/manrope-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
  preload: true,
});

// globals.css задаёт --ser/--sans именами семейств, а next/font выдаёт своё, с хешем.
// Селектор `html:root` специфичнее `:root` из globals.css, поэтому порядок подключения стилей
// значения не имеет.
const FONT_VARS =
  `html:root{--ser:${cormorantGaramond.style.fontFamily};--sans:${manrope.style.fontFamily};}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Матрица судьбы — расчёт по дате рождения с расшифровкой",
    template: "%s — Матрица судьбы",
  },
  description:
    "Калькулятор матрицы судьбы: октаграмма 22 арканов, карта энергий по чакрам и разбор " +
    "по 20 разделам. Расчёт карты и два раздела разбора — бесплатно и без регистрации.",
  applicationName: SITE.name,
  alternates: { canonical: SITE.url },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "ru_RU",
    url: SITE.url,
    images: [{ url: SITE.ogImage, width: SITE.ogWidth, height: SITE.ogHeight, alt: SITE.name }],
  },
  twitter: { card: "summary_large_image", images: [SITE.ogImage] },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e8f88",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${cormorantGaramond.variable} ${manrope.variable}`}>
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
      </body>
    </html>
  );
}
