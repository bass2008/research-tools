(function () {
  const U = window.PairUI;
  const { ARCANA, POINTS, SECTIONS, SEX, octagram, chip, esc, fmtDate } = U;
  let observer = null;
  let active = null;
  let lockUntil = 0;

  function setActive(s, p) {
    active = s;
    U.highlight(s.points);
    document.querySelectorAll(".row").forEach((r) => r.classList.toggle("on", r.dataset.id === s.id));
    const vals = U.values(s, p);
    document.getElementById("now").innerHTML =
      `<span class="now-lbl">Сейчас</span><h2>${s.title}</h2><p class="now-num">${U.numbers(s, p)}</p>` +
      `<p class="now-names">${[...new Set(vals)].map((v) => ARCANA[v]).join(", ")}</p><p class="now-txt">${s.text}</p>`;
  }

  function table(a, b, p, names) {
    const rows = Object.keys(POINTS).map((k) =>
      `<tr><td class="mono">${k}</td><td>${POINTS[k].name}</td><td class="num">${a[k]}</td><td class="num">${b[k]}</td><td class="num strong">${p[k]}</td></tr>`).join("");
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ключ</th><th>Смысл в паре</th><th>${esc(names.a)}</th><th>${esc(names.b)}</th><th>Пара</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  U.start(({ a, b, p, names, state }) => {
    document.getElementById("title").textContent = `${names.a} и ${names.b}`;
    document.getElementById("dates").textContent = `${fmtDate(state.a)} · ${SEX[state.as]} — ${fmtDate(state.b)} · ${SEX[state.bs]}`;
    document.getElementById("map-oct").innerHTML = octagram(p, { live: true });
    document.getElementById("read").innerHTML = SECTIONS.map((s, i) => {
      const vals = U.values(s, p);
      return `<article class="row" data-id="${s.id}" data-points="${s.points.join(" ")}">` +
        `<span class="idx">${i + 1}</span><div class="row-main"><div class="row-head"><h3>${s.title}</h3>` +
        `<span class="row-num">${U.numbers(s, p)}</span></div>` +
        `<div class="chips">${[...new Set(vals)].map(chip).join("")}</div><p>${s.text}</p></div></article>`;
    }).join("");
    document.getElementById("people").innerHTML =
      `<div class="people"><figure><figcaption>${esc(names.a)} · ${fmtDate(state.a)}</figcaption>${octagram(a)}</figure>` +
      `<figure><figcaption>${esc(names.b)} · ${fmtDate(state.b)}</figcaption>${octagram(b)}</figure></div>`;
    document.getElementById("all").innerHTML = table(a, b, p, names);

    const byId = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
    document.querySelectorAll(".row").forEach((row) => {
      row.addEventListener("mouseenter", () => U.highlight(row.dataset.points.split(" ")));
      row.addEventListener("mouseleave", () => active && U.highlight(active.points));
      row.addEventListener("click", () => { lockUntil = Date.now() + 1200; setActive(byId[row.dataset.id], p); });
    });
    document.querySelectorAll("#map-oct .node").forEach((node) => {
      node.style.cursor = "pointer";
      node.addEventListener("click", () => {
        const s = SECTIONS.find((x) => x.points.includes(node.dataset.point));
        if (!s) return;
        document.querySelector('.tab-btn[data-tab="read"]').click();
        lockUntil = Date.now() + 1200;
        document.querySelector(`.row[data-id="${s.id}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
        setActive(s, p);
      });
    });

    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      if (Date.now() < lockUntil) return;
      const hit = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top)[0];
      if (hit) setActive(byId[hit.target.dataset.id], p);
    }, { rootMargin: "-48% 0px -48% 0px" });
    document.querySelectorAll(".row").forEach((row) => observer.observe(row));
    setActive(active ? byId[active.id] : SECTIONS[0], p);
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("on", b === btn));
    document.querySelectorAll(".tab").forEach((t) => { t.hidden = t.dataset.tab !== btn.dataset.tab; });
  }));
})();
