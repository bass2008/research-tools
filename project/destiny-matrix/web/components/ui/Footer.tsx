import { DISCLAIMER, LEGAL } from "@/lib/site";

import Logo from "@/components/ui/Logo";
import SiteLink from "@/components/ui/SiteLink";

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
          <p>
            <SiteLink plain={plain} href="/o-metode">О методе</SiteLink>
          </p>
          <p>
            <SiteLink plain={plain} href="/avtor">Об авторе</SiteLink>
          </p>
          <p>
            <SiteLink plain={plain} href="/contacts">Контакты и реквизиты</SiteLink>
          </p>
          <p><a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></p>
        </div>
        <div>
          <p>
            <SiteLink plain={plain} href="/oferta">Публичная оферта</SiteLink>
          </p>
          <p>
            <SiteLink plain={plain} href="/privacy">Политика обработки персональных данных</SiteLink>
          </p>
          <p>
            <SiteLink plain={plain} href="/refund">Условия возврата</SiteLink>
          </p>
          <p>
            <SiteLink plain={plain} href="/encyclopedia">Энциклопедия арканов</SiteLink>
          </p>
          <p style={{ marginTop: 8 }}>© 2026</p>
        </div>
      </div>
    </footer>
  );
}
