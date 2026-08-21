"""Отправка писем через Postbox (SMTP). Без ключей просто пишет в лог и возвращает False —
локальная разработка и тесты не должны требовать доступа к почте.

Письмо никогда не содержит дату рождения: она специальная категория персональных данных, и в
переписке ей делать нечего. В письма уходят только почта, тариф и номер платежа.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from .config import settings

log = logging.getLogger("arcana.mail")


def enabled() -> bool:
    return bool(settings.smtp_user and settings.smtp_password)


def send(to: str, subject: str, body: str) -> bool:
    if not enabled():
        log.warning("письмо не отправлено (SMTP не настроен): %s → %s", subject, to)
        if settings.mock_payments:              # на дев-стенде письма читают из лога
            log.warning("%s", body)
        return False
    msg = EmailMessage()
    msg["From"] = f"{settings.mail_from_name} <{settings.mail_from}>"
    msg["To"] = to
    # ответы должны попадать человеку, а не в noreply
    msg["Reply-To"] = settings.mail_reply_to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception as exc:                      # noqa: BLE001
        # платёж и регистрация не должны падать из-за почты
        log.warning("письмо не ушло (%s → %s): %s", subject, to, exc)
        return False


def purchase(to: str, tariff_name: str, payment_id: str, password: str | None = None) -> bool:
    lines = [
        f"Доступ открыт: {tariff_name}.",
        f"Номер платежа: {payment_id}.",
        "",
        f"Разбор — {settings.site_url}/report",
        f"Кабинет — {settings.site_url}/account",
    ]
    if password:
        lines += ["", f"Вход: {to}", f"Пароль: {password}"]
    lines += ["", "Если разбор не открылся, ответьте на это письмо."]
    return send(to, "Arcana Sense — доступ открыт", "\n".join(lines))


def welcome(to: str) -> bool:
    body = "\n".join([
        f"Аккаунт создан: {to}.",
        "",
        f"Кабинет — {settings.site_url}/account",
        "Полный разбор одной даты открывается сразу после оплаты.",
        "",
        "Если аккаунт создавали не вы, ответьте на это письмо.",
    ])
    return send(to, "Arcana Sense — аккаунт создан", body)


def reset(to: str, link: str, hours: int) -> bool:
    body = "\n".join([
        "Восстановление пароля в Arcana Sense.",
        "",
        f"Ссылка: {link}",
        f"Действует {hours} ч. Если это были не вы, письмо можно удалить.",
    ])
    return send(to, "Arcana Sense — восстановление пароля", body)
