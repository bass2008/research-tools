import { forLocale as emailForLocale } from "@/lib/email";
import { requestLocale } from "@/lib/i18n/request";
// Общие обработчики BFF. Пути статические (без динамических сегментов) намеренно: rewrites из
// next.config проверяются после файловых маршрутов, но до динамических, и динамический
// `/api/auth/[action]` при заданном API_ORIGIN уехал бы мимо BFF прямо в api.
import { normalizeEmail } from "@/lib/email";
import { D } from "@/lib/i18n";
import { forward, jsonError, readJson } from "./upstream";

function email(body: Record<string, unknown>): string {
  return normalizeEmail(String(body.email ?? ""));
}

/** Вход и регистрация: наружу уходит только `authenticated`, токен — в куку. */
export async function credentials(req: Request, action: "login" | "register") {
  const L = await requestLocale(req);
  const { emailError } = emailForLocale(L);
  const body = await readJson(req);
  const mail = email(body);
  const password = String(body.password ?? "");
  // 422, а не 400: 400 на регистрации означает «почта занята», и экран оплаты по нему уходит
  // пробовать вход. Отказ по формату поля обязан отличаться от занятой почты.
  const wrong = emailError(mail);
  if (wrong) return jsonError((locale) => emailForLocale(locale).emailError(mail)!, L, 422);
  if (password.length < 3) return jsonError(D.bffErrors.shortPassword, L, 422);
  return forward(`/auth/${action}`, {
    method: "POST",
    body: { email: mail, password },
    capture: true,
    source: req,
  });
}

export async function payment(req: Request, path = "/payments/mock") {
  const L = await requestLocale(req);
  const { emailError } = emailForLocale(L);
  const body = await readJson(req);
  const mail = email(body);
  const tariff = String(body.tariff ?? "");
  const wrong = emailError(mail);
  if (wrong) return jsonError((locale) => emailForLocale(locale).emailError(mail)!, L, 422);
  // сам список тарифов живёт в базе: здесь проверяем только форму кода, существование — апстрим
  if (!/^[a-z][a-z0-9_-]{0,15}$/.test(tariff)) return jsonError(D.bffErrors.unknownTariff, L, 400);
  // Цель платежа: либо номер уже сохранённой матрицы, либо дата, которую сервер сохранит сам.
  // Без цели апстрим откажет — разовый тариф впрок не продаётся. Платёжному провайдеру дата
  // не уходит: он видит только сумму и почту.
  const raw = body.matrix_id;
  const matrixId = raw === undefined || raw === null || raw === "" ? undefined : Number(raw);
  if (matrixId !== undefined && (!Number.isInteger(matrixId) || matrixId <= 0)) {
    return jsonError(D.bffErrors.badMatrix, L, 400);
  }
  const birth = body.birth === undefined || body.birth === null || body.birth === ""
    ? undefined
    : String(body.birth);
  const sex = body.sex === undefined || body.sex === null || body.sex === "" ? undefined : String(body.sex);
  if (birth !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
    return jsonError(D.bffErrors.badDate, L, 400);
  }
  if (sex !== undefined && sex !== "m" && sex !== "f") return jsonError(D.bffErrors.badSex, L, 400);
  // Цель другого продукта: номер сохранённого разбора или ввод, который сервер сохранит сам.
  const rawReading = body.reading_id;
  const readingId = rawReading === undefined || rawReading === null || rawReading === "" ? undefined : Number(rawReading);
  if (readingId !== undefined && (!Number.isInteger(readingId) || readingId <= 0)) {
    return jsonError(D.bffErrors.badMatrix, L, 400);
  }
  const inputs = body.inputs === undefined || body.inputs === null ? undefined : body.inputs;
  if (inputs !== undefined && (typeof inputs !== "object" || JSON.stringify(inputs).length > 2000)) {
    return jsonError(D.bffErrors.badDate, L, 400);
  }
  return forward(path, {
    source: req,
    method: "POST",
    body: {
      tariff,
      provider: body.provider,
      email: mail,
      ...(matrixId === undefined ? {} : { matrix_id: matrixId }),
      ...(birth === undefined ? {} : { birth }),
      ...(sex === undefined ? {} : { sex }),
      ...(readingId === undefined ? {} : { reading_id: readingId }),
      ...(inputs === undefined ? {} : { inputs }),
    },
    capture: true,
  });
}

export async function saveMatrix(req: Request) {
  const L = await requestLocale(req);
  const { emailError } = emailForLocale(L);
  const body = await readJson(req);
  const birth = String(body.birth ?? "");
  const sex = String(body.sex ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return jsonError(D.bffErrors.badDate, L, 400);
  if (sex !== "m" && sex !== "f") return jsonError(D.bffErrors.badSex, L, 400);
  const title = body.title === undefined || body.title === null ? undefined : String(body.title).slice(0, 200);
  return forward("/matrices", { source: req, method: "POST", auth: true, body: { birth, sex, title } });
}

/** Individual order: the site builds the automatic readings of the order's dates and sends them
 *  along — the API stores them with the requests it creates once the order is paid. */
export async function individualOrder(req: Request, path: string) {
  const L = await requestLocale(req);
  const { emailError } = emailForLocale(L);
  const body = await readJson(req);
  const mail = email(body);
  const wrong = emailError(mail);
  if (wrong) return jsonError((locale) => emailForLocale(locale).emailError(mail)!, L, 422);
  const raw = Array.isArray(body.persons) ? (body.persons as Record<string, unknown>[]).slice(0, 60) : [];
  const persons = raw.map((p) => ({ birth: String(p?.birth ?? ""), sex: p?.sex === "m" ? "m" : "f" }));
  if (persons.some((p) => !/^\d{4}-\d{2}-\d{2}$/.test(p.birth))) return jsonError(D.bffErrors.badDate, L, 400);
  const kinds = ["personal", "pair", "year"];
  const readings = (Array.isArray(body.readings) ? (body.readings as Record<string, unknown>[]).slice(0, 30) : [])
    .map((r) => ({
      kind: String(r?.kind ?? ""),
      who: (Array.isArray(r?.who) ? r.who : []).slice(0, 2).map((i) => Math.trunc(Number(i))),
      ...(r?.year !== undefined ? { year: Math.trunc(Number(r.year)) || undefined } : {}),
      ...(r?.relation ? { relation: String(r.relation).slice(0, 200) } : {}),
    }));
  // a reading the API would refuse anyway; dropping it here would charge for a different order
  if (readings.some((r) => !kinds.includes(r.kind) || !r.who.length || r.who.some((i) => !(i >= 0 && i < persons.length)))) {
    return jsonError(D.bffErrors.badDate, L, 400);
  }
  const lang = L === "en" ? "en" : "ru";
  // the automatic reading of every person and couple of the order, keyed as the API expects
  const snapshots: Record<string, unknown> = {};
  try {
    const { pairSnapshot, personalSnapshot } = await import("./automaticSnapshot");
    for (const r of readings) {
      const [a, b] = r.who.map((i) => persons[i]);
      if (r.kind === "pair" && b) snapshots[`pair_${r.who[0]}_${r.who[1]}`] ??= pairSnapshot(a.birth, b.birth, lang);
      if (r.kind !== "pair") snapshots[`personal_${r.who[0]}`] ??= personalSnapshot(a.birth, a.sex, lang);
    }
  } catch {
    return jsonError(D.bffErrors.badDate, L, 422);
  }
  return forward(path, {
    source: req,
    method: "POST",
    optionalAuth: true,
    body: {
      provider: body.provider,
      email: mail,
      persons,
      readings,
      question: String(body.question ?? "").slice(0, 5000),
      snapshots,
    },
    capture: true,
  });
}
