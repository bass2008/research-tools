// Печать страницы в PDF. Отдельный сервис по двум причинам: повышенные права нужны только
// браузеру, и наших исходников с секретами он не видит. Делает ровно одно — берёт URL и
// возвращает PDF.
import http from "node:http";
import puppeteer from "puppeteer-core";

const PORT = Number(process.env.PORT ?? 3001);
const SECRET = process.env.BROWSER_SECRET ?? "";
const EXECUTABLE = process.env.CHROME_PATH ?? "/usr/bin/chromium-browser";
const MAX_JOBS = Number(process.env.MAX_JOBS ?? 50);
const MAX_RSS_MB = Number(process.env.MAX_RSS_MB ?? 400);
const PAGE_TIMEOUT = Number(process.env.PAGE_TIMEOUT_MS ?? 150_000);
// Ждать «все картинки complete» до конца нельзя: React меняет src при гидратации, и у
// прерванных запросов complete навсегда остаётся false. Поэтому короткое ожидание плюс тишина
// в сети — этого хватает, карты в файл попадают (проверено: 50 изображений в PDF).
const WAIT_ASSETS = Number(process.env.WAIT_ASSETS_MS ?? 2_500);
const WAIT_IDLE = Number(process.env.WAIT_IDLE_MS ?? 6_000);
const SCALE = Number(process.env.DEVICE_SCALE ?? 1);
// одним листом во всю длину, без разбиения на A4
const SINGLE_PAGE = (process.env.SINGLE_PAGE ?? "1") !== "0";

let browser = null;
let jobs = 0;
// один поток печати: на 0.1 ядра две страницы разом душат друг друга, а очередь снаружи ждать умеет
let chain = Promise.resolve();

async function rssMb() {
  if (!browser) return 0;
  try {
    const pid = browser.process()?.pid;
    if (!pid) return 0;
    const { readFileSync } = await import("node:fs");
    const kb = Number(readFileSync(`/proc/${pid}/statm`, "utf8").split(" ")[1]) * 4;
    return Math.round(kb / 1024);
  } catch {
    return 0;
  }
}

async function live() {
  if (browser?.connected) return browser;
  browser = await puppeteer.launch({
    executablePath: EXECUTABLE,
    // protocolTimeout по умолчанию 180 с: любое подвисшее ожидание держало бы запрос всё это время
    protocolTimeout: 45_000,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--hide-scrollbars",
           "--font-render-hinting=none"],
  });
  jobs = 0;
  return browser;
}

async function recycle(reason) {
  const old = browser;
  browser = null;
  jobs = 0;
  try {
    await old?.close();
  } catch {
    /* уже мёртв */
  }
  console.log(`браузер перезапущен: ${reason}`);
}

/**
 * Печать одним «листом» во всю длину страницы — как сайт, без разбиения. Предел формата PDF —
 * 200 дюймов на сторону (14400 pt), а разбор бывает вдвое длиннее, поэтому лист сжимается ровно
 * настолько, чтобы уложиться: текст остаётся текстом, вектор масштабируется без потерь.
 */
async function onePage(page, marks) {
  const size = await page.evaluate(() => ({
    w: document.documentElement.scrollWidth,
    h: document.documentElement.scrollHeight,
  }));
  // Предел считаем в пикселях, а не в пунктах: 14 400 pt — это 19 200 px, и раньше масштаб
  // подбирался по пунктам, а лист задавался в пикселях. Итог был 14 428 pt, Chromium срезал
  // низ — в файле пропадала подпись под разбором. Пара пикселей запаса гасит округление.
  const LIMIT_PX = 19_190;
  const scale = Math.min(1, LIMIT_PX / size.h);
  const height = Math.floor(size.h * scale);
  marks.push(`лист ${size.w}×${size.h} px → ${height} px, масштаб ${scale.toFixed(3)}`);
  return page.pdf({
    width: `${Math.round(size.w * scale)}px`,
    height: `${height}px`,
    scale,
    printBackground: true,
    margin: { top: "0", bottom: "0", left: "0", right: "0" },
    pageRanges: "1",
  });
}

// Печатей одновременно не больше, чем мест: каждая держит около 65 МБ, а контейнеру отведено 512.
// Предел живёт здесь, а не в api: браузер один на машину, а контуров, которые к нему ходят, два.
const SLOTS = Number(process.env.PRINT_SLOTS ?? 3);
let busy = 0;
const waiting = [];

async function takeSlot() {
  if (busy < SLOTS) {
    busy += 1;
    return;
  }
  await new Promise((resolve) => waiting.push(resolve));
  busy += 1;
}

function freeSlot() {
  busy -= 1;
  const next = waiting.shift();
  if (next) next();
}

async function toPdf(url) {
  await takeSlot();
  try {
    return await printPage(url);
  } finally {
    freeSlot();
  }
}

async function printPage(url) {
  const b = await live();
  const page = await b.newPage();
  const marks = [];
  const mark = (name, from) => marks.push(`${name} ${((Date.now() - from) / 1000).toFixed(1)} с`);
  try {
    await page.setViewport({ width: 1280, height: 1200, deviceScaleFactor: SCALE });
    // Чужие домены отрезаны: аналитика и внешние ресурсы не должны ни задерживать печать, ни
    // попадать в файл — на них уходило всё окно ожидания сети.
    const origin = new URL(url).origin;
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (req.url().startsWith(origin) || req.url().startsWith("data:")) req.continue().catch(() => {});
      else req.abort().catch(() => {});
    });
    let t = Date.now();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    mark("страница", t);
    // Разделы разбора живут в <details>: закрытые попали бы в файл одними заголовками. Карты
    // арканов помечены loading="lazy", поэтому страницу надо ещё и прокрутить — иначе картинки
    // ниже первого экрана не начинают грузиться и печать ждёт их до таймаута.
    await page.evaluate(async () => {
      document.querySelectorAll("details").forEach((d) => (d.open = true));
      document.querySelectorAll("img[loading]").forEach((i) => i.setAttribute("loading", "eager"));
      for (let y = 0; y < document.body.scrollHeight; y += 800) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 30));
      }
      window.scrollTo(0, 0);
    });
    t = Date.now();
    // Ожидания намеренно не обязательные: недогруженная картинка — повод печатать как есть,
    // а не отдавать ошибку. Раньше висящий промис держал запрос все 180 с и ронял печать.
    const ready = await page.waitForFunction(() => Array.from(document.images).every((i) => i.complete),
                                             { timeout: WAIT_ASSETS }).then(() => true, () => false);
    mark("картинки", t);
    if (!ready) {
      // печатаем как есть, но в логе видно, что именно не догрузилось
      const stuck = await page.evaluate(() => Array.from(document.images)
        .filter((i) => !i.complete).slice(0, 3).map((i) => i.currentSrc || i.src)).catch(() => []);
      console.log(`не догрузились: ${stuck.join(", ") || "неизвестно"}`);
    }
    t = Date.now();
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    mark("шрифты", t);
    t = Date.now();
    await page.waitForNetworkIdle({ idleTime: 500, timeout: WAIT_IDLE }).catch(() => {});
    mark("сеть", t);
    // screen, а не print: PDF должен выглядеть страницей, а не её печатной версией
    await page.emulateMediaType("screen");
    t = Date.now();
    const pdf = SINGLE_PAGE ? await onePage(page, marks) : await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "12mm", left: "8mm", right: "8mm" },
    });
    mark("печать", t);
    console.log(`этапы: ${marks.join(", ")}`);
    return pdf;
  } finally {
    await page.close().catch(() => {});
    jobs += 1;
    const rss = await rssMb();
    if (jobs >= MAX_JOBS) await recycle(`${jobs} печатей`);
    else if (rss > MAX_RSS_MB) await recycle(`${rss} МБ памяти`);
  }
}

function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(text);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || "{}");
}

http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return json(res, 200, { ok: true, connected: Boolean(browser?.connected), jobs,
                            rss_mb: await rssMb() });
  }
  if (req.method !== "POST" || !req.url.startsWith("/pdf")) return json(res, 404, { detail: "нет такого" });

  let body;
  try {
    body = await readBody(req);
  } catch {
    return json(res, 400, { detail: "тело не разобрать" });
  }
  if (SECRET && body.secret !== SECRET) return json(res, 403, { detail: "не тот секрет" });
  if (typeof body.url !== "string" || !/^https?:\/\//.test(body.url)) {
    return json(res, 400, { detail: "нужен url" });
  }

  const started = Date.now();
  const task = chain.then(() => toPdf(body.url));
  chain = task.catch(() => {});
  try {
    const pdf = await task;
    console.log(`напечатано ${body.url} за ${((Date.now() - started) / 1000).toFixed(1)} с, ${pdf.length} Б`);
    res.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": pdf.length });
    res.end(pdf);
  } catch (err) {
    console.error(`печать не удалась: ${err?.message ?? err}`);
    await recycle("ошибка печати");
    json(res, 500, { detail: String(err?.message ?? err).slice(0, 300) });
  }
}).listen(PORT, () => console.log(`браузерный сервис на ${PORT}, движок ${EXECUTABLE}`));
