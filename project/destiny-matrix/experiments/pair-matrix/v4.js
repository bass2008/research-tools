(function () {
  const U = window.PairUI;
  const { ARCANA, SECTIONS, IMG, SEX, octagram, esc, fmtDate } = U;

  function card(s, p, big) {
    const vals = U.values(s, p);
    const imgs = vals.map((v) => `<img src="${IMG(v, big)}" alt="${ARCANA[v]}" loading="lazy">`).join("");
    const names = [...new Set(vals)].map((v) => ARCANA[v]).join(" · ");
    return `<button type="button" class="fcard${big ? " big" : ""}" data-points="${s.points.join(" ")}" aria-pressed="false">` +
      `<span class="fc-inner"><span class="fc-face fc-front"><span class="fan n${vals.length}">${imgs}</span>` +
      `<span class="fc-label"><span class="fc-title">${s.short}</span><span class="fc-num">${U.numbers(s, p)}</span></span></span>` +
      `<span class="fc-face fc-back"><span class="fc-title">${s.title}</span><span class="fc-big">${U.numbers(s, p)}</span>` +
      `<span class="fc-names">${names}</span><span class="fc-text">${s.text}</span></span></span></button>`;
  }

  U.start(({ a, b, p, names, state }) => {
    document.getElementById("title").innerHTML = `${esc(names.a)} <span class="amp">✦</span> ${esc(names.b)}`;
    document.getElementById("dates").textContent = `${fmtDate(state.a)} · ${SEX[state.as]}  ·  ${fmtDate(state.b)} · ${SEX[state.bs]}`;
    document.getElementById("main").innerHTML = SECTIONS.filter((s) => s.main).map((s) => card(s, p, true)).join("");
    document.getElementById("rest").innerHTML = SECTIONS.filter((s) => !s.main).map((s) => card(s, p, false)).join("");
    document.getElementById("medal").innerHTML = octagram(p, { live: true });
    document.getElementById("persons").innerHTML =
      `<figure>${octagram(a)}<figcaption>${esc(names.a)} · ${fmtDate(state.a)}</figcaption></figure>` +
      `<figure>${octagram(b)}<figcaption>${esc(names.b)} · ${fmtDate(state.b)}</figcaption></figure>`;
    document.querySelectorAll(".fcard").forEach((el) => el.addEventListener("click", () => {
      const on = el.classList.toggle("flipped");
      el.setAttribute("aria-pressed", String(on));
    }));
    U.wireHover();
  });
})();
