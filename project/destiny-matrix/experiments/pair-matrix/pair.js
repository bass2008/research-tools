(function (root) {
  const MAX = 22;

  const digitSum = (n) => String(Math.abs(n)).split("").reduce((s, c) => s + Number(c), 0);

  function fold(n) {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`ожидалось положительное число, получено ${n}`);
    while (n > MAX) n = digitSum(n);
    return n;
  }

  function personal(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    const A = fold(d), B = fold(m), C = fold(digitSum(y));
    const D = fold(A + B + C), E = fold(A + B + C + D);
    const F = fold(A + B), G = fold(B + C), H = fold(C + D), I = fold(D + A);
    const J = fold(A + E), K = fold(B + E), L = fold(C + E), M = fold(D + E);
    const O = fold(A + J), P = fold(B + K), Q = fold(C + L), N = fold(D + M);
    const S = fold(J + E), T = fold(K + E);
    const R = fold(L + M), R1 = fold(M + R), R2 = fold(L + R);
    const sky = fold(B + D), ground = fold(A + C), male = fold(F + H), female = fold(G + I);
    const personalPurpose = fold(sky + ground), social = fold(male + female);
    const spiritual = fold(personalPurpose + social);
    return {
      A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, R1, R2, S, T,
      sky, ground, male, female, personal: personalPurpose, social, spiritual,
    };
  }

  // Lisovskaya, ch. 2: every point and the four purpose parts are summed pointwise;
  // the three purpose totals are recomputed from the pair's own parts.
  const SUMMED = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q",
    "R", "R1", "R2", "S", "T", "sky", "ground", "male", "female"];

  function pair(a, b) {
    const p = {};
    for (const key of SUMMED) p[key] = fold(a[key] + b[key]);
    p.personal = fold(p.sky + p.ground);
    p.social = fold(p.male + p.female);
    p.spiritual = fold(p.personal + p.social);
    return p;
  }

  function validate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "дата в формате ГГГГ-ММ-ДД";
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return "такой даты нет";
    if (date > new Date()) return "дата в будущем";
    if (y < 1900) return "поддерживаются даты с 1900 года";
    return null;
  }

  const api = { fold, personal, pair, validate, SUMMED };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PairMatrix = api;
})(typeof window !== "undefined" ? window : globalThis);
