import type { SiteProfile } from "@/lib/siteProfile";
import LanguageLink from "@/components/ui/LanguageLink";
import Logo from "@/components/ui/Logo";
import SiteLink from "@/components/ui/SiteLink";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedServicePages, type ServiceGroup } from "@/lib/servicePages";
import { forLocale as localizedSite } from "@/lib/site";

export const forLocale = localized((L: Locale, site) => {
  const { SERVICE_PAGES, servicePagesOf } = localizedServicePages(L);
  const { DISCLAIMER, LEGAL } = localizedSite(L, site);

  return { SERVICE_PAGES, servicePagesOf, DISCLAIMER, LEGAL };
});

// Набор ссылок задан реестром: у языка, где страницы нет, её нет и в подвале — и не появится
// в карте сайта, потому что оба читают один список.
function Links({ locale: requestedLocale, ...localeProps }: ({ group: ServiceGroup; plain?: boolean }) & { locale?: Locale }) {
  const L = requestedLocale ?? defaultLocale;
  const { group, plain } = localeProps;
  const { SERVICE_PAGES, servicePagesOf } = forLocale(L);

  return (
    <>
      {servicePagesOf(group).map((key) => (
        <p key={key}>
          <SiteLink plain={plain} href={SERVICE_PAGES[key].path}>
            {D.nav[SERVICE_PAGES[key].nav][L]}
          </SiteLink>
        </p>
      ))}
    </>
  );
}

export default function FooterContent({ locale: requestedLocale, site, ...localeProps }: { plain?: boolean; locale?: Locale; site: SiteProfile }) {
  const L = requestedLocale ?? defaultLocale;
  const { plain } = localeProps;
  const { DISCLAIMER, LEGAL } = forLocale(L, site);

  return (
    <footer className="site-footer">
      <div className="wrap frow">
        <div>
          <div className="logo" style={{ marginBottom: 8 }}>
            <Logo locale={L} height={56} />
          </div>
          <p>{DISCLAIMER}</p>
        </div>
        <div>
          {/* в подвале — только кто исполнитель и куда писать; номера на странице контактов */}
          <p>{LEGAL.entity}</p>
          <Links locale={L} group="about" plain={plain} />
          <p><a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></p>
        </div>
        <div>
          <Links locale={L} group="legal" plain={plain} />
          <p>
            <SiteLink plain={plain} href="/encyclopedia">{D.nav.arcanaEncyclopedia[L]}</SiteLink>
          </p>
          <p><LanguageLink /></p>
          <p style={{ marginTop: 8 }}>© 2026</p>
        </div>
      </div>
    </footer>
  );
}
