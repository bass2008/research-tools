import { breadcrumbLd, type Crumb } from "@/lib/schema";

import JsonLd from "@/components/ui/JsonLd";

// Видимую цепочку внутри справочника рисует каркас (EncCrumbs), а разметку BreadcrumbList
// печатает страница: она одна знает свой заголовок и путь.
export default function CrumbsLd({ trail }: { trail: Crumb[] }) {
  return <JsonLd data={breadcrumbLd(trail)} />;
}
