(function () {
  const U = window.PairUI;
  const { ARCANA, SECTIONS, IMG, SEX, octagram, esc, fmtDate } = U;

  function spread(s, p, i) {
    const vals = U.values(s, p);
    const cards = vals.map((v) => `<figure class="card-img"><img src="${IMG(v)}" alt="${ARCANA[v]}" loading="lazy"><figcaption>${v} · ${ARCANA[v]}</figcaption></figure>`).join("");
    const names = [...new Set(vals)].map((v) => ARCANA[v]).join(s.chain ? " — " : " и ");
    return `<section class="spread${i % 2 ? " flip" : ""}${vals.length > 1 ? " multi" : ""}" data-points="${s.points.join(" ")}">` +
      `<div class="imgs">${cards}</div>` +
      `<div class="txt"><span class="no">${String(i + 1).padStart(2, "0")}</span><h2>${s.title}</h2>` +
      `<p class="big">${U.numbers(s, p)}</p><p class="names">${names}</p><p class="body">${s.text}</p></div></section>`;
  }

  U.start(({ a, b, p, names, state }) => {
    document.getElementById("title").innerHTML = `${esc(names.a)} <span class="amp">&amp;</span> ${esc(names.b)}`;
    document.getElementById("dates").textContent = `${fmtDate(state.a)} · ${SEX[state.as]}   ·   ${fmtDate(state.b)} · ${SEX[state.bs]}`;
    document.getElementById("lead").textContent =
      `Атмосфера пары — ${p.E}, ${ARCANA[p.E]}. Встретились ради ${p.A} и ${p.B}: ${ARCANA[p.A]} и ${ARCANA[p.B]}. ` +
      `Задачи — хвост ${p.M}-${p.N}-${p.D}. Ценности — ${p.spiritual}, ${ARCANA[p.spiritual]}.`;
    document.getElementById("fig-pair").innerHTML =
      `${octagram(p, { live: true })}<figcaption>Рис. 1. Матрица пары: каждая точка — сумма одноимённых точек двух матриц.</figcaption>`;
    document.getElementById("spreads").innerHTML = SECTIONS.map((s, i) => spread(s, p, i)).join('<hr class="rule">');
    document.getElementById("persons").innerHTML =
      `<figure class="fig">${octagram(a)}<figcaption>Рис. 2. ${esc(names.a)}, ${fmtDate(state.a)}</figcaption></figure>` +
      `<figure class="fig">${octagram(b)}<figcaption>Рис. 3. ${esc(names.b)}, ${fmtDate(state.b)}</figcaption></figure>`;
    U.wireHover();
  });
})();
