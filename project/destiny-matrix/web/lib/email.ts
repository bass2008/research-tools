// Единственная проверка почты на фронте и в BFF. Раньше в четырёх местах стоял шаблон «есть
// собака и точка», и адрес с точкой перед @ доходил до сервера: покупатель получал «Проверьте
// почту» уже после нажатия «Оплатить» и уходил, не поняв, что именно не так.
//
// Отвергаем ровно то, что отвергнет `EmailStr` (email-validator) на сервере: правила ниже —
// его поведение, снятое прогоном, а не догадка. Проверка идёт по нормализованному значению.

import { D, L } from "./i18n";

export type EmailProblem =
  | "empty"
  | "no-at"
  | "many-at"
  | "space"
  | "local-empty"
  | "local-quoted"
  | "local-dot-start"
  | "local-dot-end"
  | "local-dot-double"
  | "local-bad-char"
  | "domain-empty"
  | "domain-no-dot"
  | "domain-dot-edge"
  | "domain-dot-double"
  | "domain-hyphen-edge"
  | "domain-numeric-tld"
  | "domain-tld-end"
  | "domain-special-use"
  | "domain-bad-char"
  | "label-too-long"
  | "too-long";

// Ноль-ширинные и мягкий перенос приезжают копипастом из писем и мессенджеров; глазами их не
// видно, а сервер такой адрес отвергает. Вычищаем: значащей частью адреса они быть не могут.
const INVISIBLE = /[\u00AD\u180E\u200B-\u200F\u2060\uFEFF]/g;
const NBSP = /[\u00A0\u2007\u202F]/g;
// dot-atom по RFC 5322 плюс не-ASCII: SMTPUTF8 сервер принимает (`юзер@mail.ru` проходит).
const LOCAL_ASCII_OK = /[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.]/;
const DOMAIN_LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u;
// Зоны, которые почту не принимают вовсе: сервер (email_validator) отвергает их отдельным
// сообщением, а человек попадает сюда с адресом рабочей машины или из примера в инструкции.
const SPECIAL_USE = new Set(["arpa", "invalid", "local", "localhost", "onion", "test"]);
const MAX_LENGTH = 254;
const MAX_LABEL = 63;

const MESSAGES: Record<EmailProblem, string> = {
  empty: D.emailErrors["empty"][L],
  "no-at": D.emailErrors["no-at"][L],
  "many-at": D.emailErrors["many-at"][L],
  space: D.emailErrors["space"][L],
  "local-empty": D.emailErrors["local-empty"][L],
  "local-quoted": D.emailErrors["local-quoted"][L],
  "local-dot-start": D.emailErrors["local-dot-start"][L],
  "local-dot-end": D.emailErrors["local-dot-end"][L],
  "local-dot-double": D.emailErrors["local-dot-double"][L],
  "local-bad-char": D.emailErrors["local-bad-char"][L],
  "domain-empty": D.emailErrors["domain-empty"][L],
  "domain-no-dot": D.emailErrors["domain-no-dot"][L],
  "domain-dot-edge": D.emailErrors["domain-dot-edge"][L],
  "domain-dot-double": D.emailErrors["domain-dot-double"][L],
  "domain-hyphen-edge": D.emailErrors["domain-hyphen-edge"][L],
  "domain-numeric-tld": D.emailErrors["domain-numeric-tld"][L],
  "domain-tld-end": D.emailErrors["domain-tld-end"][L],
  "domain-special-use": D.emailErrors["domain-special-use"][L],
  "domain-bad-char": D.emailErrors["domain-bad-char"][L],
  "label-too-long": D.emailErrors["label-too-long"][L],
  "too-long": D.emailErrors["too-long"][L],
};

export function normalizeEmail(raw: string): string {
  return raw
    .replace(INVISIBLE, "")
    .replace(NBSP, " ")
    .trim()
    // копипаст из почтового клиента приезжает как <you@mail.ru>: сервер такой адрес принимает
    .replace(/^<([\s\S]*)>$/, "$1")
    .trim()
    .toLowerCase();
}

export function emailProblem(mail: string): EmailProblem | null {
  if (!mail) return "empty";
  if (mail.length > MAX_LENGTH) return "too-long";
  if (/\s/.test(mail)) return "space";

  const at = mail.split("@");
  if (at.length === 1) return "no-at";
  if (at.length > 2) return "many-at";
  const [local, domain] = at;

  if (!local) return "local-empty";
  if (local.includes('"')) return "local-quoted";
  if (local.startsWith(".")) return "local-dot-start";
  if (local.endsWith(".")) return "local-dot-end";
  if (local.includes("..")) return "local-dot-double";
  for (const ch of local) {
    if (ch.charCodeAt(0) < 128 && !LOCAL_ASCII_OK.test(ch)) return "local-bad-char";
  }

  if (!domain) return "domain-empty";
  if (domain.startsWith(".") || domain.endsWith(".")) return "domain-dot-edge";
  if (domain.includes("..")) return "domain-dot-double";
  const labels = domain.split(".");
  if (labels.length < 2) return "domain-no-dot";
  for (const label of labels) {
    if (label.length > MAX_LABEL) return "label-too-long";
    if (label.startsWith("-") || label.endsWith("-")) return "domain-hyphen-edge";
    if (!DOMAIN_LABEL.test(label)) return "domain-bad-char";
  }
  // Правила домена сняты прогоном с серверного `EmailStr`: последний знак обязан быть буквой
  // (`mail.ru2` и `gmail.com1` он отвергает, а `mail.2ru` и `mail.r2u` принимает), служебные зоны
  // отвергаются отдельно. Пока этого не было, опечатка в хвосте домена доходила до сервера и
  // человек получал общий отказ, который ничего ему не объяснял.
  const tld = labels[labels.length - 1];
  if (SPECIAL_USE.has(tld)) return "domain-special-use";
  if (/^[\p{N}]+$/u.test(tld)) return "domain-numeric-tld";
  if (!/[\p{L}]$/u.test(tld)) return "domain-tld-end";

  return null;
}

export function isValidEmail(value: string): boolean {
  return emailProblem(value) === null;
}

/** Текст для человека или null, если адрес в порядке. Вход — сырое поле ввода. */
export function emailError(raw: string): string | null {
  const problem = emailProblem(normalizeEmail(raw));
  return problem === null ? null : MESSAGES[problem];
}

export function emailProblemMessage(problem: EmailProblem): string {
  return MESSAGES[problem];
}
