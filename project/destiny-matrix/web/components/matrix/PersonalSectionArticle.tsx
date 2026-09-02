import Link from "next/link";

import type { LongformReading } from "@/lib/readingTypes";
import { positionHref } from "@/lib/publicSpec";
import type { PersonalSectionKey } from "@/lib/sectionReadings";

import CharacterReadingView from "./CharacterReadingView";

export default function PersonalSectionArticle({
  sectionKey,
  sectionTitle,
  reading,
}: {
  sectionKey: PersonalSectionKey;
  sectionTitle: string;
  reading: LongformReading;
}) {
  return (
    <>
      <p className="eyebrow">Персональный раздел матрицы</p>
      <h1>{reading.title}</h1>
      <p className="dim prose">{reading.lead}</p>

      <CharacterReadingView reading={reading} />

      <div className="allbox">
        <h2>Как устроен раздел «{sectionTitle}»</h2>
        <p>
          Общая статья объясняет метод чтения раздела, а эта страница применяет его к вашему рассчитанному результату.
        </p>
        <div className="btnrow center">
          <Link className="btn" href={positionHref(sectionKey)}>
            Открыть статью о разделе
          </Link>
          <Link className="btn ghost" href="/report">
            Вернуться к отчёту
          </Link>
          <Link className="btn ghost" href="/#calc">
            Рассчитать другую дату
          </Link>
        </div>
      </div>
    </>
  );
}
