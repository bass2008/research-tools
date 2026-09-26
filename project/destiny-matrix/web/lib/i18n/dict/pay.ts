import type { Phrase, PhraseFn } from "./index";

export const pay = {
  regionUnavailable: {
    ru: "На данный момент нет доступной оплаты для вашего региона",
    en: "There are currently no payment methods available for your region",
  } satisfies Phrase,
  paymentMethod: { ru: "Способ оплаты", en: "Payment method" } satisfies Phrase,
  tbank: { ru: "Т-Банк", en: "T-Bank" } satisfies Phrase,
  mock: { ru: "Тестовая оплата", en: "Test payment" } satisfies Phrase,
  /** Общий API сейчас считает цены в копейках. Переключение языка не меняет валюту. */
  currency: { ru: "₽", en: "₽" } satisfies Phrase,
  priceFormat: {
    ru: (amount: string) => `${amount} ₽`,
    en: (amount: string) => `${amount} ₽`,
  } satisfies PhraseFn<[string]>,
  forever: { ru: "навсегда", en: "forever" } satisfies Phrase,
  forMonth: { ru: "на месяц", en: "for a month" } satisfies Phrase,
  forMonths: {
    ru: (n: number) => `на ${n} ${n < 5 ? "месяца" : "месяцев"}`,
    en: (n: number) => `for ${n} months`,
  } satisfies PhraseFn<[number]>,
  forDays: {
    ru: (n: number) => `на ${n} дней`,
    en: (n: number) => `for ${n} days`,
  } satisfies PhraseFn<[number]>,
  subscription: { ru: "Подписка", en: "Subscription" } satisfies Phrase,
  pageTitle: { ru: "Оплата разбора", en: "Paying for the reading" } satisfies Phrase,
  pageDescription: {
    ru: "Оплата полного разбора матрицы судьбы: 20 разделов по вашей дате рождения.",
    en: "Paying for the full destiny matrix reading: 20 sections for your date of birth.",
  } satisfies Phrase,
  tariffTitle: {
    ru: (name: string, price: string) => `Оплата тарифа «${name}» — ${price}`,
    en: (name: string, price: string) => `Paying for the “${name}” plan — ${price}`,
  } satisfies PhraseFn<[string, string]>,
  tariffDescription: {
    ru: (name: string, price: string, period: string) => `${name}: ${price}, ${period}.`,
    en: (name: string, price: string, period: string) => `${name}: ${price}, ${period}.`,
  } satisfies PhraseFn<[string, string, string]>,
  privacyNote: {
    ru: "Платёжному провайдеру дата рождения не передаётся: в ссылку оплаты она не попадает. "
      + "Выбранная дата сохраняется в ваш кабинет — по ней сервер печатает платные разделы.",
    en: "The date of birth is not passed to the payment provider: it never goes into the payment "
      + "link. The chosen date is kept in your account — the server prints the paid sections from it.",
  } satisfies Phrase,
  checkFailed: {
    ru: "Не удалось проверить доступ.",
    en: "The access could not be checked.",
  } satisfies Phrase,
  anyDates: { ru: "Любое число дат", en: "Any number of dates" } satisfies Phrase,
  oneDate: { ru: "Одна дата", en: "One date" } satisfies Phrase,
  onePayment: { ru: "один платёж", en: "one payment" } satisfies Phrase,
  // тарифная карточка
  allSections: { ru: "Все 20 разделов разбора", en: "All 20 sections of the reading" } satisfies Phrase,
  unlimitedDates: { ru: "Любое число дат рождения", en: "Any number of birth dates" } satisfies Phrase,
  singleDate: { ru: "Одна дата рождения", en: "One date of birth" } satisfies Phrase,
  storedInAccount: { ru: "Матрицы хранятся в кабинете", en: "Matrices are kept in your account" } satisfies Phrase,
  noSubscription: { ru: "Один платёж, без подписки", en: "One payment, no subscription" } satisfies Phrase,
  opensAtOnce: { ru: "Открывается сразу после оплаты", en: "Opens right after payment" } satisfies Phrase,
  downloadsAsPdf: { ru: "Скачивается в PDF и остаётся у вас", en: "Downloads as a PDF and stays with you" } satisfies Phrase,
  openedFor: {
    ru: (period: string) => `Открыто ${period}, дальше закрывается`,
    en: (period: string) => `Open ${period}, then it closes`,
  } satisfies PhraseFn<[string]>,
  manualRenewal: {
    ru: "Без автосписаний: продление вручную",
    en: "No automatic charges: renewal is manual",
  } satisfies Phrase,
  buyFor: {
    ru: (price: string) => `Купить за ${price}`,
    en: (price: string) => `Buy for ${price}`,
  } satisfies PhraseFn<[string]>,
  priceBeingUpdated: { ru: "уточняется", en: "being updated" } satisfies Phrase,
  freeWord: { ru: "бесплатно", en: "free" } satisfies Phrase,
};

export const payForm = {
  anyDates: { ru: "любое число дат", en: "any number of dates" } satisfies Phrase,
  oneDate: { ru: "одна дата", en: "one date" } satisfies Phrase,
  storedInAccount: { ru: "матрицы хранятся в кабинете", en: "matrices are kept in your account" } satisfies Phrase,
  noSubscription: {
    ru: "без подписки: открыт в аккаунте и скачивается в PDF",
    en: "no subscription: open in your account and downloadable as a PDF",
  } satisfies Phrase,
  openedUntil: {
    ru: (period: string) => `открыто ${period}, потом закрывается`,
    en: (period: string) => `open ${period}, then it closes`,
  } satisfies PhraseFn<[string]>,
  whatWeBuy: { ru: "Что покупаем", en: "What you are buying" } satisfies Phrase,
  manyPlans: {
    ru: "Все 20 разделов разбора открывает любой из тарифов — разница в числе дат и сроке.",
    en: "Every plan opens all 20 sections — they differ in the number of dates and in the term.",
  } satisfies Phrase,
  onePlan: {
    ru: (price: string) => `Все 20 разделов разбора по одной дате рождения. Стоимость — ${price}, `
      + "один платёж без подписки; разбор скачивается в PDF.",
    en: (price: string) => `All 20 sections of the reading for one date of birth. The price is ${price}, `
      + "one payment with no subscription; the reading downloads as a PDF.",
  } satisfies PhraseFn<[string]>,
  planGroup: { ru: "Тариф", en: "Plan" } satisfies Phrase,
  paymentOpens: { ru: "Платёж откроет", en: "The payment opens" } satisfies Phrase,
  checkingDate: { ru: "Проверяем дату…", en: "Checking the date…" } satisfies Phrase,
  noDateChosen: { ru: "Дата не выбрана", en: "No date chosen" } satisfies Phrase,
  checkingLink: {
    ru: "Проверяем дату из ссылки в вашем кабинете…",
    en: "Checking the date from the link in your account…",
  } satisfies Phrase,
  loginForDate: {
    ru: "Эта дата сохранена в аккаунте —",
    en: "This date is saved in an account —",
  } satisfies Phrase,
  loginForDateTail: {
    ru: ", чтобы открыть именно её. Другую дату можно",
    en: " to open that one. Another date can be",
  } satisfies Phrase,
  calcOnHome: { ru: "посчитать на главной", en: "calculated on the home page" } satisfies Phrase,
  alreadyOpen: {
    ru: (label: string) => `Разбор «${label}» уже открыт — второй раз платить не нужно.`,
    en: (label: string) => `The “${label}” reading is already open — no need to pay again.`,
  } satisfies PhraseFn<[string]>,
  openReading: { ru: "Открыть разбор", en: "Open the reading" } satisfies Phrase,
  anotherDate: { ru: "Другую дату можно", en: "Another date can be" } satisfies Phrase,
  missingDate: {
    ru: "Даты из ссылки в вашем кабинете нет: платёж за неё не пройдёт. Выберите дату из списка или",
    en: "The date from the link is not in your account, so a payment for it will not go through. Pick a date from the list or",
  } satisfies Phrase,
  calcItOnHome: { ru: "посчитайте её на главной", en: "calculate it on the home page" } satisfies Phrase,
  noDateChosenHint: {
    ru: "Дата не выбрана: платёж открывает конкретную дату.",
    en: "No date is chosen: a payment opens one specific date.",
  } satisfies Phrase,
  enterOnHome: { ru: "Введите её на главной", en: "Enter it on the home page" } satisfies Phrase,
  freeCalc: { ru: "— расчёт бесплатный.", en: "— the calculation is free." } satisfies Phrase,
  willOpen: {
    ru: (label: string) => `Откроется «${label}». Платёжному провайдеру дата не передаётся.`,
    en: (label: string) => `“${label}” will open. The date is never passed to the payment provider.`,
  } satisfies PhraseFn<[string]>,
  emailLabel: { ru: "Почта для доступа", en: "Email for access" } satisfies Phrase,
  signedInAs: {
    ru: (email: string) => `Вы вошли как ${email}: тариф начислится этому аккаунту.`,
    en: (email: string) => `You are signed in as ${email}: the plan will be added to this account.`,
  } satisfies PhraseFn<[string]>,
  passwordKnown: { ru: "Пароль этого аккаунта", en: "Password of this account" } satisfies Phrase,
  passwordNew: { ru: "Пароль для входа", en: "Password to sign in" } satisfies Phrase,
  passwordPlaceholderKnown: { ru: "ваш пароль", en: "your password" } satisfies Phrase,
  passwordPlaceholderNew: {
    ru: (min: number) => `не короче ${min} знаков`,
    en: (min: number) => `at least ${min} characters`,
  } satisfies PhraseFn<[number]>,
  accountExists: {
    ru: "На эту почту уже есть аккаунт — нужен его пароль. Забыли?",
    en: "There is already an account for this email — its password is needed. Forgotten it?",
  } satisfies Phrase,
  restorePassword: { ru: "Восстановить пароль", en: "Reset the password" } satisfies Phrase,
  newPairHint: {
    ru: "С этой парой вход работает с любого устройства. На эту почту придёт письмо о покупке.",
    en: "This pair signs you in from any device. A receipt will be sent to this address.",
  } satisfies Phrase,
  consentHead: {
    ru: "Согласен(на) на обработку персональных данных на условиях",
    en: "I agree to the processing of personal data under the",
  } satisfies Phrase,
  consentPolicy: { ru: "политики", en: "privacy policy" } satisfies Phrase,
  consentAccept: { ru: ", принимаю", en: ", I accept the" } satisfies Phrase,
  consentTerms: { ru: "оферту", en: "terms" } satisfies Phrase,
  consentAnd: { ru: "и", en: "and the" } satisfies Phrase,
  consentRefund: { ru: "условия возврата", en: "refund policy" } satisfies Phrase,
  preparing: { ru: "Готовим форму…", en: "Preparing the form…" } satisfies Phrase,
  processing: { ru: "Проводим платёж…", en: "Processing the payment…" } satisfies Phrase,
  payButton: {
    ru: (price: string, target: string) => `Оплатить ${price}${target}`,
    en: (price: string, target: string) => `Pay ${price}${target}`,
  } satisfies PhraseFn<[string, string]>,
  signedIntoExisting: {
    ru: (email: string) => `Аккаунт на ${email} уже был — мы вошли в него, новый не создавали. `
      + "Тариф начислен ему, поэтому в кабинете видны прежние матрицы и платежи.",
    en: (email: string) => `An account for ${email} already existed — we signed into it instead of `
      + "creating a new one. The plan went to that account, so your earlier matrices and payments are there.",
  } satisfies PhraseFn<[string]>,
  errors: {
    refunded: {
      ru: "Этот платёж возвращён: доступ по нему закрыт.",
      en: "This payment was refunded: the access it opened is closed.",
    } satisfies Phrase,
    consent: {
      ru: "Нужно согласие на обработку персональных данных.",
      en: "Consent to the processing of personal data is required.",
    } satisfies Phrase,
    otherAccount: {
      ru: (email: string) => `Вы вошли как ${email}: тариф начислится этому аккаунту. Чтобы `
        + "оплатить на другую почту, сначала выйдите из аккаунта.",
      en: (email: string) => `You are signed in as ${email}: the plan will go to this account. To `
        + "pay with another address, sign out first.",
    } satisfies PhraseFn<[string]>,
    shortPassword: {
      ru: (min: number) => `Пароль для входа — не короче ${min} знаков.`,
      en: (min: number) => `The password has to be at least ${min} characters long.`,
    } satisfies PhraseFn<[number]>,
    noDate: {
      ru: "Сначала введите дату рождения — платёж открывает конкретную дату.",
      en: "Enter a date of birth first — a payment opens one specific date.",
    } satisfies Phrase,
    wrongPassword: {
      ru: "На эту почту уже есть аккаунт, и этот пароль к нему не подошёл. Введите пароль "
        + "аккаунта или восстановите его — ссылка «Восстановить пароль» под формой. "
        + "Тариф начислится этому аккаунту.",
      en: "There is already an account for this email and the password did not match. Enter the "
        + "account password or reset it — the “Reset the password” link is under the form. "
        + "The plan will go to that account.",
    } satisfies Phrase,
    notCharged: {
      ru: " Платёж не прошёл — деньги не списаны.",
      en: " The payment did not go through — nothing was charged.",
    } satisfies Phrase,
    sessionExpired: {
      ru: "Сессия истекла — введите пароль аккаунта ещё раз.",
      en: "The session has expired — enter the account password again.",
    } satisfies Phrase,
    noAnswer: {
      ru: "Ответ от сервера не дошёл. Если платёж всё же прошёл, разбор уже открыт — "
        + "обновите страницу; второй раз за ту же дату списать не получится.",
      en: "No answer came back from the server. If the payment did go through, the reading is "
        + "already open — refresh the page; the same date cannot be charged twice.",
    } satisfies Phrase,
    generic: {
      ru: "Что-то пошло не так. Попробуйте ещё раз.",
      en: "Something went wrong. Please try again.",
    } satisfies Phrase,
  },
};

export const payResult = {
  invoiceGone: {
    ru: "Счёт больше не действует — оплату можно начать заново.",
    en: "The invoice is no longer valid — the payment can be started again.",
  } satisfies Phrase,
  ownerOnly: {
    ru: "Войдите в аккаунт, на который оформляли платёж, — состояние платежа видно только владельцу.",
    en: "Sign in to the account the payment was made from — only the owner can see its state.",
  } satisfies Phrase,
  noServer: { ru: "Сервер не ответил.", en: "The server did not answer." } satisfies Phrase,
  accessOpen: { ru: "Доступ открыт", en: "Access is open" } satisfies Phrase,
  paidSaved: {
    ru: "Платёж прошёл, разбор сохранён в кабинете.",
    en: "The payment went through and the reading is saved in your account.",
  } satisfies Phrase,
  openFull: { ru: "Открыть полный разбор", en: "Open the full reading" } satisfies Phrase,
  refundedTitle: { ru: "Платёж возвращён", en: "The payment was refunded" } satisfies Phrase,
  refundedText: {
    ru: "Деньги вернулись тем же способом, которым платили. Разбор закрыт, сохранённая дата "
      + "осталась в кабинете — при желании можно оплатить снова.",
    en: "The money went back the same way it came. The reading is closed and the saved date stays "
      + "in your account — you can pay again if you want.",
  } satisfies Phrase,
  payAgain: { ru: "Оплатить снова", en: "Pay again" } satisfies Phrase,
  failedTitle: { ru: "Платёж не прошёл", en: "The payment did not go through" } satisfies Phrase,
  failedText: {
    ru: "Деньги не списаны. Можно попробовать ещё раз — другой картой или позже.",
    en: "Nothing was charged. You can try again — with another card or later.",
  } satisfies Phrase,
  backToPay: { ru: "Вернуться к оплате", en: "Back to payment" } satisfies Phrase,
  checkingTitle: { ru: "Проверяем платёж", en: "Checking the payment" } satisfies Phrase,
  checkingText: {
    ru: "Спрашиваем банк о результате — это занимает пару секунд.",
    en: "We are asking the bank for the result — it takes a couple of seconds.",
  } satisfies Phrase,
  unknownTitle: { ru: "Не удалось проверить платёж", en: "The payment could not be checked" } satisfies Phrase,
  pendingTitle: { ru: "Платёж ещё обрабатывается", en: "The payment is still being processed" } satisfies Phrase,
  pendingText: {
    ru: "Банк пока не подтвердил оплату. Как только подтвердит, доступ откроется сам — "
      + "обновите кабинет через минуту.",
    en: "The bank has not confirmed the payment yet. Once it does, access opens by itself — "
      + "refresh your account in a minute.",
  } satisfies Phrase,
  toAccount: { ru: "В кабинет", en: "To your account" } satisfies Phrase,
  // состояния платежа в списке
  stagePaid: { ru: "Оплата прошла", en: "Payment completed" } satisfies Phrase,
  stageRefunded: { ru: "Платёж возвращён", en: "Payment refunded" } satisfies Phrase,
  stageFailed: { ru: "Платёж не прошёл", en: "Payment failed" } satisfies Phrase,
  stagePending: { ru: "Платёж ещё в обработке", en: "Payment still processing" } satisfies Phrase,
  stageUnknown: { ru: "Не удалось проверить платёж", en: "Payment could not be checked" } satisfies Phrase,
  stageChecking: { ru: "Проверяем платёж", en: "Checking the payment" } satisfies Phrase,
  // чек
  receiptTitle: { ru: "Доступ открыт", en: "Access is open" } satisfies Phrase,
  receiptLine: {
    ru: (id: string, plan: string) => `Платёж ${id} · тариф «${plan}»`,
    en: (id: string, plan: string) => `Payment ${id} · plan “${plan}”`,
  } satisfies PhraseFn<[string, string]>,
  testNote: {
    ru: "Это тестовый приём оплаты: списаний не происходит. ",
    en: "This is a test payment endpoint: nothing is charged. ",
  } satisfies Phrase,
  receiptAccountHead: { ru: "Разделы открыты в аккаунте", en: "The sections are open in the account" } satisfies Phrase,
  receiptAccountTail: {
    ru: ", а не в этом браузере, — поэтому доступ работает и с телефона.",
    en: ", not in this browser — so access works from a phone too.",
  } satisfies Phrase,
  receiptSignIn: { ru: "Вход с другого устройства —", en: "To sign in from another device —" } satisfies Phrase,
  receiptSignInPage: { ru: "на странице входа", en: "use the sign-in page" } satisfies Phrase,
  receiptCredentials: {
    ru: (email: string) => `: почта ${email} и пароль, который вы задали.`,
    en: (email: string) => `: the address ${email} and the password you set.`,
  } satisfies PhraseFn<[string]>,
  receiptExisting: {
    ru: (email: string) => `Аккаунт на ${email} уже существовал — мы вошли в него, а не создали `
      + "новый. Поэтому в кабинете есть прежние матрицы и платежи.",
    en: (email: string) => `An account for ${email} already existed — we signed into it instead of `
      + "creating a new one. That is why your earlier matrices and payments are in the account.",
  } satisfies PhraseFn<[string]>,
  receiptOpened: { ru: "Этим платежом открыта:", en: "This payment opened:" } satisfies Phrase,
  receiptSavedTail: {
    ru: (label: string) => `${label} сохранена в кабинете — платные разделы печатает сервер, `
      + "поэтому разбор открывается с любого устройства.",
    en: (label: string) => `${label} is saved in your account — the server prints the paid sections, `
      + "so the reading opens from any device.",
  } satisfies PhraseFn<[string]>,
  uncheckedTitle: { ru: "Не удалось проверить платёж", en: "The payment could not be checked" } satisfies Phrase,
  uncheckedLead: {
    ru: (id: string) => `Сервер не ответил, поэтому мы не знаем, прошёл ли платёж ${id}. `
      + "Обновите страницу через минуту — если деньги списались, разбор уже открыт в",
    en: (id: string) => `The server did not answer, so we do not know whether payment ${id} went `
      + "through. Refresh the page in a minute — if the money was taken, the reading is already open in",
  } satisfies PhraseFn<[string]>,
  uncheckedAccount: { ru: "кабинете", en: "your account" } satisfies Phrase,
  uncheckedRetry: { ru: "Проверить ещё раз", en: "Check again" } satisfies Phrase,
  // страницы возврата с формы банка
  donePageTitle: { ru: "Результат оплаты", en: "Payment result" } satisfies Phrase,
  donePageDescription: {
    ru: "Возврат с платёжной формы: проверяем платёж и открываем разбор.",
    en: "Back from the payment form: we check the payment and open the reading.",
  } satisfies Phrase,
  failPageTitle: { ru: "Платёж не прошёл", en: "The payment did not go through" } satisfies Phrase,
  failPageDescription: {
    ru: "Возврат с платёжной формы: платёж не состоялся.",
    en: "Back from the payment form: the payment did not happen.",
  } satisfies Phrase,
};
