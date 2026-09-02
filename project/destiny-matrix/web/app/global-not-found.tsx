import type { Metadata } from "next";

import { NOT_FOUND_META } from "@/lib/seo";

import NotFoundBody from "@/components/ui/NotFoundBody";
import Footer from "@/components/ui/Footer";
import Header from "@/components/ui/Header";

import { FONT_CLASS, FONT_VARS } from "./fonts";

import "./globals.css";

export const metadata: Metadata = NOT_FOUND_META;

// Отдельная страница, а не not-found.tsx: несовпавший адрес Next отдавал стримом, и в HTML
// не было ни заголовка, ни текста — только RSC-пейлоад. Здесь документ собирается целиком.
export default function GlobalNotFound() {
  return (
    <html lang="ru" className={FONT_CLASS}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: FONT_VARS }} />
      </head>
      <body>
        <Header />
        <main id="content" className="page">
          <NotFoundBody />
        </main>
        <Footer />
      </body>
    </html>
  );
}
