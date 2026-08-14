import { arcanum, arcanumTitle } from "@/lib/arcana";
import type { Matrix } from "@/lib/matrix";

import ArcanumCard from "./ArcanumCard";
import Octagram from "./Octagram";
// Подписи точек — из публичного каталога, а не из lib/encyclopedia: та тянет за собой
// lib/sections.ts с толкованиями платных разделов, и они уехали бы в клиентский чанк.
import { POINT_KEYS, POINT_LABELS, positionHref } from "./publicSpec";

const CHAKRA_COLORS: Record<string, string> = {
  sahasrara: "#8e5bc4",
  ajna: "#3f5ec9",
  vishuddha: "#1f9ed6",
  anahata: "#159c69",
  manipura: "#d9ac1e",
  svadhisthana: "#dd7b2a",
  muladhara: "#c9453a",
};

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function birthLabel(birth: string): string {
  const [y, m, d] = birth.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function Bub({ v, gold = false }: { v: number; gold?: boolean }) {
  return (
    <a className={gold ? "bub g" : "bub"} href={`/encyclopedia/arcanum/${v}`} title={arcanumTitle(v)}>
      {v}
    </a>
  );
}

export default function MatrixResult({ m }: { m: Matrix }) {

  // Имена — короткая форма канона из lib/encyclopedia.ts: одно число называется на сайте
  // одинаково в карте, в разборе, в таблице позиций и в справочнике. Второй строкой идёт
  // пояснение — оно объясняет, а не называет.
  const main: Array<[string, number, string]> = [
    ["Центр карты", m.center, "Ядро карты: к нему сходятся все линии"],
    ["Личность", m.day, "То, как вас считывают в первые минуты"],
    ["Опора рода", m.year, "Фундамент, полученный до старта"],
    ["Миссия", m.mission, "Куда ведёт линия, если не мешать"],
    ["Денежный канал", m.money[0], "Через что приходит достаток"],
    ["Линия отношений", m.love[0], "Что вы приносите в пару"],
  ];

  return (
    <>
      <div className="rgrid">
        <div className="panel">
          <h3>Ваша матрица</h3>
          <div className="cap">{birthLabel(m.birth)} · все позиции карты</div>
          <Octagram m={m} />
        </div>

        <div>
          <div className="panel">
            <h3>Карта энергий по чакрам</h3>
            <div className="cap">Семь уровней в трёх колонках: материя, энергия и чувства</div>
            <table className="chak">
              <thead>
                <tr>
                  <th>Уровень</th>
                  <th>Физика</th>
                  <th>Энергия</th>
                  <th>Эмоции</th>
                </tr>
              </thead>
              <tbody>
                {m.chakras.map((r, i) => (
                  <tr key={r.key}>
                    <td style={{ background: CHAKRA_COLORS[r.key] }}>
                      <a href={`/encyclopedia/chakra/${r.key}`} style={{ color: "#fff" }}>
                        {7 - i}. {r.title}
                      </a>
                    </td>
                    <td>{r.physics}</td>
                    <td>{r.energy}</td>
                    <td>{r.emotions}</td>
                  </tr>
                ))}
                <tr className="tot">
                  <td>Итого</td>
                  <td>{m.chakra_totals.physics}</td>
                  <td>{m.chakra_totals.energy}</td>
                  <td>{m.chakra_totals.emotions}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mini">
            <div className="mb">
              <h4>Поиск себя</h4>
              <p>Линия неба и линия земли: духовная и материальная задачи.</p>
              <div className="row">
                Небо: <Bub v={m.sky[0]} /> <Bub v={m.sky[1]} /> <Bub v={m.sky[2]} gold />
              </div>
              <div className="row">
                Земля: <Bub v={m.ground[0]} /> <Bub v={m.ground[1]} /> <Bub v={m.ground[2]} gold />
              </div>
            </div>
            <div className="mb">
              <h4>Социализация</h4>
              <p>Родовые ветви: результат и признание в социуме.</p>
              <div className="row">
                М: <Bub v={m.social_male[0]} /> <Bub v={m.social_male[1]} /> <Bub v={m.social_male[2]} gold />
              </div>
              <div className="row">
                Ж: <Bub v={m.social_female[0]} /> <Bub v={m.social_female[1]} />{" "}
                <Bub v={m.social_female[2]} gold />
              </div>
            </div>
            <div className="mb">
              <h4>Духовная гармония</h4>
              <p>Состояние, из которого получается всё остальное.</p>
              <div className="row">
                <Bub v={m.harmony} gold /> {arcanumTitle(m.harmony)}
              </div>
            </div>
            <div className="mb">
              <h4>Планетарная задача</h4>
              <p>То, что выходит за рамки личной истории.</p>
              <div className="row">
                <Bub v={m.planetary} gold /> {arcanumTitle(m.planetary)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel section-gap">
        <h3>Главные точки</h3>
        <div className="cap">Шесть позиций, которые задают всё остальное</div>
        <div className="mp">
          {main.map(([who, v, hint]) => (
            <a className="mpc" key={who} href={`/encyclopedia/arcanum/${v}`}>
              <ArcanumCard n={v} size="grid" decorative />
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
        <h3>Все позиции карты</h3>
        <div className="cap">Позиция · аркан · как читается</div>
        <div className="tabscroll">
          <table className="postab">
            <thead>
              <tr>
                <th>Позиция</th>
                <th>Аркан</th>
                <th>Значение</th>
              </tr>
            </thead>
            <tbody>
              {POINT_KEYS.map((key) => {
                const v = m[key];
                return (
                  <tr key={key}>
                    <td className="pn">
                      <a href={positionHref(key)}>{POINT_LABELS[key]}</a>
                    </td>
                    <td>
                      <span className="ar">
                        <a href={`/encyclopedia/arcanum/${v}`}>
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
