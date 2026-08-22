import Link from "next/link";

import Logo from "./Logo";
import SessionBadge from "./SessionBadge";

export default function Header() {
  return (
    <header className="site-header">
      <div className="wrap hrow">
        <Link className="logo" href="/" aria-label="Arcana Sense — на главную">
          <Logo height={54} />
          <Logo compact height={38} />
        </Link>
        <nav className="hnav">
          <Link href="/report">Мой разбор</Link>
          <Link href="/encyclopedia">Энциклопедия</Link>
          <Link href="/encyclopedia/arcanum/1">22 аркана</Link>
        </nav>
        <span className="hspacer">
          <SessionBadge />
        </span>
        {/* Кабинет стоит рядом с «Выйти», а не в общем меню: это личные страницы, и вместе с
            почтой и выходом они читаются как один блок. */}
        <Link className="btn ghost sm" data-testid="nav-account" href="/account">
          Кабинет
        </Link>
        {/* Цену в кнопку не пишем: тарифов два, и цена выбирается на странице оплаты. */}
        <Link className="btn sm" data-testid="buy-top" href="/pay">
          Купить
        </Link>
      </div>
    </header>
  );
}
