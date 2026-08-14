import Link from "next/link";

import { LEAD_ID } from "@/lib/tariffs";

import Price from "./Price";

import SessionBadge from "./SessionBadge";

export default function Header() {
  return (
    <header className="site-header">
      <div className="wrap hrow">
        <Link className="logo" href="/">
          <i>✦</i> Матрица судьбы
        </Link>
        <nav className="hnav">
          <Link href="/#calc">Рассчитать</Link>
          <Link href="/report">Мой разбор</Link>
          <Link href="/encyclopedia">Энциклопедия</Link>
          <Link href="/encyclopedia/arcanum/1">22 аркана</Link>
          <Link href="/account">Кабинет</Link>
        </nav>
        <span className="hspacer">
          <SessionBadge />
        </span>
        <Link className="btn sm" data-testid="price-full" href={`/pay/${LEAD_ID}`}>
          Полный разбор — <Price />
        </Link>
      </div>
    </header>
  );
}
