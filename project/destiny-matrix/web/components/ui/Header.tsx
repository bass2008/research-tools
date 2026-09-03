import BuyButton from "@/components/ui/BuyButton";
import SiteLink from "@/components/ui/SiteLink";
import Logo from "@/components/ui/Logo";
import SessionBadge from "@/components/account/SessionBadge";

export default function Header({ plain }: { plain?: boolean }) {
  return (
    <header className="site-header">
      <a className="skip" href="#content">
        Перейти к содержимому
      </a>
      <div className="wrap hrow">
        <SiteLink plain={plain} className="logo" href="/" aria-label="Arcana Sense — на главную">
          <Logo height={54} />
          <Logo compact height={38} />
        </SiteLink>
        <nav className="hnav">
          <SiteLink plain={plain} href="/report">Мой разбор</SiteLink>
          <SiteLink plain={plain} href="/encyclopedia">Энциклопедия</SiteLink>
        </nav>
        <span className="hspacer">
          <SessionBadge plain={plain} />
        </span>
        {/* Кабинет стоит рядом с «Выйти», а не в общем меню: это личные страницы, и вместе с
            почтой и выходом они читаются как один блок. */}
        <SiteLink plain={plain} className="btn ghost sm" data-testid="nav-account" href="/account">
          Кабинет
        </SiteLink>
        {/* Цену в кнопку не пишем: тарифов два, и цена выбирается на странице оплаты. */}
        <BuyButton plain={plain} />
      </div>
    </header>
  );
}
