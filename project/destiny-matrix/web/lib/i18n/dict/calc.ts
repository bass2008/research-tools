import type { Phrase, PhraseFn } from "./index";

export const calc = {
  formTitle: { ru: "Введите дату рождения", en: "Enter your date of birth" } satisfies Phrase,
  formLead: {
    ru: "Расчёт бесплатный, без регистрации. Карта строится сразу.",
    en: "The calculation is free and needs no sign-up. The chart is built at once.",
  } satisfies Phrase,
  day: { ru: "Число", en: "Day" } satisfies Phrase,
  month: { ru: "Месяц", en: "Month" } satisfies Phrase,
  year: { ru: "Год", en: "Year" } satisfies Phrase,
  sex: { ru: "Пол", en: "Sex" } satisfies Phrase,
  female: { ru: "Женский", en: "Female" } satisfies Phrase,
  male: { ru: "Мужской", en: "Male" } satisfies Phrase,
  femaleChart: { ru: "женская", en: "female" } satisfies Phrase,
  maleChart: { ru: "мужская", en: "male" } satisfies Phrase,
  femaleChartLabel: { ru: "женская карта", en: "female chart" } satisfies Phrase,
  maleChartLabel: { ru: "мужская карта", en: "male chart" } satisfies Phrase,
  sexHint: {
    ru: "Пол попадает в название карты — «мужская» или «женская». На числа и на текст разбора он "
      + "не влияет: в самом методе пола нет.",
    en: "Sex only names the chart — male or female. It changes neither the numbers nor the text "
      + "of the reading: the method itself has no sex.",
  } satisfies Phrase,
  submit: { ru: "Рассчитать матрицу", en: "Calculate the matrix" } satisfies Phrase,
  submitWaiting: { ru: "Секунду, готовим расчёт…", en: "One moment, preparing the calculator…" } satisfies Phrase,
  noScript: {
    ru: "Расчёт идёт прямо в браузере, поэтому нужен включённый JavaScript: дата рождения "
      + "никуда не отправляется, и считать её на сервере мы не станем.",
    en: "The calculation runs in your browser, so JavaScript has to be on: the date of birth is "
      + "never sent anywhere, and we will not compute it on the server.",
  } satisfies Phrase,
  tooManyDays: {
    ru: (days: number) => `В этом месяце ${days} дней — выберите другое число.`,
    en: (days: number) => `This month has ${days} days — pick another one.`,
  } satisfies PhraseFn<[number]>,
  genericError: {
    ru: "Не получилось рассчитать — проверьте дату.",
    en: "The calculation did not go through — check the date.",
  } satisfies Phrase,
  errors: {
    sex: {
      ru: "Выберите пол для однозначного названия карты.",
      en: "Pick a sex so the chart has an unambiguous name.",
    } satisfies Phrase,
    parts: {
      ru: "Проверьте дату: день, месяц и год — числами.",
      en: "Check the date: day, month and year have to be numbers.",
    } satisfies Phrase,
    unreal: {
      ru: "Такой даты нет в календаре — проверьте число и месяц.",
      en: "There is no such date in the calendar — check the day and the month.",
    } satisfies Phrase,
    future: {
      ru: "Дата рождения не может быть в будущем — выберите прошедший день.",
      en: "A date of birth cannot be in the future — pick a day that has passed.",
    } satisfies Phrase,
    tooOld: {
      ru: "Считаем даты рождения начиная с 1900 года.",
      en: "We calculate dates of birth from 1900 onwards.",
    } satisfies Phrase,
    format: {
      ru: "дата должна быть в формате YYYY-MM-DD",
      en: "the date has to be in YYYY-MM-DD format",
    } satisfies Phrase,
  },
};
