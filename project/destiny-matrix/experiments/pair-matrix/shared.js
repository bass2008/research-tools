(function () {
  const { personal, pair, validate, fold } = window.PairMatrix;

  const DEFAULTS = { an: "Сергей", as: "m", a: "1993-03-31", bn: "Виктория", bs: "f", b: "1994-12-28" };

  const VARIANTS = [
    { file: "index.html", label: "Исходный" },
    { file: "v1.html", label: "1 · Слияние" },
    { file: "v2.html", label: "2 · Журнал" },
    { file: "v3.html", label: "3 · Навигатор" },
    { file: "v4.html", label: "4 · Расклад" },
    { file: "v5.html", label: "5 · Истории" },
  ];

  const ARCANA = ["", "Маг", "Жрица", "Императрица", "Император", "Иерофант", "Влюблённые", "Колесница",
    "Справедливость", "Отшельник", "Колесо", "Сила", "Повешенный", "Смерть", "Умеренность", "Дьявол",
    "Башня", "Звезда", "Луна", "Солнце", "Суд", "Мир", "Шут"];

  const IMG = (n, full = false) =>
    `../../web/public/img/arcana/${full ? "" : "half/"}gen-${String(n).padStart(2, "0")}.webp`;

  const POINTS = {
    A: { book: "Б", name: "Образ пары для других" },
    B: { book: "В", name: "Ради чего встретились" },
    C: { book: "Г", name: "Отношение к материальному" },
    D: { book: "Д", name: "Главная задача пары" },
    E: { book: "А", name: "Атмосфера внутри пары" },
    F: { book: "Е", name: "Что наполняет союз" },
    G: { book: "Ё", name: "Что может испортить" },
    H: { book: "Ж", name: "Скрытое, усилитель" },
    I: { book: "З", name: "Скрытое, усилитель" },
    J: { book: "Б1", name: "Пара как родители" },
    O: { book: "Б2", name: "Отношение к ребёнку" },
    K: { book: "В1", name: "Дополнение к «ради чего»" },
    P: { book: "В2", name: "Дополнение к «ради чего»" },
    L: { book: "Г1", name: "Вход в линию денег" },
    Q: { book: "Г2", name: "Дополнение к материальному" },
    M: { book: "Д1", name: "Общий язык и желания" },
    N: { book: "Д2", name: "Середина хвоста пары" },
    R: { book: "К", name: "Финансовые «пробоины»" },
    R1: { book: "И", name: "Потенциал пары" },
    R2: { book: "Л", name: "Путь к достатку" },
    S: { book: "—", name: "Зелёная точка, в паре не читается" },
    T: { book: "—", name: "Зелёная точка, в паре не читается" },
    sky: { book: "Небо", name: "Небо" },
    ground: { book: "Земля", name: "Земля" },
    male: { book: "М", name: "Мужское" },
    female: { book: "Ж", name: "Женское" },
    personal: { book: "ЛП", name: "Личное предназначение" },
    social: { book: "СП", name: "Социальное предназначение" },
    spiritual: { book: "ДП", name: "Ценности пары (духовное)" },
  };

  const SECTIONS = [
    { id: "atmosphere", title: "Атмосфера внутри пары", short: "Атмосфера", points: ["E"], main: true,
      text: "То, что партнёры чувствуют друг к другу и что не выставляется напоказ." },
    { id: "meet", title: "Ради чего встретились", short: "Ради чего встретились", points: ["A", "B"], main: true,
      text: "Две точки читаются вместе: плюсы обеих энергий дают смысл встречи, минусы — испытания. Вторая точка читается только в плюсе: что паре нужно создать." },
    { id: "tasks", title: "Задачи пары", short: "Задачи пары", points: ["M", "N", "D"], chain: true, main: true,
      text: "Кармический хвост пары: главные испытания и то, чему паре предстоит научиться. Читается прежде всего в минусе." },
    { id: "values", title: "Ценности пары", short: "Ценности", points: ["spiritual"], main: true,
      text: "Духовное предназначение пары: к чему стремиться вместе и как держать отношения «на плаву»." },
    { id: "image", title: "Какой пару видят другие", short: "Образ пары", points: ["A"],
      text: "Образ, который пара показывает окружающим. Он может не совпадать с тем, что происходит внутри." },
    { id: "fills", title: "Что наполняет союз", short: "Что наполняет", points: ["F"],
      text: "На чём держатся отношения и что помогает их восстанавливать." },
    { id: "spoils", title: "Что может испортить", short: "Что может испортить", points: ["G"],
      text: "Где возможны серьёзные конфликты, недоговорённость и непринятие друг друга." },
    { id: "material", title: "Отношение к материальному", short: "Материальное", points: ["C", "Q", "L"], chain: true,
      text: "Хозяйство, ремонт, траты, накопления, наследство — как пара обращается с материальным." },
    { id: "money", title: "Деньги пары", short: "Деньги", points: ["L", "R2", "R"], chain: true,
      text: "Трудности с доходом, путь к достатку и финансовые «пробоины», которые бьют по отношениям." },
    { id: "relations", title: "Отношения и общий язык", short: "Отношения", points: ["R", "R1", "M"], chain: true,
      text: "Взаимопонимание и общие желания: как пара договаривается и решает вопросы между собой." },
    { id: "parents", title: "Пара как родители", short: "Родители", points: ["J", "O"],
      text: "Какими партнёры будут родителями вместе и что направят на ребёнка." },
  ];

  const GEO = { C: 310, R: 248, RIN: 142, RMID: 195, RHALF: 71 };
  const CHAKRA = ["#c9453a", "#dd7b2a", "#d9ac1e", "#159c69", "#1f9ed6", "#3f5ec9", "#8e5bc4"];
  const GREY = "#7d92a1";
  const NODES = [
    { k: "N", angle: 90, r: GEO.RMID, size: "s", color: GREY },
    { k: "O", angle: 180, r: GEO.RMID, size: "s", color: GREY },
    { k: "P", angle: -90, r: GEO.RMID, size: "s", color: GREY },
    { k: "Q", angle: 0, r: GEO.RMID, size: "s", color: GREY },
    { k: "S", angle: 180, r: GEO.RHALF, size: "s", color: GREY, muted: true },
    { k: "T", angle: -90, r: GEO.RHALF, size: "s", color: GREY, muted: true },
    { k: "R", angle: 45, r: GEO.RIN, size: "s", color: GREY },
    { k: "R1", angle: 67.5, r: GEO.RIN, size: "s", color: GREY },
    { k: "R2", angle: 22.5, r: GEO.RIN, size: "s", color: GREY },
    { k: "J", angle: 180, r: GEO.RIN, size: "i", color: GREY },
    { k: "K", angle: -90, r: GEO.RIN, size: "i", color: GREY },
    { k: "L", angle: 0, r: GEO.RIN, size: "i", color: GREY },
    { k: "M", angle: 90, r: GEO.RIN, size: "i", color: GREY },
    { k: "A", angle: 180, r: GEO.R, size: "b", color: CHAKRA[2] },
    { k: "F", angle: 225, r: GEO.R, size: "m", color: CHAKRA[5] },
    { k: "B", angle: -90, r: GEO.R, size: "b", color: CHAKRA[6] },
    { k: "G", angle: -45, r: GEO.R, size: "m", color: CHAKRA[5] },
    { k: "C", angle: 0, r: GEO.R, size: "b", color: CHAKRA[4] },
    { k: "H", angle: 45, r: GEO.R, size: "m", color: CHAKRA[3] },
    { k: "D", angle: 90, r: GEO.R, size: "b", color: CHAKRA[0] },
    { k: "I", angle: 135, r: GEO.R, size: "m", color: CHAKRA[1] },
    { k: "E", angle: 0, r: 0, size: "c", color: "#0e8f88" },
  ];
  const SIZE = { s: [13, 11], i: [15, 13], m: [19, 15.5], b: [24, 19], c: [31, 23] };

  const pt = (angle, radius) => {
    const a = (angle * Math.PI) / 180;
    return [GEO.C + radius * Math.cos(a), GEO.C + radius * Math.sin(a)];
  };
  const f1 = (n) => n.toFixed(1);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const fmtDate = (iso) => iso.split("-").reverse().join(".");
  const SEX = { m: "мужчина", f: "женщина" };

  function octagram(m, { id = "", live = false, focus = null, cls = "" } = {}) {
    const octagon = [180, 225, -90, -45, 0, 45, 90, 135].map((a) => pt(a, GEO.R).map(f1).join(",")).join(" ");
    const sq1 = [-90, 0, 90, 180].map((a) => pt(a, GEO.RIN).map(f1).join(",")).join(" ");
    const sq2 = [-45, 45, 135, 225].map((a) => pt(a, GEO.RIN).map(f1).join(",")).join(" ");
    const axes = [180, 225, -90, -45].map((a) => {
      const [x1, y1] = pt(a, GEO.R), [x2, y2] = pt(a + 180, GEO.R);
      return `<line class="axis" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"/>`;
    }).join("");
    const nodes = NODES.map((n) => {
      const [x, y] = pt(n.angle, n.r);
      const [r, fs] = SIZE[n.size];
      const v = m[n.k];
      const on = focus && focus.includes(n.k) ? " hl" : "";
      return `<g class="node size-${n.size}${n.muted ? " muted" : ""}${on}" data-point="${n.k}" style="--point:${n.color}">` +
        `<title>${esc(`${POINTS[n.k].name}: ${v} · ${ARCANA[v]}`)}</title>` +
        `<circle class="halo" cx="${f1(x)}" cy="${f1(y)}" r="${r + 6}"/>` +
        `<circle class="dot" cx="${f1(x)}" cy="${f1(y)}" r="${r}"/>` +
        `<text class="n" x="${f1(x)}" y="${f1(y)}" font-size="${fs}">${v}</text></g>`;
    }).join("");
    const classes = ["oct", cls, focus ? "has-hl" : ""].filter(Boolean).join(" ");
    return `<svg class="${classes}"${id ? ` id="${id}"` : ""}${live ? " data-live" : ""} viewBox="0 0 620 620" role="img" aria-label="Схема матрицы">` +
      `<circle class="ring" cx="310" cy="310" r="${GEO.R + 38}"/><circle class="ring" cx="310" cy="310" r="${GEO.R + 22}"/>` +
      `<polygon class="side" points="${octagon}"/><polygon class="diag" points="${sq1}"/><polygon class="diag" points="${sq2}"/>` +
      axes + nodes + `</svg>`;
  }

  const bub = (n, extra = "") => `<span class="bub${extra}">${n}</span>`;
  const chip = (n) => `<span class="chip">${bub(n)}<span class="chip-nm">${ARCANA[n]}</span></span>`;
  const values = (s, p) => s.points.map((k) => p[k]);
  const numbers = (s, p) => values(s, p).join(s.chain ? "-" : " + ");

  function highlight(keys) {
    document.querySelectorAll("svg.oct[data-live]").forEach((svg) => {
      svg.classList.toggle("has-hl", Boolean(keys));
      svg.querySelectorAll(".node").forEach((n) => n.classList.toggle("hl", Boolean(keys) && keys.includes(n.dataset.point)));
    });
  }

  function wireHover(scope = document) {
    scope.querySelectorAll("[data-points]").forEach((el) => {
      el.addEventListener("mouseenter", () => highlight(el.dataset.points.split(" ")));
      el.addEventListener("mouseleave", () => highlight(null));
    });
  }

  function sumLine(k, a, b) {
    const raw = a[k] + b[k];
    return `${a[k]} + ${b[k]} = ${raw}${raw > 22 ? ` → ${fold(raw)}` : ""}`;
  }

  function readState() {
    const q = new URLSearchParams(location.search);
    const state = {};
    for (const key of Object.keys(DEFAULTS)) state[key] = q.get(key) || DEFAULTS[key];
    return state;
  }

  function compute(state) {
    const errors = [validate(state.a) && `Дата 1: ${validate(state.a)}`, validate(state.b) && `Дата 2: ${validate(state.b)}`].filter(Boolean);
    if (errors.length) return { errors };
    const a = personal(state.a), b = personal(state.b);
    return { errors, a, b, p: pair(a, b), names: { a: state.an || "Партнёр 1", b: state.bn || "Партнёр 2" }, state };
  }

  function mountBar(state, onChange) {
    const current = location.pathname.split("/").pop() || "index.html";
    const bar = document.createElement("nav");
    bar.className = "vbar";
    const links = VARIANTS.map((v) =>
      `<a class="vlink${v.file === current ? " on" : ""}" href="${v.file}${location.search}" data-file="${v.file}">${v.label}</a>`).join("");
    bar.innerHTML = `<div class="vlinks">${links}</div>` +
      `<button type="button" class="vdata-btn" aria-expanded="false">Данные ▾</button>` +
      `<form class="vdata" hidden autocomplete="off">` +
      `<fieldset><input name="an" placeholder="Имя" aria-label="Имя первого партнёра">` +
      `<input name="a" type="date" min="1900-01-01" aria-label="Дата рождения первого партнёра">` +
      `<select name="as" aria-label="Пол первого партнёра"><option value="m">мужчина</option><option value="f">женщина</option></select></fieldset>` +
      `<fieldset><input name="bn" placeholder="Имя" aria-label="Имя второго партнёра">` +
      `<input name="b" type="date" min="1900-01-01" aria-label="Дата рождения второго партнёра">` +
      `<select name="bs" aria-label="Пол второго партнёра"><option value="m">мужчина</option><option value="f">женщина</option></select></fieldset>` +
      `<p class="verr" role="alert"></p></form>`;
    document.body.prepend(bar);
    const form = bar.querySelector(".vdata");
    const btn = bar.querySelector(".vdata-btn");
    for (const [key, value] of Object.entries(state)) if (form.elements[key]) form.elements[key].value = value;
    btn.addEventListener("click", () => {
      form.hidden = !form.hidden;
      btn.setAttribute("aria-expanded", String(!form.hidden));
    });
    form.addEventListener("input", () => {
      const next = Object.fromEntries(new FormData(form).entries());
      const search = `?${new URLSearchParams(next)}`;
      history.replaceState(null, "", search);
      bar.querySelectorAll(".vlink").forEach((a) => { a.href = `${a.dataset.file}${search}`; });
      onChange(next);
    });
    return bar.querySelector(".verr");
  }

  function start(render) {
    const state = readState();
    let errEl;
    const run = (s) => {
      const ctx = compute(s);
      errEl.textContent = ctx.errors.join(" · ");
      if (ctx.errors.length) return;
      render(ctx);
      window.__pair = { a: ctx.a, b: ctx.b, p: ctx.p };
    };
    errEl = mountBar(state, run);
    run(state);
  }

  window.PairUI = {
    ARCANA, POINTS, SECTIONS, VARIANTS, IMG, SEX, octagram, bub, chip, values, numbers, esc, fmtDate,
    highlight, wireHover, sumLine, start, fold,
  };
})();
