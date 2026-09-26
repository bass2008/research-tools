import SessionBadge from "@/components/account/SessionBadge";
import BuyButton from "@/components/ui/BuyButton";
import Logo from "@/components/ui/Logo";
import SiteLink from "@/components/ui/SiteLink";
import { ALL_FREE } from "@/lib/access";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";

export default function Header({ locale: requestedLocale, ...localeProps }: ({ plain?: boolean }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { plain } = localeProps;

  return (
    <header className="site-header">
      <a className="skip" href="#content">
        {D.nav.skip[L]}
      </a>
      <div className="wrap hrow">
        <SiteLink plain={plain} className="logo" href="/" aria-label={D.nav.homeAria[L]}>
          <Logo locale={L} height={54} />
          <Logo locale={L} compact height={38} />
        </SiteLink>
        <nav className="hnav">
          <SiteLink plain={plain} href="/report">{D.nav.myReading[L]}</SiteLink>
          <SiteLink plain={plain} href="/encyclopedia">{D.nav.encyclopedia[L]}</SiteLink>
        </nav>
        <span className="hspacer">
          <SessionBadge locale={L} plain={plain} />
        </span>
        {/* Кабинет стоит рядом с «Выйти», а не в общем меню: это личные страницы, и вместе с
            почтой и выходом они читаются как один блок. */}
        <SiteLink plain={plain} className="btn ghost sm" data-testid="nav-account" href="/account">
          {D.nav.account[L]}
        </SiteLink>
        {/* Цену в кнопку не пишем: тарифов два, и цена выбирается на странице оплаты. */}
        {ALL_FREE ? null : <BuyButton locale={L} plain={plain} />}
      </div>
    </header>
  );
}
