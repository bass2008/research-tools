import type { LegalDocs } from "./types";

// Бот не может написать первым (docs/support-bot.md): пока человек не нажал «Старт», отправить
// ему нечего — поэтому с сайта ведёт ссылка на бота, а не форма сбора контактов.
export const SUPPORT: LegalDocs = {
  ru: {
    h1: "Поддержка",
    blocks: [
      {
        p: ["Вопрос можно задать боту в Telegram или письмом на почту. Ответ приходит туда же, "
          + "откуда пришёл вопрос."],
      },
      { h2: "Telegram — быстрее" },
      {
        p: ["Бот ", { bot: true }, ": нажмите «Старт» и напишите обычным сообщением. Оно попадёт "
          + "к нам сразу, ответ придёт в тот же чат — обычно в течение рабочего дня."],
      },
      { h2: "Почта" },
      {
        p: [{ mail: true }, " — если мессенджер неудобен или к обращению нужно приложить файл. "
          + "Сюда же отправляются претензии: срок рассмотрения — до 10 рабочих дней."],
      },
      { h2: "С чем помогаем" },
      {
        ul: [
          ["что-то не работает: страница не грузится, PDF не скачивается, не открывается "
            + "сохранённая матрица", { paid: [", оплата не прошла"] }, ";"],
          ["проблема с аккаунтом: не приходит письмо, забыт пароль, разбор открылся на одном "
            + "устройстве и не открывается на другом;"],
          ["ошибка на сайте: неверное число, битая ссылка, текст противоречит сам себе."],
        ],
      },
      {
        p: ["Реквизиты и документы — на странице ",
          { link: "/contacts", text: "Контакты и реквизиты" }, "."],
      },
    ],
  },
  en: {
    h1: "Support",
    blocks: [
      {
        p: ["There are two ways to reach us: the Telegram bot or email. The answer comes back the "
          + "same way the question arrived."],
      },
      { h2: "Telegram — the quicker way" },
      {
        p: ["The bot is ", { bot: true }, ". Press Start and write your question as an ordinary "
          + "message: it reaches us straight away, and the reply arrives in the same chat, "
          + "usually within one business day."],
      },
      { h2: "Email" },
      {
        p: [{ mail: true }, " — for when a messenger is awkward or something has to be attached. "
          + "Complaints go to the same address and are handled within 10 business days."],
      },
      { h2: "What we can help with" },
      {
        ul: [
          ["something is broken: a page does not load, the PDF does not download, a saved chart "
            + "does not open", { paid: [", a payment did not go through"] }, ";"],
          ["a problem with your account: the email does not arrive, the password is lost, the "
            + "reading opened on one device and not on another;"],
          ["a mistake on the site: a wrong number, a broken link, text that contradicts itself."],
        ],
      },
      {
        p: ["Our legal details and documents are on the ",
          { link: "/contacts", text: "Contacts and legal details" }, " page."],
      },
    ],
  },
};
