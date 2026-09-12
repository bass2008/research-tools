// Дата-пример для клиентских компонентов статических страниц: она стоит в форме расчёта до
// первого ввода и по ней считается карта-пример.
//
// Почему не «сегодня». Страницы печатаются один раз при сборке, в контейнере с UTC. Компонент,
// который берёт дату из `new Date()`, на первом рендере в браузере получает другое число — у
// московского посетителя после полуночи и у всех восточнее — расходится с готовым HTML, React
// ловит расхождение текста (#418) и перерисовывает поддерево.
//
// Почему не дата сборки, как было раньше. Она вшита в разметку каждой страницы с формой, и
// каждая сборка в новый день меняла тело ответа, а с ним встроенный `ETag`: поиск качал заново
// то, что не менялось. Дата публикации корпуса стоит на месте.
//
// Фактическую дату браузера можно брать только после гидратации — `browserDay`.
import { CONTENT_PUBLISHED } from "./corpusDates";

export interface DayParts {
  day: number;
  month: number;
  year: number;
}

function parts(at: Date): DayParts {
  return { day: at.getUTCDate(), month: at.getUTCMonth() + 1, year: at.getUTCFullYear() };
}

export function exampleDay(): DayParts {
  return parts(new Date(`${CONTENT_PUBLISHED}T00:00:00Z`));
}

export function browserDay(): DayParts {
  const now = new Date();
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
}
