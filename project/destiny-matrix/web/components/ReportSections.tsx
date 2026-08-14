// Разметка разделов. Без "use client" и без своих данных намеренно: этот же компонент
// печатает серверная страница /report для оплатившего (тексты платных разделов приходят
// пропсами и в браузерный чанк не попадают) и клиентский разбор в браузере, где платных
// разделов нет вовсе.
import Link from "next/link";

import { arcanumTitle } from "@/lib/arcana";

import type { SectionOut } from "./publicSpec";
import { positionHref } from "./publicSpec";
import ArcanumCard from "./ArcanumCard";
import LockIcon from "./LockIcon";
import UnlockCta from "./UnlockCta";

export default function ReportSections({
  sections,
  checking = false,
  place = "report",
}: {
  sections: SectionOut[];
  /** сервер ещё не ответил про доступ: замок показываем, но продавать нечего */
  checking?: boolean;
  place?: string;
}) {
  const open = sections.filter((s) => s.positions.length > 0).length;
  const locked = sections.length - open;

  return (
    <div className="section-gap" data-testid="report">
      <div className="rhead">
        <h2>Расшифровка вашей матрицы</h2>
        <div className="cnt">
          <b>{open}</b> {open === 1 ? "раздел открыт" : "разделов открыто"} · <b>{locked}</b> под замком
        </div>
      </div>

      {sections.map((s, i) =>
        s.positions.length ? (
          <details
            className="acc"
            key={s.key}
            open={i === 0}
            data-testid={`section-${s.key}`}
            data-locked="false"
          >
            <summary>
              <span className="ic">▸</span>
              {s.title}
            </summary>
            <div className="body">
              <p className="lead">{s.lead}</p>
              <ul className="poslist">
                {s.positions.map((p, j) => (
                  <li key={`${p.label}-${j}`}>
                    <a className="poscard" href={p.href}>
                      <span className="who">{p.label}</span>
                      <ArcanumCard n={p.arcanum} size="grid" decorative />
                      <span className="lb">
                        <span className="nm">
                          <span className="rn">{p.arcanum}</span> {arcanumTitle(p.arcanum)}
                        </span>
                      </span>
                    </a>
                    {p.text ? <p className="postext">{p.text}</p> : null}
                  </li>
                ))}
              </ul>
              <p className="encref">
                <Link href={positionHref(s.key)}>
                  Подробнее про раздел «{s.title}» в энциклопедии →
                </Link>
              </p>
            </div>
          </details>
        ) : (
          <div className="acc lock" key={s.key} data-testid={`section-${s.key}`} data-locked="true">
            {checking ? (
              <span className="head">
                {s.title}
                <span className="unlock">
                  <LockIcon /> Проверяем доступ…
                </span>
              </span>
            ) : (
              <UnlockCta className="head" place={place} section={s.key}>
                {s.title}
                <span className="unlock">
                  <LockIcon /> Открыть
                </span>
              </UnlockCta>
            )}
          </div>
        ),
      )}
    </div>
  );
}
