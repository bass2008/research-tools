import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedPublicLabels } from "@/lib/i18n/publicLabels";
import { forLocale as localizedPublicSpec } from "@/lib/publicSpec";
import type { LongformReading } from "@/lib/readingTypes";
import { readingRoleReference, readingRoleSymbol } from "@/lib/readingRoleLabel";
import { forLocale as localizedSite } from "@/lib/site";
import Link from "next/link";
import ArcanumCard from "./ArcanumCard";
import CharacterConclusionView from "./CharacterConclusionView";
import CharacterRoleParts from "./CharacterRoleParts";

export const forLocale = localized((L: Locale, site) => {
  const { arcanumTitle } = localizedArcana(L);
  const { columnTitle } = localizedPublicLabels(L);
  const { arcanumHref } = localizedPublicSpec(L);
  const { publicHref } = localizedSite(L, site);

  return { arcanumTitle, columnTitle, arcanumHref, publicHref };
});

export default function CharacterReadingView({ site = DEFAULT_SITE, locale: requestedLocale, ...localeProps }: ({
  reading: LongformReading;
  printing?: boolean;
  showRoles?: boolean;
}) & { locale?: Locale; site?: SiteProfile }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    reading,
    printing = false,
    showRoles = true,
  } = localeProps;
  const { arcanumTitle, columnTitle, arcanumHref, publicHref } = forLocale(L, site);

  const href = (path: string) => (printing ? publicHref(path) : path);
  const rolesTitleId = `${reading.testId}-roles-title`;
  const interactionsTitleId = `${reading.testId}-interactions-title`;
  const roleReferences = new Map(reading.roles.map((role) => [role.key, readingRoleReference(role)]));

  return (
    <article className="character-reading" data-testid={reading.testId}>
      <div className="character-summary panel">
        <p className="cap">{reading.caption ?? D.sheet.combinationCaption[L](reading.slug)}</p>
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
                  <th>{D.report.chakraLevel[L]}</th>
                  <th>{columnTitle("physics")}</th>
                  <th>{columnTitle("energy")}</th>
                  <th>{columnTitle("emotions")}</th>
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
                  {D.sheet.ageRange[L](period.from, period.to)}
                  {period.current ? D.sheet.currentStage[L] : period.next ? D.sheet.nextStage[L] : ""}
                </p>
                <h3>
                  <Link href={href(arcanumHref(period.arcanum))}>
                    {period.arcanum} · {period.title}
                  </Link>
                </h3>
                <CharacterRoleParts locale={L} role={period} />
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
                    {readingRoleSymbol(role) ? `${readingRoleSymbol(role)} · ` : ""}{role.label}
                  </span>
                  <ArcanumCard locale={L} n={role.arcanum} size="grid" decorative half={printing} />
                  <span className="lb">
                    <span className="nm">
                      <span className="rn">{role.arcanum}</span> {role.title}
                    </span>
                  </span>
                </Link>
                <p className="character-question">{role.question}</p>
                {role.sameAs ? (
                  <p className="character-role-parts dim">
                    {D.sheet.sameAsRole[L](role.sameAs.label)}
                  </p>
                ) : (
                  <CharacterRoleParts locale={L} role={role} />
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
              <p className="cap">{D.sheet.interactionRoles[L](interaction.roles.map((key) => roleReferences.get(key) ?? key).join("–"))}</p>
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

      <CharacterConclusionView locale={L}
        reading={reading}
        showSummary={false}
        idPrefix={reading.testId}
      />
    </article>
  );
}
