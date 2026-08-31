import type { CharacterConclusionReading } from "@/lib/characterTypes";

/** Компактный персональный итог; длинные связи остаются в статье энциклопедии. */
export default function CharacterConclusionView({
  reading,
  label = "Как складывается тройка",
  showSummary = true,
}: {
  reading: CharacterConclusionReading;
  label?: string;
  showSummary?: boolean;
}) {
  return (
    <div className="character-compact" data-testid="character-conclusion">
      {showSummary ? (
        <div className="character-summary panel">
          <p className="cap">{label}</p>
          <p>{reading.summary}</p>
        </div>
      ) : null}
      <section className="character-conclusion section-gap" aria-labelledby="character-result-title">
        <h2 id="character-result-title">Итог разбора</h2>
        <div className="panel">
          <h3>Главная сила</h3>
          <p>{reading.strength}</p>
        </div>
        <div className="panel">
          <h3>Главное напряжение</h3>
          <p>{reading.tension}</p>
        </div>
        <div className="panel">
          <h3>Практический шаг</h3>
          <p>{reading.practice}</p>
        </div>
      </section>
    </div>
  );
}
