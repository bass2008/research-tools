import Link from "next/link";

import type { Matrix } from "@/lib/matrix";
import { publicHref } from "@/lib/site";

/**
 * Карта энергий: семь уровней в трёх колонках.
 *
 * Одним компонентом, а не копией в двух файлах: цвета подписей приходилось править дважды, и
 * контраст на странице матрицы оставался прежним, пока правку не повторяли вручную.
 *
 * Цвет подписи выбирается по фону: белым на жёлтом и голубом уровнях контраст падал до 2,1 : 1,
 * а тёмным на них выходит 5,1–8,4 : 1. Палитра уровней при этом не меняется.
 */
const LEVELS: Record<string, { bg: string; ink: string }> = {
  sahasrara: { bg: "#8e5bc4", ink: "#fff" },
  ajna: { bg: "#3f5ec9", ink: "#fff" },
  vishuddha: { bg: "#1f9ed6", ink: "#14181c" },
  anahata: { bg: "#159c69", ink: "#14181c" },
  manipura: { bg: "#d9ac1e", ink: "#14181c" },
  svadhisthana: { bg: "#dd7b2a", ink: "#14181c" },
  muladhara: { bg: "#c9453a", ink: "#fff" },
};

export default function ChakraTable({
  m,
  heading = "h3",
  printing = false,
}: {
  m: Matrix;
  /** уровень заголовка задаёт страница: на карте это раздел, в разборе — панель внутри него */
  heading?: "h2" | "h3";
  /** печать в PDF: адреса становятся абсолютными, иначе ссылки ведут на внутренний хост */
  printing?: boolean;
}) {
  const Heading = heading;
  const href = (key: string) => {
    const path = `/encyclopedia/chakra/${key}`;
    return printing ? publicHref(path) : path;
  };

  return (
    <div className="panel">
      <Heading>Карта энергий по чакрам</Heading>
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
              <td style={{ background: LEVELS[r.key]?.bg }}>
                <Link href={href(r.key)} style={{ color: LEVELS[r.key]?.ink }}>
                  {7 - i}. {r.title}
                </Link>
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
  );
}
