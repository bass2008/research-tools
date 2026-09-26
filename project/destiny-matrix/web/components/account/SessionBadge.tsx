"use client";

import { useState } from "react";

// Кто вошёл — видно из ответа сервера, а не из localStorage: признак доступа один на весь сайт.
import { useSession } from "@/components/account/useSession";
import { useLocale } from "@/components/ui/LocaleProvider";
import SiteLink from "@/components/ui/SiteLink";
import { D } from "@/lib/i18n";
import { type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { personVisible } from "@/lib/session";

export const forLocale = localized((L: Locale) => {

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
  return { ROW, BTN };
});

export default function SessionBadge({ locale: requestedLocale, ...localeProps }: ({ plain?: boolean }) & { locale?: Locale }) {
  const activeLocale = useLocale();
  const L = requestedLocale ?? activeLocale;
  const { plain } = localeProps;
  const { ROW, BTN } = forLocale(L);

  const session = useSession();
  // сервер не подтвердил выход: кука жива, и человек должен это знать
  const [failed, setFailed] = useState(false);

  // Пока почта неизвестна — «проверяем доступ…»; известного человека служебной надписью не
  // затираем: на странице возврата из оплаты сверка идёт по расписанию, и шапка мигала.
  if (!personVisible(session.status, session.email)) {
    if (session.status === "loading") {
      // На 320–390 px полная надпись обрезалась посреди слова и заезжала под «Кабинет»:
      // короткое слово влезает, а смысл тот же — сверка ещё идёт.
      return (
        <span style={{ ...ROW, color: "var(--dim2)" }} className="checking">
          {D.auth.checking[L]}
        </span>
      );
    }
    return (
      <span style={ROW}>
        <SiteLink plain={plain} data-testid="nav-login" href="/login">
          {D.auth.signIn[L]}
        </SiteLink>
        <SiteLink plain={plain} data-testid="nav-register" href="/register">
          {D.auth.registerTitle[L]}
        </SiteLink>
      </span>
    );
  }

  return (
    <span style={ROW}>
      <SiteLink plain={plain} data-testid="account-email" className="user-email" href="/account">
        {session.email}
      </SiteLink>
      <button
        type="button"
        data-testid="logout"
        style={BTN}
        onClick={async () => {
          const done = await session.signOut();
          if (!done) {
            // сервер не ответил — кука жива, и человек остаётся в аккаунте: сказать об этом
            // важнее, чем показать главную и создать впечатление выхода
            setFailed(true);
            return;
          }
          // Полная перезагрузка, а не router.push: клиентский кеш роутера держит уже
          // напечатанные страницы, и после выхода прошлый разбор с датой рождения оставался
          // виден по той же ссылке.
          window.location.assign("/");
        }}
      >
        {failed ? D.auth.signOutAgain[L] : D.auth.signOut[L]}
      </button>
      {failed ? (
        <span className="err inline" role="alert" data-testid="logout-error">
          {D.auth.signOutFailed[L]}
        </span>
      ) : null}
    </span>
  );
}
