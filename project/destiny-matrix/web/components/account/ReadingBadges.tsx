"use client";

import AccessBadge from "@/components/account/AccessBadge";
import { useLocale } from "@/components/ui/LocaleProvider";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";

export function WorkBadge({ locale }: { locale?: Locale }) {
  const active = useLocale();
  return <span className="badge work" data-testid="work-badge"><i className="pulse" aria-hidden="true" />{D.account.badgeInWork[locale ?? active]}</span>;
}

export default function ReadingBadges({ locale, item, inWork = false }: {
  locale?: Locale; item: { access: string; access_until?: string | null; access_granted?: boolean }; inWork?: boolean;
}) {
  return <span className="badges"><AccessBadge locale={locale} item={item} />{inWork && <WorkBadge locale={locale} />}</span>;
}
