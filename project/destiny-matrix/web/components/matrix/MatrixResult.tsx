import { arcanum, arcanumTitle } from "@/lib/arcana";
import { birthLabel, type Matrix } from "@/lib/matrix";

import ArcanumCard from "@/components/matrix/ArcanumCard";
import ChakraTable from "@/components/matrix/ChakraTable";
import Octagram from "@/components/matrix/Octagram";
// Подписи точек — из публичного каталога, а не из lib/encyclopedia: та тянет за собой
// lib/sections.ts с толкованиями платных разделов, и они уехали бы в клиентский чанк.
import { POINT_KEYS, POINT_LABELS, positionHref } from "@/lib/publicSpec";
import { publicHref } from "@/lib/site";


function Bub({ v, gold = false, absolute = false }: { v: number; gold?: boolean; absolute?: boolean }) {
  const href = absolute ? publicHref(`/encyclopedia/arcanum/${v}`) : `/encyclopedia/arcanum/${v}`;
  return (
    <a className={gold ? "bub g" : "bub"} href={href} title={arcanumTitle(v)}>
      {v}
    </a>
  );
}

export default function MatrixResult({
  m,
  printing = false,
  example = false,
}: {
  m: Matrix;
  printing?: boolean;
  /** карта построена по дате-заглушке, а не по введённой: назвать её своей нельзя */
  example?: boolean;
}) {

  // в PDF относительный адрес указывает на внутренний хост службы печати
  const link = (path: string) => (printing ? publicHref(path) : path);

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
          <h2>{example ? "Пример карты" : "Ваша матрица"}</h2>
          <div className="cap">
            {example ? "Выберите свою дату выше — карта пересчитается" : `${birthLabel(m.birth)} · все позиции карты`}
          </div>
          <Octagram m={m} />
        </div>

        <div>
          <ChakraTable m={m} heading="h2" printing={printing} />

          <div className="mini">
            <div className="mb">
              <h3>Поиск себя</h3>
              <p>Линия неба и линия земли: духовная и материальная задачи.</p>
              <div className="row">
                Небо: <Bub v={m.sky[0]} absolute={printing} /> <Bub v={m.sky[1]} absolute={printing} /> <Bub v={m.sky[2]} gold absolute={printing} />
              </div>
              <div className="row">
                Земля: <Bub v={m.ground[0]} absolute={printing} /> <Bub v={m.ground[1]} absolute={printing} /> <Bub v={m.ground[2]} gold absolute={printing} />
              </div>
            </div>
            <div className="mb">
              <h3>Социализация</h3>
              <p>Родовые ветви: результат и признание в социуме.</p>
              <div className="row">
                М: <Bub v={m.social_male[0]} absolute={printing} /> <Bub v={m.social_male[1]} absolute={printing} /> <Bub v={m.social_male[2]} gold absolute={printing} />
              </div>
              <div className="row">
                Ж: <Bub v={m.social_female[0]} absolute={printing} /> <Bub v={m.social_female[1]} absolute={printing} />{" "}
                <Bub v={m.social_female[2]} gold absolute={printing} />
              </div>
            </div>
            <div className="mb">
              <h3>Духовная гармония</h3>
              <p>Состояние, из которого получается всё остальное.</p>
              <div className="row">
                <Bub v={m.harmony} gold absolute={printing} /> {arcanumTitle(m.harmony)}
              </div>
            </div>
            <div className="mb">
              <h3>Планетарная задача</h3>
              <p>То, что выходит за рамки личной истории.</p>
              <div className="row">
                <Bub v={m.planetary} gold absolute={printing} /> {arcanumTitle(m.planetary)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel section-gap">
        <h2>Главные точки</h2>
        <div className="cap">Шесть позиций, которые задают всё остальное</div>
        <div className="mp">
          {main.map(([who, v, hint]) => (
            <a className="mpc" key={who} href={link(`/encyclopedia/arcanum/${v}`)}>
              <ArcanumCard n={v} size="grid" decorative half={printing} />
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
        <h2>Все позиции карты</h2>
        <div className="cap">Позиция · аркан · как читается</div>
        <div className="tabscroll">
          <table className="postab short">
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

export { birthLabel };
