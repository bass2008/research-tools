import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { indexedKarmicTailKeys, positionContent } from "./content";
import { POSITIONS } from "./encyclopedia";
import {
  buildPositionArcanum,
  positionArcanumHref,
  positionArcanumLabel,
  positionArcanumSiblings,
  registryItem,
  registryItems,
} from "./positionArcanum";

const REGISTRY = JSON.parse(
  readFileSync(path.join(__dirname, "..", "content", "position-arcanum.json"), "utf8"),
) as { threshold: number; count: number; items: unknown[] };

const readings = registryItems().map((item) => ({
  item,
  reading: buildPositionArcanum(item.position, item.arcanum),
}));

const body = (r: (typeof readings)[number]["reading"]) =>
  [r.short, ...r.sections.flatMap((s) => s.paragraphs), ...r.faq.map((f) => f.a)].join(" ");

describe("реестр пересечений", () => {
  it("не пуст и держит порог числом, а не на глаз", () => {
    expect(REGISTRY.threshold).toBeGreaterThanOrEqual(500);
    expect(registryItems().length).toBeGreaterThan(50);
  });

  // Порог — весь смысл реестра: плоские 22 × 37 адресов были бы тем тонким корпусом, который уже
  // дал 76 страниц хвостов на один показ за шесть дней.
  it("не содержит записей ниже порога", () => {
    const under = registryItems().filter((i) => i.frequency < REGISTRY.threshold);
    expect(under).toEqual([]);
  });

  it("ссылается только на существующие позиции корпуса", () => {
    const known = new Set(POSITIONS.map((p) => p.key));
    expect(registryItems().filter((i) => !known.has(i.position))).toEqual([]);
    expect(registryItems().filter((i) => positionContent(i.position) === null)).toEqual([]);
  });

  it("держит арканы в диапазоне свёртки", () => {
    const bad = registryItems().filter((i) => !Number.isInteger(i.arcanum) || i.arcanum < 1 || i.arcanum > 22);
    expect(bad).toEqual([]);
  });

  it("не повторяет пару позиция-аркан", () => {
    const seen = registryItems().map((i) => `${i.position}/${i.arcanum}`);
    expect(seen.length).toBe(new Set(seen).size);
  });

  // Хвост — тройка: аркан, которого движок не ставит туда ни при какой дате, не может иметь
  // страницу «в хвосте», сколько бы его ни спрашивали. Арканы 1 и 2 как раз такие, и спрос по
  // ним нулевой под обоими именами — это и подтвердило, что «программа N» и «хвост N» одно и то же.
  it("не выдумывает хвост там, где его не даёт расчёт", () => {
    const tails = registryItems().filter((i) => i.position === "past_lives");
    expect(tails.length).toBeGreaterThan(10);
    expect(tails.filter((i) => i.tails.length === 0)).toEqual([]);
  });

  it("ссылается только на опубликованные тройки", () => {
    const published = new Set(indexedKarmicTailKeys());
    const dangling = readings.flatMap(({ reading }) =>
      reading.tails.filter((t) => !published.has(t.key)).map((t) => `${reading.position}/${reading.arcanum}: ${t.key}`),
    );
    expect(dangling).toEqual([]);
  });
});

describe("собранная страница", () => {
  it("собирается для каждой записи реестра", () => {
    expect(readings).toHaveLength(registryItems().length);
  });

  it("не оставляет пустых заголовков и абзацев", () => {
    const broken = readings.flatMap(({ reading }) => {
      const problems: string[] = [];
      if (!reading.title.trim()) problems.push("нет h1");
      if (reading.short.length < 40) problems.push(`short ${reading.short.length}`);
      if (!reading.sections.length) problems.push("нет разделов");
      for (const section of reading.sections) {
        if (!section.h2.trim()) problems.push("раздел без h2");
        if (!section.paragraphs.length) problems.push(`${section.h2}: нет абзацев`);
        for (const paragraph of section.paragraphs) {
          if (paragraph.trim().length < 40) problems.push(`${section.h2}: абзац ${paragraph.length} знаков`);
        }
      }
      return problems.map((p) => `${reading.position}/${reading.arcanum}: ${p}`);
    });
    expect(broken).toEqual([]);
  });

  // Тонкая страница — это та же ошибка, что 5 544 матрицы: адрес есть, отвечать нечем.
  it("нигде не тоньше 1 500 знаков", () => {
    const thin = readings
      .filter(({ reading }) => body(reading).length < 1500)
      .map(({ reading }) => `${reading.position}/${reading.arcanum}: ${body(reading).length}`);
    expect(thin).toEqual([]);
  });

  // Дословный повтор — крайний случай; опаснее шаблон, который совпадает почти целиком.
  // Замер: шестисловные шинглы, доля общего от меньшей страницы. Порог взят по принятому на
  // сайте: сочетания держатся на 33,6% и стоят на медиане 5, «на год» — 3,6% и позиции 2–6.
  // Первая версия этой сборки давала 58–74% — почти-дубли, и это выяснилось только замером.
  it("не собирается по одному шаблону внутри позиции", () => {
    const shingles = (text: string, size = 6) => {
      const words = text.toLowerCase().match(/[а-яёa-z0-9]+/g) ?? [];
      const out = new Set<string>();
      for (let i = 0; i + size <= words.length; i++) out.add(words.slice(i, i + size).join(" "));
      return out;
    };
    const byPosition = new Map<string, string[]>();
    for (const { reading } of readings) {
      const text = [
        reading.title,
        reading.short,
        ...reading.sections.flatMap((s) => [s.h2, ...s.paragraphs]),
        ...reading.faq.flatMap((f) => [f.q, f.a]),
      ].join(" ");
      byPosition.set(reading.position, [...(byPosition.get(reading.position) ?? []), text]);
    }
    const overshoot: string[] = [];
    for (const [position, texts] of byPosition) {
      for (let a = 0; a < texts.length; a++) {
        for (let b = a + 1; b < texts.length; b++) {
          const left = shingles(texts[a]!);
          const right = shingles(texts[b]!);
          const shared = [...left].filter((s) => right.has(s)).length;
          const ratio = shared / Math.min(left.size, right.size);
          if (ratio > 0.4) overshoot.push(`${position}: ${(ratio * 100).toFixed(1)}%`);
        }
      }
    }
    expect(overshoot).toEqual([]);
  });

  it("не повторяет текст между страницами дословно", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const { reading } of readings) {
      const key = body(reading);
      const who = `${reading.position}/${reading.arcanum}`;
      if (seen.has(key)) dupes.push(`${who} == ${seen.get(key)}`);
      seen.set(key, who);
    }
    expect(dupes).toEqual([]);
  });

  // Ровно та ошибка, которую нашло ручное ревью: суть из корпуса уже содержала короткое описание
  // аркана, и абзац повторял его дословно во второй фразе.
  it("не повторяет одну фразу дважды в одном абзаце", () => {
    const guilty = readings.flatMap(({ reading }) =>
      reading.sections.flatMap((section) =>
        section.paragraphs
          .filter((paragraph) => {
            const parts = paragraph.split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);
            return new Set(parts).size !== parts.length;
          })
          .map(() => `${reading.position}/${reading.arcanum}: ${section.h2}`),
      ),
    );
    expect(guilty).toEqual([]);
  });

  // Первый абзац не должен повторять короткое описание аркана: у части арканов суть из корпуса
  // уже кончается им, и приписка «Это X: <то же самое>» появлялась через страницу — порог
  // сторожа отбрасывал слишком короткие описания.
  it("не повторяет короткое описание аркана в первом абзаце", () => {
    const guilty = readings
      .filter(({ reading }) => {
        const first = reading.sections[0]?.paragraphs[0] ?? "";
        const parts = first.split(/(?<=[.!?…])\s+/).map((x) => x.trim().toLowerCase());
        return parts.some((a, i) => parts.some((b, j) => i !== j && b.length > 25 && a.includes(b.slice(0, 25))));
      })
      .map(({ reading }) => `${reading.position}/${reading.arcanum}`);
    expect(guilty).toEqual([]);
  });

  // Служебный префикс корпуса «Аркан «Имя» · E ·» на странице читается как мусор.
  it("не пропускает служебный префикс корпуса", () => {
    const leaked = readings
      .filter(({ reading }) => /Аркан «[^»]+» ·/.test(body(reading)) || /·/.test(reading.short))
      .map(({ reading }) => `${reading.position}/${reading.arcanum}`);
    expect(leaked).toEqual([]);
  });

  it("склеивает фразы без строчных начал и потерянных точек", () => {
    const broken = readings.flatMap(({ reading }) =>
      reading.sections.flatMap((section) =>
        section.paragraphs
          .filter((p) => /[а-яё][.!?…]\s+[а-яё]/.test(p) || !/[.!?…»)]$/.test(p.trim()))
          .map((p) => `${reading.position}/${reading.arcanum}: ${p.slice(0, 60)}`),
      ),
    );
    expect(broken).toEqual([]);
  });

  // Границы обеих сторон: обрезка выдачи сверху и приёмка сборки снизу — она требует описание
  // не короче 40 знаков, и на аркане с сутью в три слова это правило уже сработало.
  it("даёт заголовок и описание в пределах выдачи", () => {
    const bad = readings
      .filter(
        ({ reading }) =>
          reading.seo.title.length > 70 ||
          reading.seo.title.length < 10 ||
          reading.seo.description.length > 165 ||
          reading.seo.description.length < 60,
      )
      .map(({ reading }) => `${reading.position}/${reading.arcanum}: ${reading.seo.title.length}/${reading.seo.description.length}`);
    expect(bad).toEqual([]);
  });

  it("не удваивает «матрица судьбы» в запросах", () => {
    const doubled = readings.flatMap(({ reading }) =>
      reading.seo.queries
        .filter((q) => (q.toLowerCase().match(/матриц/g) ?? []).length > 1)
        .map((q) => `${reading.position}/${reading.arcanum}: ${q}`),
    );
    expect(doubled).toEqual([]);
  });

  it("берёт главный запрос из реестра", () => {
    const wrong = readings
      .filter(({ item, reading }) => reading.seo.queries[0] !== item.primaryQuery)
      .map(({ reading }) => `${reading.position}/${reading.arcanum}`);
    expect(wrong).toEqual([]);
  });

  it("даёт каждой странице свой адрес и подпись", () => {
    const hrefs = registryItems().map((i) => positionArcanumHref(i.position, i.arcanum));
    expect(hrefs.length).toBe(new Set(hrefs).size);
    expect(registryItems().filter((i) => !positionArcanumLabel(i).trim())).toEqual([]);
  });

  it("не считает страницу своим же соседом", () => {
    const self = registryItems().flatMap((i) =>
      positionArcanumSiblings(i.position, i.arcanum)
        .filter((s) => s.position === i.position)
        .map(() => `${i.position}/${i.arcanum}`),
    );
    expect(self).toEqual([]);
  });

  it("не строит страницу вне реестра", () => {
    expect(registryItem("center", 99)).toBeNull();
    expect(() => buildPositionArcanum("center", 99)).toThrow();
    expect(() => buildPositionArcanum("nonsense", 6)).toThrow();
  });
});
