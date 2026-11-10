import { readFileSync, writeFileSync } from 'node:fs';

// Deliberately copy names only: runtime mobile code must not import the corpus.
const snapshot = {};
for (const locale of ['ru', 'en']) {
  const source = new URL(`../../web/content/${locale}/arcana-catalog.json`, import.meta.url);
  const items = JSON.parse(readFileSync(source, 'utf8')).items;
  const ordered = [...items].sort((a, b) => a.n - b.n);
  if (ordered.length !== 22 || ordered.some((item, i) => item.n !== i + 1
    || typeof item.title !== 'string' || !item.title.trim())) {
    throw new Error(`Invalid ${locale} canonical arcanum catalog`);
  }
  snapshot[locale] = ordered.map(item => item.title);
}
writeFileSync(new URL('../src/daily/arcanum-titles.json', import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
