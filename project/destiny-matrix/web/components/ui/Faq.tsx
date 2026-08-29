import { faqLd } from "@/lib/schema";

import JsonLd from "@/components/ui/JsonLd";

import type { QA } from "@/lib/content";

// Блок вопросов и его разметка выводятся вместе — FAQPage без видимого текста на странице
// поиск считает разметкой без содержания.
export default function Faq({ items, title = "Частые вопросы" }: { items: QA[]; title?: string }) {
  if (!items.length) return null;
  return (
    <div className="panel section-gap">
      <JsonLd data={faqLd(items)} />
      <h2>{title}</h2>
      <dl className="faq">
        {items.map((item) => (
          <div key={item.q}>
            <dt>{item.q}</dt>
            <dd>{item.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
