import type { Phrase, PhraseFn } from "./index";

export const auth = {
  registerTitle: { ru: "Регистрация", en: "Sign up" } satisfies Phrase,
  loginTitle: { ru: "Вход", en: "Sign in" } satisfies Phrase,
  registerLead: {
    ru: "Аккаунт нужен, чтобы хранить сохранённые матрицы и доступ к разделам.",
    en: "An account keeps your saved matrices and your access to the sections.",
  } satisfies Phrase,
  loginLead: {
    ru: "Введите почту и пароль, которые указывали при регистрации.",
    en: "Enter the email and password you used when signing up.",
  } satisfies Phrase,
  email: { ru: "Почта", en: "Email" } satisfies Phrase,
  password: { ru: "Пароль", en: "Password" } satisfies Phrase,
  passwordPlaceholder: { ru: "не короче 3 знаков", en: "at least 3 characters" } satisfies Phrase,
  shortPassword: {
    ru: "Пароль — не короче трёх знаков.",
    en: "The password has to be at least three characters long.",
  } satisfies Phrase,
  consentRequired: {
    ru: "Нужно согласие на обработку персональных данных.",
    en: "Consent to the processing of personal data is required.",
  } satisfies Phrase,
  generic: {
    ru: "Не получилось. Попробуйте ещё раз.",
    en: "That did not work. Please try again.",
  } satisfies Phrase,
  consentHead: {
    ru: "Согласен(на) на обработку персональных данных на условиях",
    en: "I agree to the processing of personal data under the",
  } satisfies Phrase,
  consentPolicy: {
    ru: "политики обработки персональных данных",
    en: "privacy policy",
  } satisfies Phrase,
  consentAnd: { ru: "и принимаю", en: "and I accept the" } satisfies Phrase,
  consentTerms: { ru: "публичную оферту", en: "terms of service" } satisfies Phrase,
  preparing: { ru: "Готовим форму…", en: "Preparing the form…" } satisfies Phrase,
  sending: { ru: "Отправляем…", en: "Sending…" } satisfies Phrase,
  createAccount: { ru: "Создать аккаунт", en: "Create an account" } satisfies Phrase,
  signIn: { ru: "Войти", en: "Sign in" } satisfies Phrase,
  haveAccount: { ru: "Уже есть аккаунт?", en: "Already have an account?" } satisfies Phrase,
  noAccount: { ru: "Нет аккаунта?", en: "No account yet?" } satisfies Phrase,
  register: { ru: "Зарегистрироваться", en: "Sign up" } satisfies Phrase,
  forgotQuestion: { ru: "· забыли пароль?", en: "· forgotten your password?" } satisfies Phrase,
  restore: { ru: "Восстановить", en: "Reset it" } satisfies Phrase,
  // восстановление
  mailSent: { ru: "Письмо отправлено", en: "The email has been sent" } satisfies Phrase,
  mailSentText: {
    ru: (email: string) => `Если на ${email} есть аккаунт, ссылка для смены пароля уже там. `
      + "Ссылка действует 4 часа.",
    en: (email: string) => `If there is an account for ${email}, the password link is already `
      + "there. The link works for 4 hours.",
  } satisfies PhraseFn<[string]>,
  noMail: {
    ru: "Письма нет? Проверьте папку со спамом или напишите на",
    en: "No email? Check the spam folder or write to",
  } satisfies Phrase,
  otherAddress: { ru: "Ввести другой адрес", en: "Use another address" } satisfies Phrase,
  rememberedPassword: { ru: "Вспомнили пароль?", en: "Remembered your password?" } satisfies Phrase,
  forgotTitle: { ru: "Восстановление пароля", en: "Password reset" } satisfies Phrase,
  forgotLead: {
    ru: "Пришлём ссылку для смены пароля на почту, указанную при регистрации.",
    en: "We will send a password link to the address you used when signing up.",
  } satisfies Phrase,
  sendLink: { ru: "Прислать ссылку", en: "Send the link" } satisfies Phrase,
  incompleteLink: { ru: "Ссылка неполная", en: "The link is incomplete" } satisfies Phrase,
  incompleteLinkText: {
    ru: "В адресе нет кода восстановления — откройте ссылку из письма целиком.",
    en: "The address has no reset code — open the whole link from the email.",
  } satisfies Phrase,
  requestNewLink: { ru: "Запросить новую ссылку", en: "Request a new link" } satisfies Phrase,
  newPassword: { ru: "Новый пароль", en: "New password" } satisfies Phrase,
  newPasswordLead: {
    ru: "После смены вы сразу войдёте в кабинет.",
    en: "Once it is changed you will be signed in.",
  } satisfies Phrase,
  changing: { ru: "Меняем…", en: "Changing…" } satisfies Phrase,
  changePassword: { ru: "Сменить пароль", en: "Change the password" } satisfies Phrase,
  linkFailed: { ru: "Ссылка не сработала?", en: "Did the link fail?" } satisfies Phrase,
  requestNew: { ru: "Запросить новую", en: "Request a new one" } satisfies Phrase,
  // бейдж сессии
  checking: { ru: "проверяем…", en: "checking…" } satisfies Phrase,
  signOut: { ru: "Выйти", en: "Sign out" } satisfies Phrase,
  signOutAgain: { ru: "Выйти ещё раз", en: "Sign out again" } satisfies Phrase,
  signOutFailed: {
    ru: "Сервер не ответил — выход не выполнен, вы остались в аккаунте.",
    en: "The server did not answer — you are still signed in.",
  } satisfies Phrase,
};

export const account = {
  signMatrix: { ru: "Подписать матрицу", en: "Name the matrix" } satisfies Phrase,
  save: { ru: "Сохранить", en: "Save" } satisfies Phrase,
  cancel: { ru: "Отменить", en: "Cancel" } satisfies Phrase,
  badgeBought: { ru: "Куплена", en: "Bought" } satisfies Phrase,
  badgeOpen: { ru: "Открыта", en: "Open" } satisfies Phrase,
  badgeSubscription: {
    ru: (until: string) => `По подписке${until ? ` · до ${until}` : ""}`,
    en: (until: string) => `By subscription${until ? ` · until ${until}` : ""}`,
  } satisfies PhraseFn<[string]>,
  badgeClosed: { ru: "Закрыта", en: "Closed" } satisfies Phrase,
  unavailable: { ru: "Кабинет недоступен.", en: "The account is unavailable." } satisfies Phrase,
  renamed: { ru: "Имя изменено", en: "The name has been changed" } satisfies Phrase,
  renameFailed: {
    ru: "Не получилось переименовать матрицу.",
    en: "The matrix could not be renamed.",
  } satisfies Phrase,
  checkingAccess: { ru: "Проверяем доступ…", en: "Checking access…" } satisfies Phrase,
  needSignIn: { ru: "Нужен вход", en: "Sign-in required" } satisfies Phrase,
  needSignInText: {
    ru: "Кабинет хранит сохранённые матрицы и открывает их с любого устройства. Расчёт "
      + "без регистрации остаётся доступным — он идёт в браузере.",
    en: "The account keeps your saved matrices and opens them from any device. The "
      + "calculation stays available without sign-up — it runs in the browser.",
  } satisfies Phrase,
  serverSilent: { ru: "Сервер не ответил.", en: "The server did not answer." } satisfies Phrase,
  refreshPage: { ru: "Обновите страницу.", en: "Refresh the page." } satisfies Phrase,
  orJustCalculate: { ru: "· или", en: "· or just" } satisfies Phrase,
  justCalculate: { ru: "просто рассчитать", en: "calculate", } satisfies Phrase,
  yourAccess: { ru: "Ваш доступ", en: "Your access" } satisfies Phrase,
  accessWord: { ru: "Доступ", en: "Access" } satisfies Phrase,
  boughtForever: {
    ru: (dates: string) => `Куплено ${dates} навсегда`,
    en: (dates: string) => `${dates} bought forever`,
  } satisfies PhraseFn<[string]>,
  datesCount: {
    ru: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "дата"
      : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "даты" : "дат"}`,
    en: (n: number) => `${n} ${n === 1 ? "date" : "dates"}`,
  } satisfies PhraseFn<[number]>,
  allDatesAccess: { ru: "Доступ ко всем датам", en: "Access to every date" } satisfies Phrase,
  until: {
    ru: (day: string) => ` · до ${day}`,
    en: (day: string) => ` · until ${day}`,
  } satisfies PhraseFn<[string]>,
  allFreeAccess: { ru: "Все даты открыты без оплаты", en: "Every date is open without payment" } satisfies Phrase,
  notPaid: { ru: "не оплачен", en: "not paid" } satisfies Phrase,
  twoFreeSections: {
    ru: " · два раздела открыты бесплатно",
    en: " · two sections are open for free",
  } satisfies Phrase,
  matricesWord: { ru: "Матрицы", en: "Matrices" } satisfies Phrase,
  storageUnlimited: {
    ru: (used: number) => `${used} · хранение без ограничений`,
    en: (used: number) => `${used} · unlimited storage`,
  } satisfies PhraseFn<[number]>,
  storageOver: {
    ru: (used: number, limit: number) => `${used} сохранено, слотов ${limit} — новую дату добавить `
      + "нельзя, пока не купите ещё один разбор; сохранённое никуда не делось",
    en: (used: number, limit: number) => `${used} saved, ${limit} slots — a new date cannot be `
      + "added until you buy another reading; what is saved stays where it is",
  } satisfies PhraseFn<[number, number]>,
  storageOf: {
    ru: (used: number, limit: number) => `${used} из ${limit} · слот даёт каждый открытый разбор`,
    en: (used: number, limit: number) => `${used} of ${limit} · every opened reading gives a slot`,
  } satisfies PhraseFn<[number, number]>,
  reportLoading: { ru: "Мой разбор загружается…", en: "Your reading is loading…" } satisfies Phrase,
  buyFullReading: { ru: "Купить полный разбор", en: "Buy the full reading" } satisfies Phrase,
  admin: { ru: "Админка", en: "Admin" } satisfies Phrase,
  accessLivesInAccount: {
    ru: "Доступ живёт в аккаунте, поэтому разбор открывается с любого устройства.",
    en: "Access lives in the account, so the reading opens from any device.",
  } satisfies Phrase,
  savedMatrices: { ru: "Сохранённые матрицы", en: "Saved matrices" } satisfies Phrase,
  savedMatricesHint: {
    ru: "Дата рождения уходит на сервер по вашему действию: этой кнопкой или при оплате разбора",
    en: "The date of birth goes to the server only when you act: with this button or when paying",
  } satisfies Phrase,
  savedMatricesHintFree: {
    ru: "Дата рождения уходит на сервер по вашему действию — этой кнопкой",
    en: "The date of birth goes to the server only when you act: with this button",
  } satisfies Phrase,
  listFailed: {
    ru: (error: string) => `Список не загрузился: ${error}`,
    en: (error: string) => `The list did not load: ${error}`,
  } satisfies PhraseFn<[string]>,
  listLoading: { ru: "Загружаем список…", en: "Loading the list…" } satisfies Phrase,
  listEmpty: { ru: "Пока ничего не сохранено.", en: "Nothing is saved yet." } satisfies Phrase,
  chartWord: { ru: "карта", en: "chart" } satisfies Phrase,
  centreArcanum: { ru: "аркан центра", en: "centre arcanum" } satisfies Phrase,
  twoSections: { ru: "Два раздела", en: "Two sections" } satisfies Phrase,
  open: { ru: "Открыть", en: "Open" } satisfies Phrase,
  openFor: {
    ru: (price: string) => `Открыть — ${price}`,
    en: (price: string) => `Open — ${price}`,
  } satisfies PhraseFn<[string]>,
  localCalc: {
    ru: (date: string) => `В браузере открыт расчёт на ${date} — можно сохранить его в кабинет.`,
    en: (date: string) => `A calculation for ${date} is open in this browser — you can save it to your account.`,
  } satisfies PhraseFn<[string]>,
  saveCurrent: { ru: "Сохранить текущую матрицу", en: "Save the current matrix" } satisfies Phrase,
  calculateToSave: { ru: "Рассчитайте матрицу", en: "Calculate a matrix" } satisfies Phrase,
  calculateToSaveTail: { ru: ", чтобы сохранить её здесь.", en: " to save it here." } satisfies Phrase,
  paymentsUnavailable: { ru: "Платежи недоступны.", en: "Payments are unavailable." } satisfies Phrase,
  myPayments: { ru: "Мои платежи", en: "My payments" } satisfies Phrase,
  paymentsHint: {
    ru: "Цена в строке — та, что была на момент покупки",
    en: "The price in each row is the one at the time of purchase",
  } satisfies Phrase,
  paymentsLoading: { ru: "Загружаем платежи…", en: "Loading payments…" } satisfies Phrase,
  paymentsEmpty: { ru: "Платежей пока нет.", en: "No payments yet." } satisfies Phrase,
  planWord: { ru: "Тариф", en: "Plan" } satisfies Phrase,
  stateRefunded: { ru: "возвращён", en: "refunded" } satisfies Phrase,
  statePaid: { ru: "оплачен", en: "paid" } satisfies Phrase,
  stateAbandoned: { ru: "брошен", en: "abandoned" } satisfies Phrase,
  stateFailed: { ru: "не прошёл", en: "failed" } satisfies Phrase,
  stateUnpaid: { ru: "не оплачен", en: "unpaid" } satisfies Phrase,
};
