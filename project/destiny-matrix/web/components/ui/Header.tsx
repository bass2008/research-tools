import Link from "next/link";

import BuyButton from "@/components/ui/BuyButton";
import Logo from "@/components/ui/Logo";
import SessionBadge from "@/components/account/SessionBadge";

export default function Header() {
  return (
    <header className="site-header">
      <a className="skip" href="#content">
        Перейти к содержимому
      </a>
      <div className="wrap hrow">
        <Link className="logo" href="/" aria-label="Arcana Sense — на главную">
          <Logo height={54} />
          <Logo compact height={38} />
        </Link>
        <nav className="hnav">
          <Link href="/report">Мой разбор</Link>
          <Link href="/encyclopedia">Энциклопедия</Link>
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
        <BuyButton />
      </div>
    </header>
  );
}
