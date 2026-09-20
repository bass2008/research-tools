"""Строки, которые сервер показывает человеку: отказы и письма.

Язык один на контур (`SITE_LANG`) и совпадает с языком фронта. Ключ — короткое имя случая;
подстановки идут через `format`, потому что порядок слов у языков разный, а не потому, что
строку собирают из кусков.

Сообщения исключений и логи сюда не входят: их читает разработчик, и переводить их незачем.
"""
from __future__ import annotations

from .config import settings

PHRASES: dict[str, dict[str, str]] = {
    # вход и аккаунт
    "auth.token_required": {
        "ru": "Нужен вход: передайте токен",
        "en": "Sign in first: the token is missing",
    },
    "auth.email_taken": {
        "ru": "Эта почта уже зарегистрирована",
        "en": "This email is already registered",
    },
    "auth.bad_credentials": {
        "ru": "Неверная почта или пароль",
        "en": "Wrong email or password",
    },
    "auth.link_invalid": {
        "ru": "Ссылка недействительна или просрочена",
        "en": "The link is invalid or has expired",
    },
    "auth.link_used": {
        "ru": "Ссылка уже использована — запросите новую",
        "en": "The link has already been used — request a new one",
    },
    # матрицы
    "matrix.not_found": {"ru": "Матрица не найдена", "en": "Matrix not found"},
    "matrix.no_slots": {
        "ru": "Мест для хранения дат больше нет: занято {used}.{offer}",
        "en": "There is no room left for more dates: {used} in use.{offer}",
    },
    "matrix.slots_offer": {
        "ru": " «{name}» добавит ещё одно место.",
        "en": " “{name}” adds one more slot.",
    },
    "matrix.hard_cap": {
        "ru": "Достигнут предохранитель в {cap} матриц",
        "en": "The safety limit of {cap} matrices has been reached",
    },
    # разбор и печать
    "report.not_found": {"ru": "Не найдено", "en": "Not found"},
    "report.link_expired": {"ru": "Ссылка устарела", "en": "The link has expired"},
    "report.file_missing": {"ru": "Файл не найден", "en": "File not found"},
    "report.not_paid": {
        "ru": "Разбор этой даты не оплачен",
        "en": "The reading for this date has not been paid for",
    },
    "report.print_off": {
        "ru": "Печать PDF не настроена",
        "en": "PDF printing is not set up",
    },
    "report.print_running": {
        "ru": "Печать этого разбора всё ещё идёт — откройте страницу заново через минуту",
        "en": "This reading is still printing — reload the page in a minute",
    },
    "report.print_busy": {
        "ru": "Сейчас печатается много разборов — нажмите ещё раз через минуту",
        "en": "Too many readings are printing right now — try again in a minute",
    },
    "report.print_failed": {
        "ru": "Не удалось напечатать PDF",
        "en": "The PDF could not be printed",
    },
    "report.pass_invalid": {"ru": "Пропуск недействителен", "en": "The pass is not valid"},
    "report.pass_other_matrix": {
        "ru": "Пропуск выдан на другую матрицу",
        "en": "The pass was issued for another matrix",
    },
    # оплата
    "pay.target_required": {
        "ru": "Укажите дату, за которую платите: доступ к одной дате без неё не выдаётся",
        "en": "Name the date you are paying for: access to a single date is not issued without it",
    },
    "pay.already_open": {
        "ru": "Эта дата уже открыта — второй раз платить не нужно",
        "en": "This date is already open — there is no need to pay twice",
    },
    "pay.already_open_dot": {
        "ru": "Разбор этой даты уже открыт — платить второй раз не нужно.",
        "en": "The reading for this date is already open — there is no need to pay again.",
    },
    "pay.all_free": {
        "ru": "Сейчас разбор открыт всем — платить не нужно.",
        "en": "The reading is open to everyone right now — there is nothing to pay for.",
    },
    "pay.user_failed": {
        "ru": "Не удалось создать пользователя",
        "en": "The account could not be created",
    },
    "pay.no_tariff": {"ru": "Такого тарифа нет", "en": "There is no such plan"},
    "pay.provider_down": {
        "ru": "Этот способ оплаты сейчас недоступен",
        "en": "This payment method is unavailable right now",
    },
    "pay.not_configured": {"ru": "Оплата не настроена", "en": "Payments are not set up"},
    "pay.no_method": {"ru": "Нет такого способа оплаты", "en": "There is no such payment method"},
    "pay.not_found": {"ru": "Платёж не найден", "en": "Payment not found"},
    "pay.mock_off": {"ru": "Мок-оплата отключена", "en": "Mock payments are switched off"},
    # письма
    "mail.purchase.subject": {
        "ru": "Arcana Sense — ваш разбор готов",
        "en": "Arcana Sense — your reading is ready",
    },
    "mail.purchase.ready": {"ru": "Ваш разбор готов: {tariff}.", "en": "Your reading is ready: {tariff}."},
    "mail.purchase.payment": {"ru": "Номер платежа: {id}.", "en": "Payment number: {id}."},
    "mail.purchase.open": {"ru": "Смотреть разбор — {url}", "en": "Open the reading — {url}"},
    "mail.account": {"ru": "Кабинет — {url}", "en": "Your account — {url}"},
    "mail.purchase.login": {"ru": "Вход: {email}", "en": "Sign in as: {email}"},
    "mail.purchase.password": {"ru": "Пароль: {password}", "en": "Password: {password}"},
    "mail.purchase.help": {
        "ru": "Если разбор не открылся, ответьте на это письмо.",
        "en": "If the reading did not open, just reply to this email.",
    },
    "mail.welcome.subject": {
        "ru": "Arcana Sense — аккаунт создан",
        "en": "Arcana Sense — your account is ready",
    },
    "mail.welcome.created": {"ru": "Аккаунт создан: {email}.", "en": "Account created: {email}."},
    "mail.welcome.afterPayment": {
        "ru": "Разбор открывается сразу после оплаты.",
        "en": "The reading opens right after payment.",
    },
    "mail.welcome.open": {
        "ru": "Разбор открыт: считайте любую дату и читайте её целиком.",
        "en": "The reading is open: calculate any date and read all of it.",
    },
    "mail.welcome.help": {
        "ru": "Если аккаунт создавали не вы, ответьте на это письмо.",
        "en": "If you did not create this account, reply to this email.",
    },
    "mail.refund.subject": {
        "ru": "Arcana Sense — платёж возвращён",
        "en": "Arcana Sense — your payment has been refunded",
    },
    "mail.refund.done": {"ru": "Платёж возвращён: {tariff}.", "en": "Payment refunded: {tariff}."},
    "mail.refund.closed": {
        "ru": "Разбор по этому платежу закрыт; другие оплаченные даты остаются открытыми.",
        "en": "The reading covered by this payment is closed; other paid dates stay open.",
    },
    "mail.refund.saved": {
        "ru": "Сохранённые даты остаются в кабинете.",
        "en": "Saved dates stay in your account.",
    },
    "mail.refund.money": {
        "ru": "Деньги вернутся тем же способом, которым платили — обычно в течение нескольких дней.",
        "en": "The money goes back the same way it was paid — usually within a few days.",
    },
    "mail.refund.help": {
        "ru": "Если возврат оформляли не вы, ответьте на это письмо.",
        "en": "If you did not ask for this refund, reply to this email.",
    },
    "mail.reset.subject": {
        "ru": "Arcana Sense — восстановление пароля",
        "en": "Arcana Sense — password reset",
    },
    "mail.reset.lead": {
        "ru": "Восстановление пароля в Arcana Sense.",
        "en": "Password reset at Arcana Sense.",
    },
    "mail.reset.link": {"ru": "Ссылка: {link}", "en": "Link: {link}"},
    # Подпись сохранённой матрицы. Месяц отдельным ключом: родительный падеж есть в русском и
    # не нужен в английском, а собирать дату из кусков в коде значит зашить туда порядок слов.
    "matrix.default_title": {
        "ru": "Матрица {day} {month} {year}",
        "en": "Chart of {day} {month} {year}",
    },
    "matrix.months": {
        "ru": "января февраля марта апреля мая июня июля августа сентября октября ноября декабря",
        "en": "January February March April May June July August September October November December",
    },
    # Что напечатано в шапке PDF вместо названия тарифа: на витрине без кассы плана нет вовсе.
    "report.plan_full": {"ru": "Полный разбор", "en": "Full reading"},
    "report.plan_free": {"ru": "Бесплатный просмотр", "en": "Free preview"},
    "error.internal": {"ru": "Внутренняя ошибка", "en": "Internal error"},
    "mail.reset.expires": {
        "ru": "Действует {hours} ч. Если это были не вы, письмо можно удалить.",
        "en": "It is valid for {hours} hours. If this was not you, just delete this email.",
    },
}


def say(key: str, **values: object) -> str:
    phrase = PHRASES[key]
    text = phrase.get(settings.site_lang, phrase["ru"])
    return text.format(**values) if values else text
