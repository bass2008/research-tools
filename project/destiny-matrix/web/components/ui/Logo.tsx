/**
 * Логотип: круглая печать с монограммой AS и начертание рядом. Вектором и на переменных темы —
 * тогда он одинаков в шапке, подвале и на печати, а цвета правятся в одном месте.
 *
 * Шрифт берётся из той же переменной, что и заголовки сайта (--ser): начертание логотипа и
 * заголовков обязано совпадать, иначе логотип выглядит вставленным из чужого макета.
 */
export default function Logo({
  caption = true,
  height = 44,
  compact = false,
}: {
  caption?: boolean;
  height?: number;
  compact?: boolean;
}) {
  return (
    <svg
      viewBox={compact ? "0 0 52 52" : "0 0 214 52"}
      height={height}
      role={compact ? undefined : "img"}
      aria-label={compact ? undefined : "Arcana Sense"}
      aria-hidden={compact ? true : undefined}
      className={compact ? "brandmark compact" : "brandmark"}
    >
      <circle cx="26" cy="26" r="22" fill="none" stroke="var(--accent)" strokeWidth="1.2" />
      <circle
        cx="26"
        cy="26"
        r="18"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="0.7"
        strokeDasharray="2 4"
      />
      <text
        x="26"
        y="34"
        textAnchor="middle"
        fontFamily="var(--ser)"
        fontSize="23"
        fill="var(--gold)"
        letterSpacing="0.8"
      >
        AS
      </text>
      {compact ? null : (
        <text x="60" y={caption ? 25 : 33} fontFamily="var(--ser)" fontSize="22" fill="var(--text)">
          Arcana Sense
        </text>
      )}
      {caption && !compact ? (
        <text x="61" y="39" fontFamily="var(--sans)" fontSize="8" fill="var(--dim2)" letterSpacing="2.1">
          НАЙДИ СВОЙ СМЫСЛ
        </text>
      ) : null}
    </svg>
  );
}
