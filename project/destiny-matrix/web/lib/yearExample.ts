import { D } from "./i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "./i18n/lang";
import { localized } from "./i18n/localized";
import { forLocale as localizedMatrix } from "./matrix";
import { exampleDay } from "./today";

// Как человеку узнать свой аркан года. Двумя способами, и оба сверены с внешним источником
// (`spec/sources/gadalkindom-metodika-raschyota.html` и страница того же сайта про матрицу на год):
//
// 1. Аркан календарного года — свёртка цифр самого года. Источник приводит его дословно:
//    «2027 → 2+0+2+7 = 11». Он общий для всех и не зависит от даты рождения.
// 2. Личный аркан десятилетия — внешний круг карты, восемь секторов по десять лет. Источник:
//    «внешний круг разделён на восемь секторов по десять лет». В движке это `age_scale`
//    (`engine/matrix.py::_age_scale`), обход идёт по кругу от портрета личности.
//
// Пример на конкретной дате подбирается под аркан страницы: на странице «7 на год» он показывает
// человека, который сейчас проживает десятилетие под семёркой. Иначе у двадцати трёх страниц
// оказался бы один и тот же абзац.

export interface YearMath {
  /** год, для которого считаем календарный аркан */
  year: number;
  /** цифры года через плюс: «2+0+2+6» */
  digits: string;
  /** сумма до свёртки */
  sum: number;
  /** сам аркан календарного года */
  arcanum: number;
}

export interface DecadeExample {
  birth: string;
  /** возраст на дату-пример */
  age: number;
  from: number;
  to: number;
  /** подпись точки карты, которая отвечает за это десятилетие */
  label: string;
}

/** A locale-bound view; safe to use alongside other languages. */
export const forLocale = localized((L: Locale) => {
  const { calculate } = localizedMatrix(L);

  /** Год, для которого страница считает календарный аркан.
   *
   *  Берётся на сборке. Дата-пример корпуса (`exampleDay`) для этого не годится: она неподвижна
   *  ради `ETag`, и с первого января страница утверждала бы прошлогодний аркан. Сайт пересобирается
   *  каждым релизом, так что значение обновится само; сторож на расхождение — в content/tests. */
  function buildYear(): number {
    return new Date().getUTCFullYear();
  }

  /** Аркан календарного года: сумма цифр, свёрнутая к 1..22. */
  function calendarYear(year: number): YearMath {
    const digits = String(year).split("");
    let value = digits.reduce((acc, d) => acc + Number(d), 0);
    const sum = value;
    while (value > 22) {
      value = String(value)
        .split("")
        .reduce((acc, d) => acc + Number(d), 0);
    }
    return { year, digits: digits.join("+"), sum, arcanum: value };
  }

  // Порядок внешнего круга — контракт расчёта (`age_scale`), поэтому подписи берутся по нему,
  // а не по алфавиту ключей.
  const RING_LABELS = [
    D.mapPoints.day[L],
    D.mapPoints.father_line[L],
    D.mapPoints.month[L],
    D.mapPoints.mother_line[L],
    D.mapPoints.year[L],
    D.mapPoints.descendants[L],
    D.mapPoints.mission[L],
    D.mapPoints.inheritance[L],
  ].map((label) => label.toLowerCase());

  /** Дата рождения, у которой текущее десятилетие идёт под нужным арканом.
   *
   *  Перебор от даты-примера назад: берём первого попавшегося человека возрастом 20–79 лет.
   *  Дата-пример неподвижна (`exampleDay`), иначе статическая страница и первый рендер в браузере
   *  разошлись бы — та же причина, что у формы расчёта (`docs/decisions.md`, Decision 4). */
  function decadeExample(arcanum: number): DecadeExample | null {
    const today = exampleDay();
    // Порядок перебора разный у каждого аркана, иначе на всех двадцати двух страницах стояли бы
    // один возраст, один сектор круга и одно первое число месяца. Сначала крутим сектора — это
    // разводит примеры сильнее всего, потом возраст внутри сектора, потом день года.
    const sectors = Array.from({ length: 6 }, (_, i) => (i + arcanum) % 6 + 2); // десятилетия 20–80
    const ages: number[] = [];
    for (const decade of sectors) {
      for (let inner = 0; inner < 10; inner++) ages.push(decade * 10 + ((inner + arcanum) % 10));
    }
    const shift = (arcanum * 37) % 366;
    for (const age of ages) {
      const year = today.year - age;
      const days = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1 ? 366 : 365;
      for (let k = 0; k < days; k++) {
        // сдвиг по кругу, а не с начала: `break` на переполнении года пропускал первые дни навсегда
        const step = (k + shift) % days;
        const date = new Date(Date.UTC(year, 0, 1 + step));
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        // берём только дни, уже прошедшие в этом году, иначе возраст на дату-пример будет на год меньше
        if (month > today.month || (month === today.month && day > today.day)) continue;
        const matrix = calculate({ year, month, day }, "f");
        const slot = matrix.age_scale.find((s) => age >= s.from && age < s.to);
        if (!slot || slot.arcanum !== arcanum) continue;
        const index = matrix.age_scale.indexOf(slot);
        return {
          birth: `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`,
          age,
          from: slot.from,
          to: slot.to,
          label: RING_LABELS[index] ?? D.encYear.ringFallback[L],
        };
      }
    }
    return null;
  }
  return { buildYear, calendarYear, decadeExample };
});

// Compatibility for callers that explicitly use the deployment default.
export const { buildYear, calendarYear, decadeExample } = forLocale(defaultLocale);
