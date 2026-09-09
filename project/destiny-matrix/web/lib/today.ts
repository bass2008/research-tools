// «Сегодня» для клиентских компонентов статических страниц.
//
// Страницы печатаются один раз при сборке, в контейнере с UTC. Клиентский компонент, который
// берёт дату из `new Date()`, на первом рендере в браузере получает другое число — у московского
// посетителя после полуночи и у всех восточнее — расходится с готовым HTML, React ловит
// расхождение текста (#418) и перерисовывает поддерево. Дата сборки вшита и в HTML, и в бандл,
// поэтому она совпадает по обе стороны всегда.
//
// Фактическую дату браузера можно брать только после гидратации — `browserDay`.
import { publicSettings } from "./settings/public";

export interface DayParts {
  day: number;
  month: number;
  year: number;
}

function parts(at: Date): DayParts {
  return { day: at.getUTCDate(), month: at.getUTCMonth() + 1, year: at.getUTCFullYear() };
}

export function buildDay(): DayParts {
  const iso = publicSettings.get("buildIso");
  const at = iso ? new Date(iso) : null;
  // собирали не скриптом релиза (`buildIso` пуст) или значение битое: тогда UTC-дата сборки
  // совпадает с UTC-датой открытия — статика в этом случае свежая, её только что собрали
  return parts(at && !Number.isNaN(at.getTime()) ? at : new Date());
}

export function browserDay(): DayParts {
  const now = new Date();
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
}
