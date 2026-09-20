import { D, L } from "@/lib/i18n";
import { SERVICE_PAGES, servicePagesOf, type ServiceGroup } from "@/lib/servicePages";
import { DISCLAIMER, LEGAL } from "@/lib/site";

import LanguageLink from "@/components/ui/LanguageLink";
import Logo from "@/components/ui/Logo";
import SiteLink from "@/components/ui/SiteLink";

// Набор ссылок задан реестром: у языка, где страницы нет, её нет и в подвале — и не появится
// в карте сайта, потому что оба читают один список.
function Links({ group, plain }: { group: ServiceGroup; plain?: boolean }) {
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

export default function Footer({ plain }: { plain?: boolean }) {
  return (
    <footer className="site-footer">
      <div className="wrap frow">
        <div>
          <div className="logo" style={{ marginBottom: 8 }}>
            <Logo height={56} />
          </div>
          <p>{DISCLAIMER}</p>
        </div>
        <div>
          {/* в подвале — только кто исполнитель и куда писать; номера на странице контактов */}
          <p>{LEGAL.entity}</p>
          <Links group="about" plain={plain} />
          <p><a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></p>
        </div>
        <div>
          <Links group="legal" plain={plain} />
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
