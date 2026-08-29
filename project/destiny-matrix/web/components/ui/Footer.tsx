import Link from "next/link";

import { DISCLAIMER, LEGAL } from "@/lib/site";

import Logo from "@/components/ui/Logo";

export default function Footer() {
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
            <Link href="/o-metode">О методе</Link>
          </p>
          <p>
            <Link href="/avtor">Об авторе</Link>
          </p>
          <p>
            <Link href="/contacts">Контакты и реквизиты</Link>
          </p>
          <p><a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></p>
        </div>
        <div>
          <p>
            <Link href="/oferta">Публичная оферта</Link>
          </p>
          <p>
            <Link href="/privacy">Политика обработки персональных данных</Link>
          </p>
          <p>
            <Link href="/refund">Условия возврата</Link>
          </p>
          <p>
            <Link href="/encyclopedia">Энциклопедия арканов</Link>
          </p>
          <p style={{ marginTop: 8 }}>© 2026</p>
        </div>
      </div>
    </footer>
  );
}
