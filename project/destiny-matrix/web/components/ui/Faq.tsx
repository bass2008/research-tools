import JsonLd from "@/components/ui/JsonLd";
import type { QA } from "@/lib/content";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedSchema } from "@/lib/schema";

export const forLocale = localized((L: Locale, site) => {
  const { faqLd } = localizedSchema(L, site);

  return { faqLd };
});

// Блок вопросов и его разметка выводятся вместе — FAQPage без видимого текста на странице
// поиск считает разметкой без содержания.
export default function Faq({ locale: requestedLocale, ...localeProps }: ({ items: QA[]; title?: string }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { items, title = D.octagram.faqTitle[L] } = localeProps;
  const { faqLd } = forLocale(L);

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
