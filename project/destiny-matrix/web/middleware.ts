import { NextResponse, type NextRequest } from "next/server";

import { CONTENT_MODIFIED } from "@/lib/schema";
import { publicSettings } from "@/lib/settings/public";

// Робот спрашивает «страница менялась?» одним из двух способов: `If-None-Match` — по отпечатку
// содержимого, `If-Modified-Since` — по дате. Совпало — сервер отвечает `304` без тела, и проход
// обходится заголовками вместо сотен килобайт разметки. Next сам ставит только `ETag`: на него
// отвечает Google, а Яндекс сверяет дату, поэтому без `Last-Modified` он качал корпус целиком
// на каждом проходе.
//
// Дата берётся из сборки, а не из константы корпуса, и это не мелочь: `Last-Modified` нельзя
// занижать. После релиза измениться могла любая страница — не только текст, но и крошка, и
// разметка, — поэтому единственная честная граница «раньше этого ничего не менялось» — момент
// сборки. Константа `CONTENT_MODIFIED` осталась там, где её смысл верен: `lastmod` карты сайта и
// `dateModified` в разметке относятся к содержанию и от прогона к прогону меняться не должны.
//
// Как это выглядело иначе: релиз c1ca119 сменил каждую страницу корпуса, а дата осталась
// прежней — и прод отвечал `304` на страницы, изменившиеся в тот же час. Отпечаток спас Google,
// спрашивающего датой Яндекса — нет. Руками такую дату двигать нельзя: забудут ровно тогда,
// когда это важно.
//
// Пусто — значит собирали не скриптом релиза (локальный `npm run build`): тогда отступаем к дате
// корпуса, чтобы поведение оставалось определённым. Что скрипты метку передают, сторожит
// `middleware.test.ts`.
const BUILD_ISO = publicSettings.get("buildIso");
const BUILD_AT = BUILD_ISO ? Date.parse(BUILD_ISO) : NaN;
const MODIFIED_AT = Number.isNaN(BUILD_AT) ? Date.parse(`${CONTENT_MODIFIED}T00:00:00Z`) : BUILD_AT;
const LAST_MODIFIED = new Date(MODIFIED_AT).toUTCString();

const withLastModified = (response: NextResponse) => {
  response.headers.set("Last-Modified", LAST_MODIFIED);
  return response;
};

export function middleware(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();

  // Про клиентские переходы здесь ничего нет намеренно. Заголовок `RSC` Next снимает до
  // middleware (замер: до нас доходят только accept, host, if-modified-since, user-agent и
  // x-forwarded-*), поэтому отличить запрос пейлоада роутера нечем — а и не нужно: браузер
  // присылает условный заголовок лишь для ответа, который сам сохранил под тем же ключом
  // `Vary`, так что переиспользует он ровно тот вид ответа, который просит.

  // При обоих условных заголовках побеждает отпечаток, а дата игнорируется (RFC 9110 §13.2.2).
  // Игнорировать её приходится буквально — снятием с запроса. Проверку свежести делает Next
  // ниже по стеку и по своим заголовкам ответа, где `Last-Modified` ещё нет: увидев дату, он
  // считает страницу устаревшей и отдаёт её целиком даже при совпавшем отпечатке. Так Googlebot,
  // узнав дату, начал бы присылать оба заголовка и потерял бы `304`, который получал раньше.
  const raw = request.headers.get("if-modified-since");
  if (request.headers.has("if-none-match")) {
    if (raw === null) return withLastModified(NextResponse.next());
    const headers = new Headers(request.headers);
    headers.delete("if-modified-since");
    return withLastModified(NextResponse.next({ request: { headers } }));
  }

  const since = Date.parse(raw ?? "");
  if (!Number.isNaN(since) && since >= MODIFIED_AT) {
    return new NextResponse(null, { status: 304, headers: { "Last-Modified": LAST_MODIFIED } });
  }

  return withLastModified(NextResponse.next());
}

// Список — только индексируемый корпус, теми же формами адресов, что и в карте сайта; сходство
// сторожит `middleware.test.ts`. Перечислением, а не исключениями: результаты расчёта принимают
// `?birth=` и от него зависит текст, поэтому общий `304` по дате корпуса отдал бы из кэша
// браузера чужой разбор. Пропущенный индексируемый адрес — потерянная экономия, лишний — баг.
export const config = {
  matcher: [
    "/",
    "/encyclopedia",
    "/encyclopedia/arcanum",
    "/encyclopedia/arcanum/:n",
    "/encyclopedia/chakra",
    "/encyclopedia/chakra/:key",
    "/encyclopedia/combination",
    "/encyclopedia/combination/:pair",
    "/encyclopedia/position",
    "/encyclopedia/position/:key",
    "/encyclopedia/position/:key/:n",
    "/encyclopedia/karmic-tail",
    "/encyclopedia/karmic-tail/:triple",
    "/na-god",
    "/na-god/:key",
    "/matrix",
    "/o-metode",
    "/energii",
    "/programmy",
    "/karmicheskaya-matrica",
    "/rasshifrovka",
    "/rasshifrovka-po-date",
    "/rasshifrovka-znachenie",
    "/kak-chitat-matricu",
    "/polnaya-rasshifrovka",
    "/avtor",
    "/contacts",
    "/oferta",
    "/privacy",
    "/refund",
  ],
};
