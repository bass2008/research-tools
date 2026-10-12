import { fold, type Matrix } from "../matrix";

export type PairChakraCell = { physics: number; energy: number; emotions: number };
export type PairChakraRow = PairChakraCell & { key: string; title: string };

// The couple's map adds every cell of the two personal maps, emotions included, the way Lisovskaya adds
// the middle of the couple's tail instead of deriving it. Only the field is recalculated, like the totals
// of her purposes block; a column summing to 100 gives 10 ("в паре единицы не бывает").
export function pairChakras(a: Matrix, b: Matrix): { rows: PairChakraRow[]; totals: PairChakraCell } {
  const rows = a.chakras.map((row, i) => {
    const other = b.chakras[i];
    return {
      key: row.key,
      title: row.title,
      physics: fold(row.physics + other.physics),
      energy: fold(row.energy + other.energy),
      emotions: fold(row.emotions + other.emotions),
    };
  });
  const total = (pick: (row: PairChakraCell) => number) => {
    const sum = rows.reduce((acc, row) => acc + pick(row), 0);
    return sum === 100 ? 10 : fold(sum);
  };
  return {
    rows,
    totals: { physics: total((row) => row.physics), energy: total((row) => row.energy), emotions: total((row) => row.emotions) },
  };
}
