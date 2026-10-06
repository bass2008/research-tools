(function () {
  const U = window.PairUI;
  const { ARCANA, POINTS, SECTIONS, IMG, SEX, octagram, bub, chip, esc, fmtDate } = U;

  function sectionCard(s, p) {
    const vals = U.values(s, p);
    const lead = vals[0];
    const body = s.chain
      ? `<div class="chain">${vals.map((v) => bub(v)).join('<span class="arrow">→</span>')}</div>` +
        `<div class="chips">${[...new Set(vals)].map(chip).join("")}</div>`
      : `<div class="chips">${vals.map(chip).join('<span class="plus">+</span>')}</div>`;
    const thumb = s.chain || vals.length > 1 ? "" : `<img class="thumb" src="${IMG(lead)}" alt="${ARCANA[lead]}" loading="lazy">`;
    return `<article class="card" data-points="${s.points.join(" ")}" id="sec-${s.id}">${thumb}` +
      `<div class="card-body"><h3>${s.title}</h3>${body}<p>${s.text}</p></div></article>`;
  }

  function summary(p) {
    const tile = (label, value, sub, points) =>
      `<div class="tile" data-points="${points}"><span class="tile-lbl">${label}</span>` +
      `<span class="tile-val">${value}</span><span class="tile-sub">${sub}</span></div>`;
    return [
      tile("Атмосфера", p.E, ARCANA[p.E], "E"),
      tile("Задачи пары", `${p.M}-${p.N}-${p.D}`, "кармический хвост пары", "M N D"),
      tile("Ценности", p.spiritual, ARCANA[p.spiritual], "spiritual"),
      tile("Ради чего встретились", `${p.A} + ${p.B}`, `${ARCANA[p.A]} и ${ARCANA[p.B]}`, "A B"),
    ].join("");
  }

  function howTo(a, b, p, names) {
    const rows = [["E", "Центр"], ["A", "День"], ["M", "Хвост, верх"], ["N", "Хвост, середина"], ["D", "Хвост, низ"]]
      .map(([k, label]) => `<tr><td>${label}</td><td>${U.sumLine(k, a, b)}</td><td>${bub(p[k], " g")}</td></tr>`).join("");
    const purpose = `<tr><td>Ценности</td><td>(${p.sky} + ${p.ground}) + (${p.male} + ${p.female}) → ${p.personal} + ${p.social}</td>` +
      `<td>${bub(p.spiritual, " g")}</td></tr>`;
    return `<table class="howto"><thead><tr><th>Точка</th><th>${esc(names.a)} + ${esc(names.b)}</th><th>Пара</th></tr></thead>` +
      `<tbody>${rows}${purpose}</tbody></table>`;
  }

  function debugTable(a, b, p, names) {
    const rows = Object.keys(POINTS).map((k) => {
      const recomputed = ["personal", "social", "spiritual"].includes(k);
      return `<tr><td class="mono">${k}</td><td class="mono">${POINTS[k].book}</td><td>${POINTS[k].name}</td>` +
        `<td class="num">${a[k]}</td><td class="num">${b[k]}</td>` +
        `<td class="num dim">${recomputed ? "пересчёт" : a[k] + b[k]}</td><td class="num strong">${p[k]}</td></tr>`;
    }).join("");
    return `<table class="dbg"><thead><tr><th>Ключ</th><th>Книга</th><th>Смысл в паре</th>` +
      `<th>${esc(names.a)}</th><th>${esc(names.b)}</th><th>Сумма</th><th>Пара</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  U.start(({ a, b, p, names, state }) => {
    document.getElementById("title").innerHTML = `<span>${esc(names.a)}</span> <em>и</em> <span>${esc(names.b)}</span>`;
    document.getElementById("dates").textContent =
      `${fmtDate(state.a)} · ${SEX[state.as]}  —  ${fmtDate(state.b)} · ${SEX[state.bs]}`;
    document.getElementById("pair-oct").innerHTML = octagram(p, { live: true });
    document.getElementById("summary").innerHTML = summary(p);
    document.getElementById("sections").innerHTML = SECTIONS.map((s) => sectionCard(s, p)).join("");
    document.getElementById("person-a").innerHTML =
      `<h3>${esc(names.a)}</h3><p class="sub">${fmtDate(state.a)} · ${SEX[state.as]}</p>${octagram(a)}`;
    document.getElementById("person-b").innerHTML =
      `<h3>${esc(names.b)}</h3><p class="sub">${fmtDate(state.b)} · ${SEX[state.bs]}</p>${octagram(b)}`;
    document.getElementById("howto").innerHTML = howTo(a, b, p, names);
    document.getElementById("debug").innerHTML = debugTable(a, b, p, names);
    U.wireHover();
  });
})();
