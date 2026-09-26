import { DEFAULT_SITE, type SiteProfile } from "@/lib/siteProfile";
import ArcanumCard from "@/components/matrix/ArcanumCard";
import ChakraTable from "@/components/matrix/ChakraTable";
import Octagram from "@/components/matrix/Octagram";
import { forLocale as localizedArcana } from "@/lib/arcana";
import { D } from "@/lib/i18n";
import { birthLabel, forLocale as localizedMatrix, type Matrix } from "@/lib/matrix";

// Подписи точек — из публичного каталога, а не из lib/encyclopedia: та тянет за собой
// lib/sections.ts с толкованиями платных разделов, и они уехали бы в клиентский чанк.
import { SITE_LANG as defaultLocale, type Lang as Locale } from "@/lib/i18n/lang";
import { localized } from "@/lib/i18n/localized";
import { forLocale as localizedPublicSpec } from "@/lib/publicSpec";
import { forLocale as localizedSite } from "@/lib/site";

export { birthLabel };

export const forLocale = localized((L: Locale, site) => {
  const { arcanum, arcanumTitle } = localizedArcana(L);
  const { birthLabel } = localizedMatrix(L);
  const { POINT_KEYS, POINT_LABELS, positionHref } = localizedPublicSpec(L);
  const { publicHref } = localizedSite(L, site);

  return { arcanum, arcanumTitle, birthLabel, POINT_KEYS, POINT_LABELS, positionHref, publicHref };
});

function Bub({ site = DEFAULT_SITE, locale: requestedLocale, ...localeProps }: ({ v: number; gold?: boolean; absolute?: boolean }) & { locale?: Locale; site?: SiteProfile }) {
  const L = requestedLocale ?? defaultLocale;
  const { v, gold = false, absolute = false } = localeProps;
  const { arcanumTitle, publicHref } = forLocale(L, site);

  const href = absolute ? publicHref(`/encyclopedia/arcanum/${v}`) : `/encyclopedia/arcanum/${v}`;
  return (
    <a className={gold ? "bub g" : "bub"} href={href} title={arcanumTitle(v)}>
      {v}
    </a>
  );
}

export default function MatrixResult({ site = DEFAULT_SITE, locale: requestedLocale, ...localeProps }: ({
  m: Matrix;
  printing?: boolean;
  /** карта построена по дате-заглушке, а не по введённой: назвать её своей нельзя */
  example?: boolean;
}) & { locale?: Locale; site?: SiteProfile }) {
  const L = requestedLocale ?? defaultLocale;
  const {
    m,
    printing = false,
    example = false,
  } = localeProps;
  const { arcanum, arcanumTitle, birthLabel, POINT_KEYS, POINT_LABELS, positionHref, publicHref } = forLocale(L, site);

  // в PDF относительный адрес указывает на внутренний хост службы печати
  const link = (path: string) => (printing ? publicHref(path) : path);

  // Имена — короткая форма канона из lib/encyclopedia.ts: одно число называется на сайте
  // одинаково в карте, в разборе, в таблице позиций и в справочнике. Второй строкой идёт
  // пояснение — оно объясняет, а не называет.
  const main: Array<[string, number, string]> = [
    [D.report.pointCenter[L], m.center, D.report.pointCenterHint[L]],
    [D.report.pointPortrait[L], m.day, D.report.pointPortraitHint[L]],
    [D.report.pointMaterial[L], m.year, D.report.pointMaterialHint[L]],
    [D.report.pointKarmic[L], m.mission, D.report.pointKarmicHint[L]],
    [D.report.pointMoney[L], m.money[0], D.report.pointMoneyHint[L]],
    [D.report.pointLove[L], m.love[0], D.report.pointLoveHint[L]],
  ];

  return (
    <>
      <div className="rgrid">
        <div className="panel">
          <h2>{example ? D.report.exampleChart[L] : D.report.yourChart[L]}</h2>
          <div className="cap">
            {example ? D.report.exampleHint[L] : D.report.allPositionsOf[L](birthLabel(m.birth))}
          </div>
          <Octagram site={site} locale={L} m={m} printing={printing} />
        </div>

        <div>
          <ChakraTable site={site} locale={L} m={m} heading="h2" printing={printing} />

          <div className="mini">
            <div className="mb">
              <h3>{D.report.selfSearch[L]}</h3>
              <p>{D.report.selfSearchHint[L]}</p>
              <div className="row">
                {D.report.sky[L]}: <Bub site={site} locale={L} v={m.sky[0]} absolute={printing} /> <Bub site={site} locale={L} v={m.sky[1]} absolute={printing} /> <Bub site={site} locale={L} v={m.sky[2]} gold absolute={printing} />
              </div>
              <div className="row">
                {D.report.ground[L]}: <Bub site={site} locale={L} v={m.ground[0]} absolute={printing} /> <Bub site={site} locale={L} v={m.ground[1]} absolute={printing} /> <Bub site={site} locale={L} v={m.ground[2]} gold absolute={printing} />
              </div>
            </div>
            <div className="mb">
              <h3>{D.report.socialisation[L]}</h3>
              <p>{D.report.socialisationHint[L]}</p>
              <div className="row">
                {D.report.maleBranch[L]}: <Bub site={site} locale={L} v={m.social_male[0]} absolute={printing} /> <Bub site={site} locale={L} v={m.social_male[1]} absolute={printing} /> <Bub site={site} locale={L} v={m.social_male[2]} gold absolute={printing} />
              </div>
              <div className="row">
                {D.report.femaleBranch[L]}: <Bub site={site} locale={L} v={m.social_female[0]} absolute={printing} /> <Bub site={site} locale={L} v={m.social_female[1]} absolute={printing} />{" "}
                <Bub site={site} locale={L} v={m.social_female[2]} gold absolute={printing} />
              </div>
            </div>
            <div className="mb">
              <h3>{D.report.spiritualPurpose[L]}</h3>
              <p>{D.report.spiritualPurposeHint[L]}</p>
              <div className="row">
                <Bub site={site} locale={L} v={m.harmony} gold absolute={printing} /> {arcanumTitle(m.harmony)}
              </div>
            </div>
            <div className="mb">
              <h3>{D.report.planetaryPurpose[L]}</h3>
              <p>{D.report.planetaryPurposeHint[L]}</p>
              <div className="row">
                <Bub site={site} locale={L} v={m.planetary} gold absolute={printing} /> {arcanumTitle(m.planetary)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel section-gap">
        <h2>{D.report.mainPoints[L]}</h2>
        <div className="cap">{D.report.mainPointsHint[L]}</div>
        <div className="mp">
          {main.map(([who, v, hint]) => (
            <a
              className="mpc"
              key={who}
              href={link(`/encyclopedia/arcanum/${v}`)}
              data-position={who}
              data-arcanum={v}
            >
              <ArcanumCard locale={L} n={v} size="grid" decorative half={printing} />
              <span className="mpcap">
                <span className="who">{who}</span>
                <span className="nm">
                  <span className="rn">{v}</span> {arcanumTitle(v)}
                </span>
                <span className="ds">{hint}</span>
              </span>
            </a>
          ))}
        </div>
      </div>

      <div className="panel section-gap">
        <h2>{D.report.allPositions[L]}</h2>
        <div className="cap">{D.report.allPositionsHint[L]}</div>
        <div className="tabscroll">
          <table className="postab short">
            <thead>
              <tr>
                <th>{D.report.columnPosition[L]}</th>
                <th>{D.report.columnArcanum[L]}</th>
                <th>{D.report.columnMeaning[L]}</th>
              </tr>
            </thead>
            <tbody>
              {POINT_KEYS.map((key) => {
                const v = m[key];
                return (
                  <tr key={key}>
                    <td className="pn">
                      <a href={link(positionHref(key))}>{POINT_LABELS[key]}</a>
                    </td>
                    <td>
                      <span className="ar">
                        <a href={link(`/encyclopedia/arcanum/${v}`)}>
                          {v} · <b>{arcanumTitle(v)}</b>
                        </a>
                      </span>
                    </td>
                    <td className="vl">{arcanum(v).short}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
