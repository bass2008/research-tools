export interface HeroSlide {
  eyebrow: string;
  heading: string;
  /** вторая кнопка ведёт туда, о чём слайд; первая (покупка) одна на все слайды */
  link: { label: string; href: string };
}

// Порядок совпадает с порядком композиций в CalcHero: веер, кольцо, триптих, лента, мозаика.
export const LANDING_SLIDES: HeroSlide[] = [
  {
    eyebrow: "Arcana Sense · матрица судьбы по 22 арканам",
    heading: "Матрица судьбы: разбор по дате рождения",
    link: { label: "Что входит в разбор", href: "/#plans" },
  },
  {
    eyebrow: "17 позиций карты",
    heading: "Октаграмма: где какой аркан стоит именно у вас",
    link: { label: "Позиции карты", href: "/encyclopedia?sec=pts" },
  },
  {
    eyebrow: "портрет · центр · материальная задача",
    heading: "Три аркана, с которых читают вашу карту",
    link: { label: "22 аркана", href: "/encyclopedia?sec=arc" },
  },
  {
    eyebrow: "разбор по десятилетиям до 80 лет",
    heading: "Какая энергия ведёт вас в каждом десятилетии",
    link: { label: "Матрица на год", href: "/na-god" },
  },
  {
    eyebrow: "20 разделов отчёта",
    heading: "Деньги, отношения, род и предназначение — в одном разборе",
    link: { label: "Каталог матриц", href: "/matrix" },
  },
];

export const ENCYCLOPEDIA_SLIDES: HeroSlide[] = [
  {
    eyebrow: "Arcana Sense · 22 аркана",
    heading: "Матрица судьбы по дате рождения",
    link: { label: "Что входит в разбор", href: "/#plans" },
  },
  {
    eyebrow: "17 позиций карты",
    heading: "Посмотрите свои арканы в октаграмме",
    link: { label: "Позиции карты", href: "/encyclopedia?sec=pts" },
  },
  {
    eyebrow: "портрет · центр · материальная задача",
    heading: "Ваши три главных аркана — за минуту",
    link: { label: "22 аркана", href: "/encyclopedia?sec=arc" },
  },
  {
    eyebrow: "разбор по десятилетиям до 80 лет",
    heading: "Аркан вашего года и что он требует",
    link: { label: "Матрица на год", href: "/na-god" },
  },
  {
    eyebrow: "20 разделов отчёта",
    heading: "Весь справочник — на вашей дате рождения",
    link: { label: "Разделы отчёта", href: "/encyclopedia?sec=sec" },
  },
];
