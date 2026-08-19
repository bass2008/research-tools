import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL, pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Контакты и реквизиты",
  description:
    "Как связаться с исполнителем: почта для обращений, реквизиты индивидуального предпринимателя, " +
    "сроки ответа и ссылки на оферту, политику обработки данных и условия возврата.",
  path: "/contacts",
});

// Реквизиты собраны здесь, а не в подвале каждой страницы: их читают дважды — при проверке
// исполнителя и при обращении. В юридических страницах они остаются: там это обязательная часть.
export default function ContactsPage() {
  return (
    <main className="page">
      <div className="wrap prose">
        <p className="crumbs">
          <Link href="/">Главная</Link> <span>/</span> <span>Контакты</span>
        </p>
        <h1>Контакты и реквизиты</h1>

        <h2>Связаться</h2>
        <p>
          Почта для любых обращений — от вопроса по разбору до возврата платежа:{" "}
          <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Отвечаем в течение рабочего дня,
          претензии рассматриваем в срок до 10 дней с момента получения.
        </p>
        <p>
          Если вопрос про оплату, приложите номер платежа — он показан на странице после оплаты и
          приходит в чеке. Дату рождения в письме указывать не нужно.
        </p>

        <h2>Исполнитель</h2>
        <dl className="kv">
          <dt>Наименование</dt>
          <dd>{LEGAL.entity}</dd>
          <dt>ИНН</dt>
          <dd>{LEGAL.inn}</dd>
          <dt>ОГРНИП</dt>
          <dd>{LEGAL.ogrnip}</dd>
          <dt>Сайт</dt>
          <dd>{LEGAL.site}</dd>
          <dt>Почта</dt>
          <dd>
            <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
          </dd>
        </dl>

        <h2>Документы</h2>
        <p>
          <Link href="/oferta">Публичная оферта</Link> — что именно покупается и на каких условиях.{" "}
          <Link href="/privacy">Политика обработки персональных данных</Link> — что мы храним и
          зачем. <Link href="/refund">Условия возврата</Link> — как отказаться и получить деньги.
        </p>
      </div>
    </main>
  );
}
