// Единственная проверка почты на фронте и в BFF. Раньше в четырёх местах стоял шаблон «есть
// собака и точка», и адрес с точкой перед @ доходил до сервера: покупатель получал «Проверьте
// почту» уже после нажатия «Оплатить» и уходил, не поняв, что именно не так.
//
// Отвергаем ровно то, что отвергнет `EmailStr` (email-validator) на сервере: правила ниже —
// его поведение, снятое прогоном, а не догадка. Проверка идёт по нормализованному значению.

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
  empty: "Введите почту.",
  "no-at": "В адресе нет @ — почта выглядит так: you@mail.ru.",
  "many-at": "В адресе больше одной @.",
  space: "В адресе есть пробел — уберите его.",
  "local-empty": "Перед @ ничего нет — например, you@mail.ru.",
  "local-quoted": "Кавычки в адресе не поддерживаются.",
  "local-dot-start": "Адрес не может начинаться с точки — уберите её.",
  "local-dot-end": "Перед @ стоит точка — уберите её: you@mail.ru.",
  "local-dot-double": "В адресе две точки подряд — оставьте одну.",
  "local-bad-char": "В части до @ недопустимый символ.",
  "domain-empty": "После @ ничего нет — например, you@mail.ru.",
  "domain-no-dot": "В домене после @ нет точки — например, mail.ru.",
  "domain-dot-edge": "Домен не может начинаться или заканчиваться точкой.",
  "domain-dot-double": "В домене две точки подряд.",
  "domain-hyphen-edge": "Часть домена не может начинаться или заканчиваться дефисом.",
  "domain-numeric-tld": "После последней точки должны быть буквы — например, mail.ru.",
  "domain-tld-end": "Домен заканчивается не буквой — проверьте хвост адреса: mail.ru, а не mail.ru2.",
  "domain-special-use": "На такой домен письма не доходят — нужен обычный адрес вроде you@mail.ru.",
  "domain-bad-char": "В домене после @ недопустимый символ.",
  "label-too-long": "Часть домена длиннее 63 знаков.",
  "too-long": "Адрес длиннее 254 знаков.",
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
