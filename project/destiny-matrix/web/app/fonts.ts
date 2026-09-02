import localFont from "next/font/local";

// Шрифты лежат в public/fonts (подмножества latin + cyrillic + ₽, см. public/fonts/OFL.txt).
// Запросов к fonts.googleapis.com и fonts.gstatic.com нет намеренно: обе площадки — Google LLC,
// США, а политика сайта обещает, что трансграничной передачи не происходит.
// Имя семейства next/font берёт из имени константы, поэтому они названы по шрифтам.
export const cormorantGaramond = localFont({
  src: [{ path: "../public/fonts/cormorant-garamond-600.woff2", weight: "600", style: "normal" }],
  variable: "--font-ser",
  display: "swap",
  fallback: ["Georgia", "serif"],
  preload: true,
});

export const manrope = localFont({
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

/** globals.css задаёт --ser/--sans именами семейств, а next/font выдаёт своё, с хешем.
 *  Селектор `html:root` специфичнее `:root` из globals.css, поэтому порядок стилей не важен. */
export const FONT_VARS =
  `html:root{--ser:${cormorantGaramond.style.fontFamily};--sans:${manrope.style.fontFamily};}`;

/** Классы шрифтовых переменных для <html>. Без них страница набирается запасными
 *  Georgia и системным гротеском — так выглядела 404: логотип и заголовки чужим шрифтом. */
export const FONT_CLASS = `${cormorantGaramond.variable} ${manrope.variable}`;
