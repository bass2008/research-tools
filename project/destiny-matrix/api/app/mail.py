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
    if settings.mail_to_log:
        return False
    return bool(settings.smtp_user and settings.smtp_password)


def send(to: str, subject: str, body: str) -> bool:
    if not enabled():
        log.warning("письмо не отправлено (SMTP не настроен): %s → %s", subject, to)
        if settings.mock_payments or settings.mail_to_log:   # на стенде письма читают из лога
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


def purchase(to: str, tariff_name: str, payment_id: str, password: str | None = None,
             matrix_id: int | None = None) -> bool:
    # Без номера даты ссылка вела на «последнюю сохранённую», а купить могли не её:
    # человек шёл по письму и попадал в чужой по смыслу разбор.
    report = f"{settings.site_url}/report" + (f"?m={matrix_id}" if matrix_id else "")
    lines = [
        f"Ваш разбор готов: {tariff_name}.",
        f"Номер платежа: {payment_id}.",
        "",
        f"Смотреть разбор — {report}",
        f"Кабинет — {settings.site_url}/account",
    ]
    if password:
        lines += ["", f"Вход: {to}", f"Пароль: {password}"]
    lines += ["", "Если разбор не открылся, ответьте на это письмо."]
    return send(to, "Arcana Sense — ваш разбор готов", "\n".join(lines))


def welcome(to: str) -> bool:
    body = "\n".join([
        f"Аккаунт создан: {to}.",
        "",
        f"Кабинет — {settings.site_url}/account",
        "Разбор открывается сразу после оплаты.",
        "",
        "Если аккаунт создавали не вы, ответьте на это письмо.",
    ])
    return send(to, "Arcana Sense — аккаунт создан", body)


def refund(to: str, tariff_name: str, payment_id: str) -> bool:
    # «Разбор закрыт» звучало так, будто закрыт весь доступ: у покупателя нескольких дат
    # закрывается ровно одна — та, за которую вернули деньги. Саму дату не называем:
    # дата рождения в письмах не участвует.
    closed = "Разбор по этому платежу закрыт; другие оплаченные даты остаются открытыми."
    body = "\n".join([
        f"Платёж возвращён: {tariff_name}.",
        f"Номер платежа: {payment_id}.",
        "",
        closed,
        "Сохранённые даты остаются в кабинете.",
        "Деньги вернутся тем же способом, которым платили — обычно в течение нескольких дней.",
        "",
        "Если возврат оформляли не вы, ответьте на это письмо.",
    ])
    return send(to, "Arcana Sense — платёж возвращён", body)


def reset(to: str, link: str, hours: int) -> bool:
    body = "\n".join([
        "Восстановление пароля в Arcana Sense.",
        "",
        f"Ссылка: {link}",
        f"Действует {hours} ч. Если это были не вы, письмо можно удалить.",
    ])
    return send(to, "Arcana Sense — восстановление пароля", body)
