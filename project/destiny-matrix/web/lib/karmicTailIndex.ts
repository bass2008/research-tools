export type TailPlace = "M" | "N" | "D";

/** One link per ordered tail; repeated arcana retain every position they occupy. */
export function karmicTailNumberIndex(keys: readonly string[]) {
  const groups = new Map<number, Array<{ key: string; places: TailPlace[] }>>();
  const positions: TailPlace[] = ["M", "N", "D"];
  for (const key of keys) {
    const numbers = key.split("-").map(Number);
    for (const number of new Set(numbers)) {
      const entries = groups.get(number) ?? [];
      entries.push({
        key,
        places: positions.filter((_, index) => numbers[index] === number),
      });
      groups.set(number, entries);
    }
  }
  return [...groups].sort(([a], [b]) => a - b).map(([arcanum, tails]) => ({ arcanum, tails }));
}
