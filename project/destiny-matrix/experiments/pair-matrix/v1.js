(function () {
  const U = window.PairUI;
  const { ARCANA, SECTIONS, SEX, octagram, bub, chip, esc, fmtDate, fold } = U;

  const EQ = [["E", "Атмосфера"], ["A", "Образ пары"], ["B", "Ради чего встретились"], ["F", "Что наполняет"],
    ["G", "Что может испортить"], ["M", "Хвост, верх"], ["N", "Хвост, середина"], ["D", "Хвост, низ"], ["J", "Пара как родители"]];

  function person(m, name, iso, sex) {
    return `<figure class="who"><figcaption><b>${esc(name)}</b><span>${fmtDate(iso)} · ${SEX[sex]}</span></figcaption>${octagram(m)}</figure>`;
  }

  U.start(({ a, b, p, names, state }) => {
    document.getElementById("title").innerHTML = `${esc(names.a)} <span class="amp">+</span> ${esc(names.b)}`;
    document.getElementById("merge").innerHTML =
      `<div class="m-a">${person(a, names.a, state.a, state.as)}</div><div class="op op-plus">+</div>` +
      `<div class="m-b">${person(b, names.b, state.b, state.bs)}</div><div class="op op-eq">=</div>` +
      `<figure class="m-pair"><figcaption><b>Матрица пары</b><span>каждая точка — сумма двух</span></figcaption>${octagram(p, { live: true })}</figure>`;

    const key = (label, value, sub, points) =>
      `<div class="key" data-points="${points}"><span class="k-lbl">${label}</span><span class="k-val">${value}</span><span class="k-sub">${sub}</span></div>`;
    document.getElementById("keys").innerHTML = [
      key("Атмосфера", p.E, ARCANA[p.E], "E"),
      key("Ради чего встретились", `${p.A} + ${p.B}`, `${ARCANA[p.A]}, ${ARCANA[p.B]}`, "A B"),
      key("Задачи пары", `${p.M}-${p.N}-${p.D}`, "хвост пары", "M N D"),
      key("Ценности", p.spiritual, ARCANA[p.spiritual], "spiritual"),
    ].join("");

    const rows = EQ.map(([k, label]) => {
      const raw = a[k] + b[k];
      return `<div class="eq-row" data-points="${k}"><span class="eq-lbl">${label}</span>` +
        `${bub(a[k])}<span class="op-s">+</span>${bub(b[k])}<span class="op-s">=</span>` +
        `<span class="eq-raw">${raw > 22 ? `${raw} →` : ""}</span>${bub(fold(raw), " g")}<span class="eq-nm">${ARCANA[p[k]]}</span></div>`;
    }).join("");
    const purpose = `<div class="eq-row" data-points="spiritual"><span class="eq-lbl">Ценности</span>` +
      `<span class="eq-note">личное ${p.personal} + социальное ${p.social}, из сумм пары</span><span></span>${bub(p.spiritual, " g")}` +
      `<span class="eq-nm">${ARCANA[p.spiritual]}</span></div>`;
    document.getElementById("eq").innerHTML = rows + purpose;

    document.getElementById("list").innerHTML = SECTIONS.map((s) => {
      const vals = U.values(s, p);
      return `<article class="item" data-points="${s.points.join(" ")}"><div class="item-head"><h3>${s.title}</h3>` +
        `<span class="item-num">${U.numbers(s, p)}</span></div>` +
        `<div class="chips">${[...new Set(vals)].map(chip).join("")}</div><p>${s.text}</p></article>`;
    }).join("");
    U.wireHover();
  });
})();
