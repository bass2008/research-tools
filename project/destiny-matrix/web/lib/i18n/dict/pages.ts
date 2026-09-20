// Витрина без кассы — такое же свойство развёртки, как язык: текст выбирается на сборке.

import type { Phrase, PhraseFn } from "./index";

export const pages = {
  loginTitle: { ru: "Вход в кабинет", en: "Sign in" } satisfies Phrase,
  loginDescription: {
    ru: "Вход в личный кабинет: сохранённые матрицы и доступ к разделам разбора.",
    en: "Sign in to your account: saved matrices and access to the sections of the reading.",
  } satisfies Phrase,
  registerTitle: { ru: "Регистрация", en: "Sign up" } satisfies Phrase,
  registerDescription: {
    ru: "Создание аккаунта: хранение сохранённых матриц и доступ к платным разделам.",
    en: "Create an account: keep your saved matrices and open them from any device.",
  } satisfies Phrase,
  forgotTitle: { ru: "Восстановление пароля", en: "Password reset" } satisfies Phrase,
  forgotDescription: {
    ru: "Пришлём ссылку для смены пароля на почту, указанную при оплате.",
    en: "We will send a password link to the address of your account.",
  } satisfies Phrase,
  resetTitle: { ru: "Новый пароль", en: "New password" } satisfies Phrase,
  resetDescription: {
    ru: "Смена пароля по ссылке из письма.",
    en: "Changing the password with the link from the email.",
  } satisfies Phrase,
  accountTitle: { ru: "Личный кабинет", en: "Your account" } satisfies Phrase,
  accountDescription: {
    ru: "Сохранённые матрицы, тариф и доступ к разделам разбора.",
    en: "Saved matrices, access to your reading and the history of your account.",
  } satisfies Phrase,
  reportTitle: { ru: "Мой разбор матрицы судьбы", en: "My destiny matrix reading" } satisfies Phrase,
  reportDescription: {
    ru: "Личный отчёт по матрице судьбы: октаграмма, позиции карты и часть разделов бесплатно, "
      + "остальные — в полном разборе.",
    en: "A personal destiny matrix reading: the octagram, the positions of the chart and the "
      + "sections of the reading.",
  } satisfies Phrase,
  reportOffline: {
    ru: "Сервер не подтвердил доступ, поэтому платные разделы закрыты. Обновите страницу — доступ "
      + "проверяется заново.",
    en: "The server did not answer, so your account is not confirmed and saved matrices are not "
      + "shown. Refresh the page — usually it is a momentary glitch.",
  } satisfies Phrase,
  savedMatrixTitle: { ru: "Сохранённая матрица", en: "Saved matrix" } satisfies Phrase,
  savedMatrixDescription: {
    ru: "Разбор сохранённой матрицы: октаграмма, позиции карты и разделы вашего тарифа.",
    en: "The reading of a saved matrix: the octagram, the positions of the chart and the "
      + "sections of the reading.",
  } satisfies Phrase,
  savedMatrixOffline: {
    ru: "Сервер не ответил, поэтому доступ не подтверждён. Обновите страницу.",
    en: "The server did not answer, so access is not confirmed. Refresh the page.",
  } satisfies Phrase,
  savedMatrixOwnerOnly: {
    ru: "Сохранённые матрицы открываются только владельцу аккаунта: дата рождения не отдаётся "
      + "никому, кроме него.",
    en: "Saved matrices open only for the owner of the account: the date of birth is given to "
      + "nobody else.",
  } satisfies Phrase,
  calcWithoutSignup: {
    ru: "Считать матрицу без регистрации можно и так —",
    en: "A matrix can also be calculated without signing up —",
  } satisfies Phrase,
  calcInBrowser: { ru: "расчёт в браузере", en: "the calculation runs in the browser" } satisfies Phrase,
  printTitle: {
    ru: (date: string) => `Матрица судьбы — ${date}`,
    en: (date: string) => `Destiny matrix — ${date}`,
  } satisfies PhraseFn<[string]>,
  printFallbackTitle: { ru: "Разбор для печати", en: "Reading for printing" } satisfies Phrase,
  printDescription: {
    ru: "Полный разбор матрицы судьбы по дате рождения.",
    en: "The full destiny matrix reading by date of birth.",
  } satisfies Phrase,
  contactsTitle: { ru: "Контакты и реквизиты", en: "Contacts and legal details" } satisfies Phrase,
  contactsDescription: {
    ru: "Как связаться с исполнителем: почта для обращений, реквизиты предпринимателя, сроки "
      + "ответа и ссылки на оферту и возврат.",
    en: "How to reach us: the email for enquiries, the legal details, response times and links "
      + "to the terms and the refund policy.",
  } satisfies Phrase,
  contactsCrumb: { ru: "Контакты", en: "Contacts" } satisfies Phrase,
  contactsReach: { ru: "Связаться", en: "Get in touch" } satisfies Phrase,
  contactsMailLead: {
    ru: "Почта для любых обращений — от вопроса по разбору до возврата платежа:",
    // Возврат платежа упоминается только там, где есть что возвращать.
    en: "The address for any question about the reading, your account or your data:",
  } satisfies Phrase,
  contactsMailTail: {
    ru: ". Отвечаем в течение рабочего дня, претензии рассматриваем в срок до 10 рабочих дней с "
      + "момента получения.",
    en: ". We answer within one business day and handle complaints within 10 business days of "
      + "receiving them.",
  } satisfies Phrase,
  contactsSupportLead: {
    ru: "Есть и Telegram: бот принимает вопрос и возвращает ответ в тот же чат — обычно это "
      + "быстрее почты. Адрес бота и что писать —",
    en: "There is also Telegram: the bot takes your question and brings the answer back to the "
      + "same chat, usually faster than email. The address of the bot and what to write are",
  } satisfies Phrase,
  contactsSupportLink: {
    ru: "на странице поддержки",
    en: "on the support page",
  } satisfies Phrase,
  contactsSupportTail: { ru: ".", en: "." } satisfies Phrase,
  contactsPaymentNote: {
    ru: "Если вопрос про оплату, приложите номер платежа — он показан на странице после оплаты и "
      + "приходит в чеке. Дату рождения в письме указывать не нужно.",
    en: "For a payment question, include the payment number — it is shown on the page after "
      + "payment and comes in the receipt. There is no need to put a date of birth in the email.",
  } satisfies Phrase,
  // «Продавец» там, где ничего не продаётся, обещает сделку: на витрине без кассы страница
  // отвечает на вопрос «кто держит сайт», а не «у кого я покупаю».
  contactsSeller: { ru: "Исполнитель", en: "Who runs this website" } satisfies Phrase,
  contactsName: { ru: "Наименование", en: "Name" } satisfies Phrase,
  contactsTaxId: { ru: "ИНН", en: "Tax ID" } satisfies Phrase,
  contactsRegistration: { ru: "ОГРНИП", en: "Registration number" } satisfies Phrase,
  contactsActivity: { ru: "Вид деятельности", en: "Activity" } satisfies Phrase,
  contactsActivityText: {
    ru: "Разработка компьютерного программного обеспечения, включая адаптацию и модификацию "
      + "web-страниц (пп. 62 п. 2 ст. 346.43 НК РФ). Патентная система налогообложения, НДС не "
      + "облагается.",
    en: "Development of computer software, including the adaptation and modification of web "
      + "pages.",
  } satisfies Phrase,
  contactsSite: { ru: "Сайт", en: "Website" } satisfies Phrase,
  contactsEmail: { ru: "Почта", en: "Email" } satisfies Phrase,
  contactsPhone: { ru: "Телефон", en: "Phone" } satisfies Phrase,
  contactsDocuments: { ru: "Документы", en: "Documents" } satisfies Phrase,
  contactsTermsNote: {
    ru: "— что именно покупается и на каких условиях.",
    en: "— what the service is and the rules for using it.",
  } satisfies Phrase,
  contactsPrivacyNote: {
    ru: "— что мы храним и зачем.",
    en: "— what we keep and why.",
  } satisfies Phrase,
  contactsRefundNote: {
    ru: "— как отказаться и получить деньги.",
    en: "— how to cancel and get your money back.",
  } satisfies Phrase,
  termsTitle: { ru: "Публичная оферта", en: "Terms of service" } satisfies Phrase,
  termsDescription: {
    ru: (prices: string) => `Условия выполнения работ: объём работ, цены ${prices}, порядок `
      + "оплаты, передача результата, ответственность сторон и возврат.",
    en: () => "What the service is, what a plan includes, how payment and delivery work, "
      + "liability and refunds.",
  } satisfies PhraseFn<[string]>,
  termsPricesUnknown: {
    ru: "по действующему прайсу",
    en: "as shown on the payment page",
  } satisfies Phrase,
  termsDescriptionFree: {
    ru: "Что это за сервис, как устроен личный кабинет, какого характера тексты разбора и в чём "
      + "пределы нашей ответственности.",
    en: "What the service is, what it costs, how your account works, the nature of the readings "
      + "and the limits of our liability.",
  } satisfies Phrase,
  privacyTitle: {
    ru: "Политика обработки персональных данных",
    en: "Privacy policy",
  } satisfies Phrase,
  privacyDescription: {
    ru: "Какие данные собирает сервис расчёта матрицы судьбы, зачем, на каком основании, "
      + "сколько хранит и как отозвать согласие.",
    en: "Which data the destiny matrix service collects, why, on which basis, how long it is "
      + "kept and how to withdraw consent.",
  } satisfies Phrase,
  refundTitle: { ru: "Условия возврата", en: "Refund policy" } satisfies Phrase,
  refundDescription: {
    ru: "Когда возвращаем оплату полностью, когда частично, как отправить заявление и в какой "
      + "срок приходят деньги.",
    en: "When the money is returned in full, when in part and when not at all, and how to ask "
      + "for a refund.",
  } satisfies Phrase,
  supportTitle: { ru: "Поддержка", en: "Support" } satisfies Phrase,
  supportDescription: {
    ru: "Как связаться с поддержкой Arcana Sense: бот в Telegram и почта. Отвечаем на вопросы "
      + "по разбору, на проблемы с аккаунтом и на всё, что не работает.",
    en: "How to reach Arcana Sense support: the Telegram bot or email. We answer questions "
      + "about the reading, account problems and anything that does not work.",
  } satisfies Phrase,
};
