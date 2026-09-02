export interface ReadingRoleParts {
  essence: string;
  strength: string;
  risk: string;
  action: string;
}

export interface ReadingRoleTemplate extends ReadingRoleParts {
  title: string;
}

export interface ReadingRole extends ReadingRoleTemplate {
  key: string;
  label: string;
  question: string;
  arcanum: number;
  /**
   * Роль читает ту же позицию корпуса и тот же аркан, что и названная выше: тексты у них
   * совпали бы дословно. Так бывает у парных ролей — «итог М»/«итог Ж» на 61,5 % результатов
   * раздела «Дары рода», «задача М»/«задача Ж» на 48,6 % «Родовых задач». Разбор печатает
   * отсылку вместо второй копии, а итог такую роль не перечисляет.
   */
  sameAs?: { key: string; label: string };
}

export interface ReadingInteraction {
  key: string;
  title: string;
  roles: string[];
  /** Человекочитаемая подпись вместо стандартного списка позиций. */
  caption?: string;
  paragraphs: string[];
  href?: string;
  linkLabel?: string;
}

export interface ReadingConclusion {
  summary: string;
  strength: string;
  tension: string;
  practice: string;
}

export interface ChakraReadingCell {
  column: "physics" | "energy" | "emotions";
  title: string;
  arcanum: number;
  context: string;
  modifier: string;
  action: string;
}

export interface ChakraReadingRow {
  key: string;
  title: string;
  hint: string;
  level: string;
  cells: ChakraReadingCell[];
}

export interface AgeReadingPeriod extends ReadingRoleTemplate {
  from: number;
  to: number;
  arcanum: number;
  current: boolean;
  next: boolean;
}

/** Общий формат связного разбора: его одинаково печатают энциклопедия, отчёт и PDF. */
export interface LongformReading extends ReadingConclusion {
  slug: string;
  title: string;
  lead: string;
  rolesTitle: string;
  rolesLead: string;
  interactionsTitle: string;
  interactionsLead: string;
  testId: string;
  /** Особая раскладка нужна только там, где сама сущность является таблицей или шкалой. */
  layout?: "chakras" | "years";
  caption?: string;
  roles: ReadingRole[];
  interactions: ReadingInteraction[];
  chakraRows?: ChakraReadingRow[];
  agePeriods?: AgeReadingPeriod[];
}
