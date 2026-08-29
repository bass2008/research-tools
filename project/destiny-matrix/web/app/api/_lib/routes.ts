// Общие обработчики BFF. Пути статические (без динамических сегментов) намеренно: rewrites из
// next.config проверяются после файловых маршрутов, но до динамических, и динамический
// `/api/auth/[action]` при заданном API_ORIGIN уехал бы мимо BFF прямо в api.
import { forward, json, readJson } from "./upstream";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function email(body: Record<string, unknown>): string {
  return String(body.email ?? "").trim().toLowerCase();
}

/** Вход и регистрация: наружу уходит только `authenticated`, токен — в куку. */
export async function credentials(req: Request, action: "login" | "register") {
  const body = await readJson(req);
  const mail = email(body);
  const password = String(body.password ?? "");
  if (!EMAIL_RE.test(mail)) return json({ detail: "Проверьте адрес почты" }, 400);
  if (password.length < 3) return json({ detail: "Пароль — не короче трёх знаков" }, 400);
  return forward(`/auth/${action}`, {
    method: "POST",
    body: { email: mail, password },
    capture: true,
    source: req,
  });
}

export async function payment(req: Request, path = "/payments/mock") {
  const body = await readJson(req);
  const mail = email(body);
  const tariff = String(body.tariff ?? "");
  if (!EMAIL_RE.test(mail)) return json({ detail: "Проверьте адрес почты" }, 400);
  // сам список тарифов живёт в базе: здесь проверяем только форму кода, существование — апстрим
  if (!/^[a-z][a-z0-9_-]{0,15}$/.test(tariff)) return json({ detail: "Неизвестный тариф" }, 400);
  // Цель платежа: либо номер уже сохранённой матрицы, либо дата, которую сервер сохранит сам.
  // Без цели апстрим откажет — разовый тариф впрок не продаётся. Платёжному провайдеру дата
  // не уходит: он видит только сумму и почту.
  const raw = body.matrix_id;
  const matrixId = raw === undefined || raw === null || raw === "" ? undefined : Number(raw);
  if (matrixId !== undefined && (!Number.isInteger(matrixId) || matrixId <= 0)) {
    return json({ detail: "Неверная матрица" }, 400);
  }
  const birth = body.birth === undefined || body.birth === null || body.birth === ""
    ? undefined
    : String(body.birth);
  const sex = body.sex === undefined || body.sex === null || body.sex === "" ? undefined : String(body.sex);
  if (birth !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) {
    return json({ detail: "Дата — в формате YYYY-MM-DD" }, 400);
  }
  if (sex !== undefined && sex !== "m" && sex !== "f") return json({ detail: "Пол — m или f" }, 400);
  return forward(path, {
    method: "POST",
    body: {
      tariff,
      email: mail,
      ...(matrixId === undefined ? {} : { matrix_id: matrixId }),
      ...(birth === undefined ? {} : { birth }),
      ...(sex === undefined ? {} : { sex }),
    },
    capture: true,
  });
}

export async function lead(req: Request) {
  const body = await readJson(req);
  const mail = email(body);
  if (!EMAIL_RE.test(mail)) return json({ detail: "Проверьте адрес почты" }, 400);
  const source = body.source === undefined ? undefined : String(body.source).slice(0, 64);
  return forward("/leads", { method: "POST", body: { email: mail, source } });
}

export async function saveMatrix(req: Request) {
  const body = await readJson(req);
  const birth = String(body.birth ?? "");
  const sex = String(body.sex ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return json({ detail: "Дата — в формате YYYY-MM-DD" }, 400);
  if (sex !== "m" && sex !== "f") return json({ detail: "Пол — m или f" }, 400);
  const title = body.title === undefined || body.title === null ? undefined : String(body.title).slice(0, 200);
  return forward("/matrices", { method: "POST", auth: true, body: { birth, sex, title } });
}
