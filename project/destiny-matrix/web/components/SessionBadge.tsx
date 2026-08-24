"use client";

// Кто вошёл — видно из ответа сервера, а не из localStorage: признак доступа один на весь сайт.
import Link from "next/link";

import { personVisible } from "@/lib/session";

import { useSession } from "./useSession";

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  font: "600 13px var(--sans)",
  color: "var(--dim)",
  whiteSpace: "nowrap",
};

const BTN: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  width: "auto",
};

export default function SessionBadge() {
  const session = useSession();

  // Пока почта неизвестна — «проверяем доступ…»; известного человека служебной надписью не
  // затираем: на странице возврата из оплаты сверка идёт по расписанию, и шапка мигала.
  if (!personVisible(session.status, session.email)) {
    if (session.status === "loading") {
      return <span style={{ ...ROW, color: "var(--dim2)" }}>проверяем доступ…</span>;
    }
    return (
      <span style={ROW}>
        <Link data-testid="nav-login" href="/login">
          Войти
        </Link>
        <Link data-testid="nav-register" href="/register">
          Регистрация
        </Link>
      </span>
    );
  }

  return (
    <span style={ROW}>
      <Link data-testid="account-email" className="user-email" href="/account">
        {session.email}
      </Link>
      <button
        type="button"
        data-testid="logout"
        style={BTN}
        onClick={async () => {
          await session.signOut();
          // Полная перезагрузка, а не router.push: клиентский кеш роутера держит уже
          // напечатанные страницы, и после выхода прошлый разбор с датой рождения оставался
          // виден по той же ссылке.
          window.location.assign("/");
        }}
      >
        Выйти
      </button>
    </span>
  );
}
