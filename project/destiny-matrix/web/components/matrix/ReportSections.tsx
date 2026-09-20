// Разметка разделов. Без "use client" и без своих данных намеренно: этот же компонент
// печатает серверная страница /report для оплатившего (тексты платных разделов приходят
// пропсами и в браузерный чанк не попадают) и клиентский разбор в браузере, где платных
// разделов нет вовсе.
import { ALL_FREE } from "@/lib/access";
import Link from "next/link";

import { arcanumTitle } from "@/lib/arcana";
import { D, L } from "@/lib/i18n";

import type { SectionOut } from "@/lib/publicSpec";
import { publicHref } from "@/lib/site";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import CharacterConclusionView from "@/components/matrix/CharacterConclusionView";
import CharacterReadingView from "@/components/matrix/CharacterReadingView";
import CharacterRoleParts from "@/components/matrix/CharacterRoleParts";
import Sections from "@/components/enc/Sections";
import Faq from "@/components/ui/Faq";
import SectionEncyclopediaLinks from "@/components/matrix/SectionEncyclopediaLinks";
import LockIcon from "@/components/ui/LockIcon";
import UnlockCta from "@/components/pay/UnlockCta";

/**
 * Число колонок для позиций раздела. CSS считать элементы не умеет, а auto-fit ставит по три
 * в ряд: четвёртая карта оставалась одна в пустой строке. Четыре кладём 2×2 — как в разделах
 * из двух позиций; десять — по четыре, иначе последний ряд снова с одной картой.
 * undefined — раскладку выбирает auto-fit по ширине панели.
 */
function gridColumns(n: number): 2 | 4 | undefined {
  if (n === 4) return 2;
  if (n % 3 === 1) return 4;
  return undefined;
}

/** Подпись итога зависит от числа ролей: «тройка» стояла и над парой, и над четырьмя ролями. */
function conclusionLabel(roles: number | undefined): string {
  if (roles === 2) return D.report.pairSummary[L];
  if (roles && roles > 3) return D.report.rolesSummary[L];
  return D.report.tripleSummary[L];
}

export default function ReportSections({
  sections,
  checking = false,
  place = "report",
  matrixId,
  printing = false,
}: {
  sections: SectionOut[];
  /** сервер ещё не ответил про доступ: замок показываем, но продавать нечего */
  checking?: boolean;
  place?: string;
  matrixId?: number | null;
  /** печать в PDF: разделы раскрыты, кнопок покупки нет */
  printing?: boolean;
}) {
  const open = sections.filter((s) => s.positions.length > 0).length;
  const locked = sections.length - open;

  return (
    <div className="section-gap" data-testid="report">
      <div className="rhead">
        <h2>{D.report.readingTitle[L]}</h2>
        {/* Счётчик «столько открыто, столько под замком» нужен только там, где замок можно снять
            деньгами. На витрине без кассы он считал бы то, что откроется само через секунду. */}
        {locked > 0 && !ALL_FREE ? (
          <div className="cnt">
            {D.report.openSections[L](open)} · {D.report.lockedCount[L](locked)}
          </div>
        ) : null}
      </div>

      {sections.map((s, i) => {
        return s.positions.length ? (
          <details
            className="acc"
            key={s.key}
            open={printing || i === 0}
            data-testid={`section-${s.key}`}
            data-locked="false"
          >
            <summary>
              <span className="ic">▸</span>
              {s.title}
            </summary>
            <div className="body">
              <p className="lead">{s.lead}</p>
              <ul className="poslist" data-cols={gridColumns(s.positions.length)}>
                {s.positions.map((p, j) => {
                  const readingRole = p.role ?? (s.longform?.layout ? undefined : s.longform?.roles[j]);
                  return (
                    <li
                      key={`${p.label}-${j}`}
                      data-position={p.label}
                      data-arcanum={p.arcanum}
                    >
                      <a className="poscard" href={printing ? publicHref(p.href) : p.href}>
                        <span className="who">{p.label}</span>
                        <ArcanumCard n={p.arcanum} size="grid" decorative half={printing} />
                        <span className="lb">
                          <span className="nm">
                            <span className="rn">{p.arcanum}</span> {arcanumTitle(p.arcanum)}
                          </span>
                        </span>
                      </a>
                      {readingRole ? (
                        <CharacterRoleParts role={readingRole} />
                      ) : p.text && !s.fullArticle ? (
                        <p className="postext">{p.text}</p>
                      ) : null}
                      {/* Соседом карточки, а не внутри: карточка целиком обёрнута в ссылку на
                          аркан, и вложить в неё вторую нельзя. Оформление — тот же `encref`,
                          что у ссылок раздела. */}
                      {p.article ? (
                        <p className="encref">
                          <Link
                            href={printing ? publicHref(p.article.href) : p.article.href}
                            data-entity-type="position_arcanum"
                            data-entity-key={p.article.href.slice("/encyclopedia/position/".length)}
                          >
                            {p.article.label} →
                          </Link>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {s.fullArticle ? (
                <article className="section-gap" data-testid="past-lives-full-article">
                  <p className="dim prose">{s.fullArticle.short}</p>
                  <Sections items={s.fullArticle.sections} />
                  <Faq items={s.fullArticle.faq} />
                </article>
              ) : printing && s.longform ? (
                <CharacterReadingView reading={s.longform} printing showRoles={false} />
              ) : s.conclusion || s.longform ? (
                <CharacterConclusionView
                  reading={s.conclusion ?? s.longform!}
                  label={conclusionLabel(s.longform?.roles.length)}
                  idPrefix={`${s.key}-reading`}
                />
              ) : null}
              <SectionEncyclopediaLinks section={s} printing={printing} />
            </div>
          </details>
        ) : (
          <div className="acc lock" key={s.key} data-testid={`section-${s.key}`} data-locked="true">
            {checking || printing || ALL_FREE ? (
              <span className="head">
                {s.title}
                <span className="unlock">
                  <LockIcon />{" "}
                  {printing
                    ? D.report.notOpened[L]
                    : checking
                      ? D.report.checkingAccess[L]
                      : D.report.notLoaded[L]}
                </span>
              </span>
            ) : (
              <UnlockCta className="head" place={place} section={s.key} matrixId={matrixId}>
                {s.title}
                <span className="unlock">
                  <LockIcon /> {D.report.unlock[L]}
                </span>
              </UnlockCta>
            )}
          </div>
        );
      })}
    </div>
  );
}
