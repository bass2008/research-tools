"""Строки, которые сервер показывает человеку: отказы и письма.

Язык определяется для запроса через Accept-Language; SITE_LANG задаёт только fallback.
Фоновые задачи восстанавливают язык операции через using_locale. Ключ — короткое имя случая;
подстановки идут через `format`, потому что порядок слов у языков разный, а не потому, что
строку собирают из кусков.

Сообщения исключений и логи сюда не входят: их читает разработчик, и переводить их незачем.
"""
from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar

from .config import settings

SUPPORTED_LOCALES = ("ru", "en")
_locale: ContextVar[str | None] = ContextVar("locale", default=None)


def normalize_locale(value: str | None) -> str | None:
    base = (value or "").strip().lower().replace("_", "-").split("-")[0]
    return base if base in SUPPORTED_LOCALES else None


def current_locale() -> str:
    return _locale.get() or normalize_locale(settings.site_lang) or "ru"


def negotiate_locale(header: str | None, default: str | None = None) -> str:
    choices = []
    for index, part in enumerate((header or "").split(",")):
        tag, *params = part.strip().split(";")
        locale = normalize_locale(tag)
        weight = next((p.strip()[2:] for p in params if p.strip().startswith("q=")), "1")
        try:
            quality = float(weight)
        except ValueError:
            continue
        if locale and 0 < quality <= 1:
            choices.append((-quality, index, locale))
    return min(choices)[2] if choices else normalize_locale(default or settings.site_lang) or "ru"


@contextmanager
def using_locale(locale: str):
    token = _locale.set(normalize_locale(locale) or current_locale())
    try:
        yield
    finally:
        _locale.reset(token)

PHRASES: dict[str, dict[str, str]] = {
    "site.invalid": {"ru": "Не удалось определить сайт запроса", "en": "The request site could not be determined"},
    "pay.region_unavailable": {"ru": "На данный момент нет доступной оплаты для вашего региона", "en": "There are currently no payment methods available for your region"},
    "admin.not_found": {"ru": 'Не найдено', "en": 'Not found'},
    "admin.no_user": {"ru": 'Пользователь не найден', "en": 'User not found'},
    "admin.cancel_unavailable": {"ru": 'Этот платёж отменить нельзя: способ оплаты недоступен', "en": 'This payment cannot be canceled: the payment method is unavailable'},
    "admin.no_job": {"ru": 'Задача печати не найдена', "en": 'Print job not found'},
    "admin.no_file": {"ru": 'Файла нет: печать не завершилась', "en": 'No file: printing has not finished'},
    "admin.file_expired": {"ru": "Файл больше не хранится. Нажмите «Пересоздать».", "en": "The file is no longer stored. Click Rebuild."},
    "admin.print_busy": {"ru": 'Все места печати заняты, попробуйте позже', "en": 'All print slots are busy. Try again later'},
    "admin.print_failed": {"ru": 'Печать не удалась. Попробуйте позже.', "en": 'Printing failed. Try again later.'},
    "pay.gateway_failed": {"ru": 'Не удалось выполнить запрос к платёжному провайдеру. Попробуйте позже.', "en": 'The payment provider could not complete the request. Try again later.'},
    "pay.gateway_http": {"ru": 'Платёжный провайдер ответил с ошибкой HTTP {code}. Попробуйте позже.', "en": 'The payment provider returned HTTP error {code}. Try again later.'},
    "pay.gateway_unavailable": {"ru": 'Платёжный провайдер недоступен. Попробуйте позже.', "en": 'The payment provider is unavailable. Try again later.'},
    "pay.gateway_rejected": {"ru": 'Платёжный провайдер отклонил запрос (код {code}).', "en": 'The payment provider rejected the request (code {code}).'},
    "pay.receipt_email": {"ru": 'Для чека нужна почта покупателя.', "en": 'The customer email address is required for the receipt.'},
    "pay.invalid_signature": {"ru": 'Подпись уведомления не совпала', "en": 'The notification signature does not match'},
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
    "matrix.future_birth": {"ru": "дата рождения в будущем", "en": "Birth date is in the future"},
    "matrix.early_birth": {"ru": "поддерживаются даты рождения с 1900 года", "en": "Birth dates from 1900 onwards are supported"},
    "matrix.invalid_sex": {"ru": "sex должен быть 'm' или 'f'", "en": "Sex must be 'm' or 'f'"},
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
    text = phrase.get(current_locale(), phrase["ru"])
    return text.format(**values) if values else text


def validation_message(error: ValueError) -> str:
    """Translate the engine's public validation failures without changing its contract."""
    message = str(error)
    for key in ("matrix.future_birth", "matrix.early_birth", "matrix.invalid_sex"):
        if message == PHRASES[key]["ru"]:
            return say(key)
    return message
