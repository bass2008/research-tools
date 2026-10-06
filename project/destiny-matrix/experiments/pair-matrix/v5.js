(function () {
  const U = window.PairUI;
  const { ARCANA, SECTIONS, IMG, SEX, octagram, esc, fmtDate } = U;
  const track = document.getElementById("track");
  const bars = document.getElementById("bars");

  const ordered = [...SECTIONS.filter((s) => s.main), ...SECTIONS.filter((s) => !s.main)];

  function sectionSlide(s, p, i, total) {
    const vals = U.values(s, p);
    return `<section class="slide sec" style="--img:url('${IMG(vals[0], true)}')">` +
      `<div class="mini">${octagram(p, { focus: s.points })}</div>` +
      `<span class="count">${i} / ${total}</span>` +
      `<div class="content"><span class="s-kicker">${s.title}</span><span class="s-num">${U.numbers(s, p)}</span>` +
      `<span class="s-names">${[...new Set(vals)].map((v) => ARCANA[v]).join(" · ")}</span><p>${s.text}</p></div></section>`;
  }

  function render({ a, b, p, names, state }) {
    const total = ordered.length + 2;
    const cover = `<section class="slide cover"><span class="count">1 / ${total}</span>` +
      `<div class="content"><span class="s-kicker">Совместимость</span><h1>${esc(names.a)}<span>и</span>${esc(names.b)}</h1>` +
      `<p class="c-dates">${fmtDate(state.a)} · ${SEX[state.as]}<br>${fmtDate(state.b)} · ${SEX[state.bs]}</p>` +
      `<div class="c-oct">${octagram(p)}</div><p class="c-hint">Листайте →</p></div></section>`;
    const list = ordered.map((s) => `<li><span>${s.short}</span><b>${U.numbers(s, p)}</b></li>`).join("");
    const final = `<section class="slide final"><span class="count">${total} / ${total}</span><div class="content">` +
      `<span class="s-kicker">Вся пара коротко</span><ul class="f-list">${list}</ul>` +
      `<div class="f-people"><figure>${octagram(a)}<figcaption>${esc(names.a)}</figcaption></figure>` +
      `<figure>${octagram(b)}<figcaption>${esc(names.b)}</figcaption></figure></div>` +
      `<p class="f-note">Каждая точка пары — сумма одноимённых точек этих двух матриц.</p></div></section>`;
    track.innerHTML = cover + ordered.map((s, i) => sectionSlide(s, p, i + 2, total)).join("") + final;
    bars.innerHTML = Array.from({ length: total }, () => "<i></i>").join("");
    track.scrollLeft = 0;
    sync();
  }

  const index = () => Math.round(track.scrollLeft / track.clientWidth);
  const go = (i) => track.scrollTo({ left: Math.max(0, i) * track.clientWidth, behavior: "smooth" });

  function sync() {
    const i = index();
    bars.querySelectorAll("i").forEach((bar, k) => bar.classList.toggle("done", k <= i));
  }

  track.addEventListener("scroll", () => requestAnimationFrame(sync));
  track.addEventListener("click", (e) => {
    const box = track.getBoundingClientRect();
    go(index() + (e.clientX - box.left < box.width * 0.3 ? -1 : 1));
  });
  document.querySelector(".nav.prev").addEventListener("click", () => go(index() - 1));
  document.querySelector(".nav.next").addEventListener("click", () => go(index() + 1));
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, select")) return;
    if (e.key === "ArrowRight") go(index() + 1);
    if (e.key === "ArrowLeft") go(index() - 1);
  });

  U.start(render);
})();
