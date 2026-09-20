import { encyclopediaSectionHref } from "./encyclopediaNavigation";
import { D, L } from "./i18n";

export interface HeroSlide {
  eyebrow: string;
  heading: string;
  /** вторая кнопка ведёт туда, о чём слайд; первая (покупка) одна на все слайды */
  link: { label: string; href: string };
}

// Тексты слайдов живут в словаре языка, адреса — здесь: путь у всех языков один.
const LANDING_HREFS = [
  "/#plans",
  encyclopediaSectionHref("pts"),
  encyclopediaSectionHref("arc"),
  "/year",
  "/matrix",
];

const ENCYCLOPEDIA_HREFS = [
  "/#plans",
  encyclopediaSectionHref("pts"),
  encyclopediaSectionHref("arc"),
  "/year",
  encyclopediaSectionHref("sec"),
];

function slides(rows: typeof D.slides.landing, hrefs: string[]): HeroSlide[] {
  return rows.map((row, index) => ({
    eyebrow: row.eyebrow[L],
    heading: row.heading[L],
    link: { label: row.link[L], href: hrefs[index] },
  }));
}

// Порядок совпадает с порядком композиций в CalcHero: веер, кольцо, триптих, лента, мозаика.
export const LANDING_SLIDES: HeroSlide[] = slides(D.slides.landing, LANDING_HREFS);

export const ENCYCLOPEDIA_SLIDES: HeroSlide[] = slides(D.slides.encyclopedia, ENCYCLOPEDIA_HREFS);
