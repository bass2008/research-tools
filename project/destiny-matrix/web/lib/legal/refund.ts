import type { LegalDocs } from "./types";

export const REFUND: LegalDocs = {
  ru: {
    h1: "Условия возврата",
    lead: [
      "Редакция от ",
      { legal: "updated" },
      ". Документ дополняет ",
      { link: "/terms", text: "публичную оферту" },
      ".",
    ],
    blocks: [
      // Правила нужны и при выключенной кассе: вернуть деньги можно по платежу, который прошёл
      // раньше, — сайт мог стать бесплатным уже после оплат.
      {
        only: "free",
        p: ["Сейчас оплата на сайте не принимается: разбор открыт целиком и бесплатно. Правила "
          + "ниже действуют для платежей, которые прошли раньше, — по ним деньги возвращаются на "
          + "тех же условиях."],
      },
      { h2: "1. Право на отказ" },
      {
        p: ["Вы вправе отказаться от работ в любой момент до того, как они выполнены, — статья 32 "
          + "Закона РФ от 07.02.1992 № 2300-1 «О защите прав потребителей». Работы считаются "
          + "выполненными с момента передачи результата — когда разбор открылся в вашем аккаунте; "
          + "обычно это несколько секунд после оплаты (см. ",
          { link: "/terms", text: "оферту" },
          ", раздел 6)."],
      },
      { h2: "2. Когда возвращаем полностью" },
      {
        ul: [
          ["разбор не открылся из-за технической ошибки на нашей стороне;"],
          ["оплата прошла дважды за одну и ту же дату;"],
          ["вы оплатили и не открывали ни один платный раздел разбора, и с момента оплаты прошло "
            + "не более 7 дней;"],
          ["состав разбора не соответствует описанию на сайте."],
        ],
      },
      {
        only: "paid",
        p: ["В этих случаях возвращается вся сумма платежа — например, ", { price: true },
          " за разбор одной даты, без объяснения причин с вашей стороны."],
      },
      {
        only: "free",
        p: ["В этих случаях возвращается вся сумма платежа, без объяснения причин с вашей стороны."],
      },
      { h2: "3. Когда возврат частичный" },
      {
        p: ["Для объёмов работ со сроком действия при отказе после начала пользования возвращается "
          + "стоимость неиспользованного периода за вычетом фактически понесённых расходов: "
          + "открытые за это время разборы считаются по цене разбора одной даты, остаток "
          + "возвращается пропорционально оставшимся дням."],
      },
      { h2: "4. Когда возврат не производится" },
      {
        ul: [
          ["весь оплаченный разбор открыт и просмотрен, а претензий к соответствию описанию нет;"],
          ["разбор передан третьим лицам или опубликован в нарушение оферты;"],
          ["оплата произведена с чужой карты без согласия её владельца (разбирается отдельно, с "
            + "банком)."],
        ],
      },
      {
        p: ["Несогласие с содержанием текстовых блоков не является недостатком работ: материалы "
          + "носят информационно-развлекательный характер и не обещают наступления событий."],
      },
      { h2: "5. Как запросить возврат" },
      {
        p: ["Напишите на ", { legal: "email" }, " с почты, указанной при оплате, и укажите: дату и "
          + "сумму платежа, номер платежа (он показан на странице после оплаты и есть в чеке), "
          + "причину отказа и реквизиты для возврата, если платёж был не картой."],
      },
      {
        p: ["Мы отвечаем в течение 3 рабочих дней и переводим деньги в течение 10 календарных дней "
          + "с момента получения заявления — срок по статье 22 Закона «О защите прав "
          + "потребителей». Возврат идёт тем же способом, которым была оплата: на карту деньги "
          + "приходят за 3–10 рабочих дней, срок зависит от банка-эмитента."],
      },
      { h2: "6. Если что-то пошло не так" },
      {
        p: ["Сначала напишите нам: большая часть обращений закрывается в тот же день. Если ответ "
          + "вас не устроил, вы вправе обратиться в Роспотребнадзор или в суд по месту жительства."],
      },
      {
        p: ["Реквизиты для претензий: ", { legal: "entity" }, ", ИНН ", { legal: "inn" },
          ", ОГРНИП ", { legal: "ogrnip" }, ". Почта: ", { legal: "email" }, "."],
      },
    ],
  },
  en: {
    h1: "Refund policy",
    lead: ["Edition of ", { legal: "updated" }, ". This website is run by ", { legal: "entity" }, "."],
    blocks: [
      {
        only: "free",
        p: ["No payment is being taken at the moment: the whole reading is open for free. The "
          + "rules below apply to payments made earlier — the money is returned on the same terms."],
      },
      { h2: "1. The right to cancel" },
      {
        p: ["A reading is a digital product delivered immediately. You may still ask for a refund "
          + "in the cases listed below; write to ", { mail: true },
          " from the address used for the payment."],
      },
      { h2: "2. When the full amount is returned" },
      {
        ul: [
          ["the reading did not open because of a technical fault on our side;"],
          ["the same date was charged twice;"],
          ["you paid and opened none of the paid sections, and no more than 7 days have passed;"],
          ["the content of the reading does not match what the website describes."],
        ],
      },
      { p: ["In these cases the whole amount is returned, with no need to explain the reason."] },
      { h2: "3. When a refund is partial" },
      {
        p: ["For a plan with a period, the part already used is deducted: the refund covers the "
          + "remaining days of access."],
      },
      { h2: "4. When a refund is not made" },
      {
        ul: [
          ["the paid sections were opened and more than 7 days have passed since the payment;"],
          ["the reason is disagreement with the interpretation: the method is esoteric, and the "
            + "texts are not advice or a forecast;"],
          ["the request comes from an address other than the one used for the purchase and the "
            + "ownership of the account cannot be confirmed."],
        ],
      },
      { h2: "5. How to ask for a refund" },
      {
        p: ["Send an email to ", { mail: true }, " with the payment number from the receipt. There "
          + "is no need to include a date of birth. We answer within 10 business days and return "
          + "the money the same way it was paid, usually within 14 days."],
      },
      { h2: "6. If something went wrong" },
      {
        p: ["Write to us before asking the bank for a chargeback: most problems are solved faster "
          + "directly. The full conditions are in the ", { link: "/terms", text: "terms of service" },
          ", and support is reached through the ", { link: "/support", text: "support page" }, "."],
      },
    ],
  },
};
