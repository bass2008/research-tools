import Link from "next/link";

import type { CharacterReading } from "@/lib/characterTypes";
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
  reading: CharacterReading;
  printing?: boolean;
  showRoles?: boolean;
}) {
  const href = (path: string) => (printing ? publicHref(path) : path);

  return (
    <article className="character-reading" data-testid="character-reading">
      <div className="character-summary panel">
        <p className="cap">Как складывается тройка {reading.slug}</p>
        <p>{reading.summary}</p>
      </div>

      {showRoles ? (
        <section className="section-gap" aria-labelledby="character-roles-title">
          <h2 id="character-roles-title">Три слоя характера</h2>
          <p className="dim prose">
            Каждая точка отвечает на свой вопрос. Поэтому один аркан нельзя назначить «главным»,
            а остальные считать дополнениями: внешний образ, внутренний мотив и действие работают
            одновременно.
          </p>
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
                <CharacterRoleParts role={role} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="character-interactions section-gap" aria-labelledby="character-links-title">
        <h2 id="character-links-title">Как арканы работают вместе</h2>
        <p className="dim prose">
          Сначала читаются три роли, затем связи между ними. Если числовая пара повторяется, её
          смысл не дублируется: один сюжет рассматривается сразу в нескольких переходах.
        </p>
        {reading.interactions.map((interaction) => (
          <div className="panel" key={interaction.key} data-interaction={interaction.key}>
            <p className="cap">Позиции {interaction.roles.join("–")}</p>
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
      />
    </article>
  );
}
