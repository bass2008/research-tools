// Приёмка собранного фронта: метаданные, прайс, заглушки, мёртвые ссылки, запретные слова.
//
// Страницы приходят из двух источников. Статика лежит готовым HTML в .next/server/app. Страницы
// с ценой (главная, оплата, оферта) печатаются на запрос — цена живёт в базе, — поэтому на время
// проверки поднимается сервер и они забираются по HTTP. Без этого прайс и реквизиты в оферте
// не проверял бы никто.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = ".next/server/app";
const PORT = Number(process.env.CHECK_PORT ?? 3131);
const ON_DEMAND = ["/", "/oferta", "/pay", "/pay/single"];

const diskFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) diskFiles.push(p);
  }
})(ROOT);

const route = (f) => {
  let r = f.slice(ROOT.length).replace(/\.html$/, "");
  return r === "/index" ? "/" : r || "/";
};

const pages = new Map(diskFiles.map((f) => [route(f), fs.readFileSync(f, "utf8")]));

const known = new Set([...pages.keys(), ...ON_DEMAND]);
const dynamicOk = [/^\/report$/, /^\/account$/, /^\/login$/, /^\/register$/,
  /^\/matrices(\/\d+)?$/, /^\/admin(\/users\/\d+)?$/];

let fails = [];
const fail = (msg) => fails.push(msg);

function stop(proc) {
  try {
    process.kill(-proc.pid, "SIGTERM");
  } catch {
    proc.kill("SIGTERM");
  }
}

async function serve() {
  // next напрямую, без npx: обёртка не передаёт сигнал дальше, и сервер оставался жить
  // после проверки, держа порт и стандартный вывод открытыми. detached — чтобы гасить группу.
  const proc = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(PORT)], {
    stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, NODE_ENV: "production" },
    detached: true,
  });
  let stderr = "";
  proc.stderr.on("data", (d) => (stderr += d.toString()));
  for (let i = 0; i < 120; i++) {
    if (proc.exitCode !== null) throw new Error(`next start упал: ${stderr.slice(0, 400)}`);
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (res.ok) return proc;
    } catch {
      /* сервер ещё поднимается */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  stop(proc);
  throw new Error(`сервер не поднялся за 30 c: ${stderr.slice(0, 400)}`);
}

// в разметке разряды разделены неразрывным пробелом — сравнивать по нему нельзя
const norm = (html) => html.replace(/\u00a0/g, " ").replace(/&nbsp;/g, " ");
const money = (kopecks) => Math.round(kopecks / 100).toLocaleString("ru-RU").replace(/\u00a0/g, " ");

/** Прайс, который сервер напечатал бы сам: из api через BFF, иначе из запасного набора. */
async function priceList() {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/tariffs`);
    if (res.ok) {
      const items = (await res.json()).items;
      if (Array.isArray(items) && items.length) {
        const single = items.find((t) => t.id === "single") ?? items[0];
        return { lead: single.price, all: items.map((t) => t.price) };
      }
    }
  } catch {
    /* api не поднят — сверяем с запасным набором, его же покажет и страница */
  }
  const all = [...fs.readFileSync("lib/tariffs.ts", "utf8").matchAll(/price: ([\d_]+)/g)].map((m) =>
    Number(m[1].replace(/_/g, "")),
  );
  return all.length ? { lead: all[0], all } : null;
}

async function loadOnDemand() {
  const proc = await serve();
  let price = null;
  try {
    price = await priceList();
    for (const r of ON_DEMAND) {
      const res = await fetch(`http://127.0.0.1:${PORT}${r}`);
      if (!res.ok) {
        fail(`${r}: сервер ответил ${res.status} — страница по запросу не открывается`);
        continue;
      }
      pages.set(r, await res.text());
    }
  } finally {
    stop(proc);
  }
  return price;
}

const BANNED_MED = ["лечен", "лечит", "диагноз", "заболеван", "исцел", "целитель", "болезн", "симптом",
  "терапи", "препарат", "набор веса", "алкогол", "уязвимые зоны", "карта здоровья",
  "выздоравл", "недуг", "иммунит", "хроническ", "врач", "клиник"];
const GUARANTEE = ["гарантируем", "гарантия результата", "гарантированно", "точно сбудется", "100% результат"];

let linkChecks = 0;
let imgChecks = 0;

/** Файл на сайте бывает и в public, и маршрутом в app (icon.svg, og-картинка). */
function hasAsset(url) {
  const rel = decodeURIComponent(url).replace(/^\//, "");
  return fs.existsSync(path.join("public", rel)) || fs.existsSync(path.join("app", rel));
}

// Колода — часть содержания этих страниц: 22 аркана, сочетания, матрицы и вход в энциклопедию.
// Без этой проверки картинки могут пропасть из разметки, и приёмка останется зелёной.
const NEEDS_CARD = [
  /^\/encyclopedia$/,
  /^\/encyclopedia\/arcanum\/\d+$/,
  /^\/encyclopedia\/combination\/\d+-\d+$/,
  /^\/matrix\/\d+-\d+-\d+$/,
];
function checkPages() {
for (const [r, html] of pages) {
  const low = html.toLowerCase();

  for (const w of BANNED_MED) if (low.includes(w)) fail(`${r}: медицинская формулировка «${w}»`);
  for (const w of GUARANTEE) if (low.includes(w)) fail(`${r}: обещание гарантии «${w}»`);

  if (!/<title>[^<]{10,}<\/title>/.test(html)) fail(`${r}: нет содержательного <title>`);
  if (!/<meta name="description" content="[^"]{40,}"/.test(html)) fail(`${r}: нет description`);
  if (!/rel="canonical"/.test(html)) fail(`${r}: нет canonical`);
  if (!/property="og:image"/.test(html)) fail(`${r}: нет og:image`);
  if (!/rel="icon"/.test(html)) fail(`${r}: нет favicon`);
  if (/href="#"/.test(html)) fail(`${r}: ссылка в никуда href="#"`);

  // картинки: путь обязан существовать на диске, иначе на странице пустое место
  const imgs = [...html.matchAll(/<img[^>]*\ssrc="(\/[^"]+)"/g)].map((m) => m[1]);
  for (const src of new Set(imgs)) {
    imgChecks++;
    if (src.startsWith("/_next/")) continue;
    if (!hasAsset(src)) fail(`${r}: картинка ${src} — файла нет ни в public, ни в app`);
  }
  // страницы, где карта аркана — часть содержания, а не украшение
  if (NEEDS_CARD.some((re) => re.test(r)) && !imgs.some((s) => s.startsWith("/img/arcana/"))) {
    fail(`${r}: нет карты аркана — колода в public есть, а на странице её не видно`);
  }

  // внутренние ссылки
  for (const m of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    const target = m[1].replace(/\/$/, "") || "/";
    linkChecks++;
    if (target.startsWith("/_next")) continue;
    // ссылка на файл (в том числе preload картинки, который дописывает next) — это не маршрут:
    // проверяем не список страниц, а наличие файла в public
    if (/\.[a-z0-9]{2,5}$/.test(target)) {
      if (/\.(xml|txt)$/.test(target)) continue;                 // sitemap и robots рисует маршрут
      if (!hasAsset(target)) fail(`${r}: ссылка на файл ${target} — его нет ни в public, ни в app`);
      continue;
    }
    if (known.has(target) || dynamicOk.some((re) => re.test(target))) continue;
    fail(`${r}: битая внутренняя ссылка ${target}`);
  }
}
}

// прайс
function checkPrice(prices) {
const home = norm(pages.get("/") ?? "");
if (!home) {
  fail("главная не получена — прайс проверять нечем");
  return;
}
if (prices === null) {
  fail("не удалось узнать прайс ни из api, ни из запасного набора");
  return;
}
const leadPrice = prices.lead;
// Числа тут не зашиты намеренно: цену меняют в базе, и приёмка сверяет страницу с тем же
// источником, из которого её берёт сервер.
const label = `${money(leadPrice)} ₽`;
if (!home.includes(label)) fail(`главная: нет цены рекламируемого тарифа (${label})`);
if (!home.includes(`"price":"${(leadPrice / 100).toFixed(2)}"`))
  fail(`главная: цены ${label} нет в машиночитаемом виде (JSON-LD Offer)`);

const priceIdx = home.indexOf(label);
const resultIdx = home.indexOf('id="result"');
if (priceIdx >= 0 && resultIdx > 0 && priceIdx > resultIdx)
  fail("главная: цена стоит ниже результата, а не в первом экране");

const headEnd = home.indexOf("</head>");
const firstScreen = home.slice(headEnd, headEnd + 12000);
if (!firstScreen.includes(label)) fail("главная: цена не попала в первый экран");

// дата рождения не должна попадать в разметку ссылок оплаты
for (const m of home.matchAll(/href="\/pay\/[^"]*"/g)) {
  if (/\d{4}-\d{2}-\d{2}|birth|date=/.test(m[0])) fail(`главная: дата в ссылке оплаты ${m[0]}`);
}

// страница оплаты обязана показывать ту же цену, что спишет касса
const pay = norm(pages.get("/pay/single") ?? "");
if (pay && !pay.includes(label)) fail(`/pay/single: цена не совпадает с прайсом (${label})`);

// выбор тарифа на /pay должен быть настоящим: видны все цены прайса, а не только ведущая
const choice = norm(pages.get("/pay") ?? "");
for (const p of prices.all) {
  const one = `${money(p)} ₽`;
  if (choice && !choice.includes(one)) fail(`/pay: в выборе тарифа нет цены ${one}`);
}
}

// Реквизиты: критерий один на весь сайт — реквизит либо настоящий, либо
// заглушка, помеченная как заглушка. Требовать наличия заглушек нельзя: тогда заполненный
// сайт красит приёмку, а браузерный набор красит незаполненный, и одновременно зелёными
// гейты не бывают. Правила: ⟨…⟩ = заглушка, внутри обязательно словесное описание (цифры в
// скобках читались бы как настоящий ИНН); без скобок — форма реквизита; полузаполненное
// состояние запрещено; явные подделки запрещены всегда.
const REQUISITES = {
  // метка без значения (проза «укажите ИНН») реквизитом не считается — иначе гейт падал бы на формулировках
  ИНН: { find: /ИНН[\s:]*(⟨[^⟩]*⟩|\d[\d\s-]*)/, digits: [10, 12], human: "10 или 12 цифр" },
  ОГРНИП: { find: /ОГРНИП[\s:]*(⟨[^⟩]*⟩|\d[\d\s-]*)/, digits: [15], human: "15 цифр" },
  // наименование ищется по форме, а не по метке: «ИП» встречается и в прозе
  наименование: {
    find: /(⟨ИП[^⟩]*⟩|ИП\s+[А-ЯЁ][а-яё-]+\s+[А-ЯЁ]\.\s?[А-ЯЁ]\.)/,
    real: /^ИП\s+[А-ЯЁ][а-яё-]+\s+[А-ЯЁ]\.\s?[А-ЯЁ]\.$/,
    human: "ИП Фамилия И. О.",
  },
};
const FAKES = ["example.com", "example.ru", "example.org", "lorem ipsum"];
const legalState = {};

function checkLegal() {
for (const legal of ["/oferta", "/privacy", "/refund"]) {
  const html = pages.get(legal) ?? "";
  if (!html) {
    fail(`${legal}: страница не получена — реквизиты проверять нечем`);
    continue;
  }
  if (html.length < 6000) fail(`${legal}: текст подозрительно короткий (${html.length} байт)`);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

  const kinds = new Set();
  let seen = 0;
  for (const [name, rule] of Object.entries(REQUISITES)) {
    const m = rule.find.exec(text);
    if (!m || !m[1].trim()) continue;
    seen++;
    const value = m[1].trim();
    if (value.startsWith("⟨")) {
      kinds.add("заглушка");
      if (!/[А-Яа-яЁё]/.test(value.replace(/[⟨⟩]/g, "")))
        fail(`${legal}: заглушка ${name} без описания — «${value}»: цифры в скобках читаются как реквизит`);
      continue;
    }
    kinds.add("реквизит");
    if (rule.real) {
      if (!rule.real.test(value))
        fail(`${legal}: ${name} = «${value}» — это ни заглушка ⟨…⟩, ни реквизит (${rule.human})`);
      continue;
    }
    const digits = value.replace(/\D/g, "");
    if (!rule.digits.includes(digits.length))
      fail(`${legal}: ${name} = «${value}» — это ни заглушка ⟨…⟩, ни реквизит (${rule.human})`);
    else if (/^0+$/.test(digits))
      fail(`${legal}: ${name} из одних нулей («${value}») выдан за настоящий реквизит`);
  }
  if (!seen) fail(`${legal}: реквизитов нет вовсе — ни ИНН, ни ОГРНИП, ни наименования ИП`);
  if (kinds.size > 1) fail(`${legal}: реквизиты заполнены наполовину — либо все заглушки, либо все настоящие`);
  const low = text.toLowerCase();
  for (const fake of FAKES) if (low.includes(fake)) fail(`${legal}: подделка под настоящие данные — «${fake}»`);
  if (low.includes("фамилия и. о.") && !text.includes("⟨"))
    fail(`${legal}: «ИП Фамилия И. О.» напечатано как настоящее наименование`);
  legalState[legal] = [...kinds].join("+") || "нет";
}
}

function finish() {
const states = new Set(Object.values(legalState));
if (states.size > 1) fail(`юридические страницы в разном состоянии по реквизитам: ${JSON.stringify(legalState)}`);
console.log(`реквизиты: ${[...states].join(", ")} (заглушки допустимы до передачи реквизитов владельцем; с ними не запускать)`);

// ── пейволл: платные тексты не должны уезжать в браузер ────────────────────────────────
// Толкования и подписи позиций 14 платных разделов живут в lib/sections.ts, и её импортирует
// только серверный код. Один импорт из компонента с "use client" — и всё это лежит в чанке,
// который видно в исходнике страницы. Здесь это ловится грепом по собранным чанкам.
const paidSrc = fs.readFileSync("lib/sections.ts", "utf8");
const paidBlock = paidSrc.slice(paidSrc.indexOf("const PAID_DETAIL"), paidSrc.indexOf("export const SPEC"));
const paidTexts = [
  ...[...paidBlock.matchAll(/lead: "([^"]+)"/g)].map((m) => m[1]),
  ...[...paidBlock.matchAll(/\["([^"]+)",/g)].map((m) => m[1]),
];
// подписи, которые есть и в публичной части (например «Денежный канал» в главных точках),
// секретом не являются — сторож смотрит только на то, что бывает лишь в платном разборе
const publicSrc = ["components/publicSpec.ts", "components/MatrixResult.tsx"]
  .map((f) => fs.readFileSync(f, "utf8"))
  .join("\n");
const paidOnly = [...new Set(paidTexts)].filter((t) => !publicSrc.includes(t));
if (paidOnly.length < 30) {
  fail(`сторож пейволла ослеп: платных текстов для проверки всего ${paidOnly.length} (ждём ≥30)`);
}
const chunks = [];
(function walkChunks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkChunks(p);
    else if (e.name.endsWith(".js")) chunks.push(p);
  }
})(".next/static/chunks");
if (!chunks.length) fail("не найдено ни одного клиентского чанка — проверять пейволл нечем");
for (const f of chunks) {
  const js = fs.readFileSync(f, "utf8");
  for (const t of paidOnly) {
    if (js.includes(t)) fail(`платный текст «${t}» в клиентском чанке ${path.basename(f)}`);
  }
}
// Толкования платных разделов («аркан N в этом блоке») — это и есть товар. В клиентский
// бандл они попасть не должны: браузер получает только тексты двух бесплатных разделов.
const paidKeys = [...fs.readFileSync("components/publicSpec.ts", "utf8")
  .matchAll(/key:\s*"([a-z_0-9]+)",\s*title:\s*"[^"]*",\s*access:\s*"paid"/g)].map((m) => m[1]);
if (paidKeys.length < 15) fail(`сторож толкований ослеп: платных разделов найдено ${paidKeys.length}`);
const corpus = JSON.parse(fs.readFileSync("content/arcana.json", "utf8")).items ?? [];
const paidReadings = [];
for (const a of corpus) {
  for (const key of paidKeys) {
    const t = a.in_positions?.[key];
    if (typeof t === "string" && t.length > 60) paidReadings.push(t.slice(0, 60));
  }
}
if (paidReadings.length < 100) fail(`сторож толкований: текстов для проверки всего ${paidReadings.length}`);
for (const f of chunks) {
  const js = fs.readFileSync(f, "utf8");
  for (const t of paidReadings) {
    if (js.includes(t)) fail(`платное толкование «${t}…» в клиентском чанке ${path.basename(f)}`);
  }
}

if (fs.existsSync(path.join(ROOT, "report.html"))) {
  fail("/report предрендерен: платные разделы попали бы в готовый HTML (нужен force-dynamic)");
}

// счётчик и цели
const layoutJs = fs.readFileSync("components/Metrika.tsx", "utf8");
for (const need of ["notBounce", "NEXT_PUBLIC_METRIKA_ID"]) {
  if (!layoutJs.includes(need) && !fs.readFileSync("lib/analytics.ts", "utf8").includes(need))
    fail(`Метрика: нет ${need}`);
}

console.log(`страниц: ${pages.size} (по запросу: ${ON_DEMAND.length}), ссылок: ${linkChecks}, картинок: ${imgChecks}`);
if (fails.length) {
  console.log(`ПРОВАЛОВ: ${fails.length}`);
  const seen = new Set();
  for (const f of fails) {
    const key = f.replace(/^[^:]+:/, "");
    if (seen.has(key) && seen.size > 40) continue;
    seen.add(key);
    console.log(" -", f);
  }
  process.exit(1);
}
console.log("ВСЁ ЧИСТО");
}

(async () => {
  const price = await loadOnDemand();
  checkPages();
  checkPrice(price);
  checkLegal();
  finish();
})().catch((err) => {
  console.error(`приёмка не смогла проверить страницы по запросу: ${err.message}`);
  process.exit(1);
});
