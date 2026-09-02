import Link from "next/link";

import { arcanumTitle } from "@/lib/arcana";
import type { LongformReading } from "@/lib/readingTypes";
import { arcanumHref } from "@/lib/publicSpec";
import { publicHref } from "@/lib/site";

import ArcanumCard from "./ArcanumCard";
import CharacterConclusionView from "./CharacterConclusionView";
import CharacterRoleParts from "./CharacterRoleParts";

export default function CharacterReadingView({
  reading,
  printing = false,
  showRoles = true,
}: {
  reading: LongformReading;
  printing?: boolean;
  showRoles?: boolean;
}) {
  const href = (path: string) => (printing ? publicHref(path) : path);
  const rolesTitleId = `${reading.testId}-roles-title`;
  const interactionsTitleId = `${reading.testId}-interactions-title`;

  return (
    <article className="character-reading" data-testid={reading.testId}>
      <div className="character-summary panel">
        <p className="cap">{reading.caption ?? `Как складывается сочетание ${reading.slug}`}</p>
        <p>{reading.summary}</p>
      </div>

      {reading.layout === "chakras" && reading.chakraRows ? (
        <section className="section-gap" aria-labelledby={rolesTitleId}>
          <h2 id={rolesTitleId}>{reading.rolesTitle}</h2>
          <p className="dim prose">{reading.rolesLead}</p>
          <div className="tabscroll">
            <table className="chak personal-chakras">
              <thead>
                <tr>
                  <th>Уровень</th>
                  <th>Физика</th>
                  <th>Энергия</th>
                  <th>Эмоции</th>
                </tr>
              </thead>
              <tbody>
                {reading.chakraRows.map((row) => (
                  <tr key={row.key} data-chakra={row.key}>
                    <th scope="row">
                      <Link href={href(`/encyclopedia/chakra/${row.key}`)}>{row.title}</Link>
                      <span className="small">{row.hint}</span>
                      <span className="small">{row.level}</span>
                    </th>
                    {row.cells.map((cell) => (
                      <td key={cell.column} data-column={cell.column}>
                        <Link href={href(arcanumHref(cell.arcanum))}>
                          <strong>{cell.arcanum} · {arcanumTitle(cell.arcanum)}</strong>
                        </Link>
                        <p>{cell.context}</p>
                        <p>{cell.modifier}</p>
                        <p>{cell.action}</p>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : reading.layout === "years" && reading.agePeriods ? (
        <section className="section-gap" aria-labelledby={rolesTitleId}>
          <h2 id={rolesTitleId}>{reading.rolesTitle}</h2>
          <p className="dim prose">{reading.rolesLead}</p>
          <div className="character-roles age-reading">
            {reading.agePeriods.map((period) => (
              <div
                className="character-role panel"
                key={period.from}
                data-period={`${period.from}-${period.to}`}
                data-current={period.current || undefined}
                data-next={period.next || undefined}
              >
                <p className="cap">
                  {period.from}–{period.to} лет
                  {period.current ? " · текущий этап" : period.next ? " · следующий этап" : ""}
                </p>
                <h3>
                  <Link href={href(arcanumHref(period.arcanum))}>
                    {period.arcanum} · {period.title}
                  </Link>
                </h3>
                <CharacterRoleParts role={period} />
              </div>
            ))}
          </div>
        </section>
      ) : showRoles ? (
        <section className="section-gap" aria-labelledby={rolesTitleId}>
          <h2 id={rolesTitleId}>{reading.rolesTitle}</h2>
          <p className="dim prose">{reading.rolesLead}</p>
          <div className="character-roles">
            {reading.roles.map((role) => (
              <div className="character-role panel" key={role.key} data-role={role.key}>
                <Link className="poscard" href={href(arcanumHref(role.arcanum))}>
                  <span className="who">
                    {role.key} · {role.label}
                  </span>
                  <ArcanumCard n={role.arcanum} size="grid" decorative half={printing} />
                  <span className="lb">
                    <span className="nm">
                      <span className="rn">{role.arcanum}</span> {role.title}
                    </span>
                  </span>
                </Link>
                <p className="character-question">{role.question}</p>
                {role.sameAs ? (
                  <p className="character-role-parts dim">
                    Тот же аркан, что и в роли «{role.sameAs.label}»: разбор выше. Обе позиции
                    формулы дали одно число, поэтому второй раз тот же текст не повторяется.
                  </p>
                ) : (
                  <CharacterRoleParts role={role} />
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="character-interactions section-gap" aria-labelledby={interactionsTitleId}>
        <h2 id={interactionsTitleId}>{reading.interactionsTitle}</h2>
        <p className="dim prose">{reading.interactionsLead}</p>
        {reading.interactions.map((interaction) => (
          <div className="panel" key={interaction.key} data-interaction={interaction.key}>
            {interaction.caption ? (
              <p className="cap">{interaction.caption}</p>
            ) : interaction.roles.length ? (
              <p className="cap">Позиции {interaction.roles.join("–")}</p>
            ) : null}
            <h3>{interaction.title}</h3>
            {interaction.paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {interaction.href && interaction.linkLabel ? (
              <p className="encref">
                <Link href={href(interaction.href)}>{interaction.linkLabel}</Link>
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <CharacterConclusionView
        reading={reading}
        showSummary={false}
        idPrefix={reading.testId}
      />
    </article>
  );
}
