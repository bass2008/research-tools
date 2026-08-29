/** Обрезка по границе слова: `slice` рубил описания карточек посередине — «для давно отло…». */
export function clip(text: string, limit: number): string {
  const value = text.trim();
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  const head = (space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—-]+$/, "");
  return `${head}…`;
}

/** Короткая подпись как самостоятельная фраза: в списках `short` идёт строчными и без точки,
 *  а лидом страницы такая строка читается как обрывок машинной склейки. */
export function sentence(text: string): string {
  const value = text.trim();
  if (!value) return value;
  const head = value[0].toUpperCase() + value.slice(1);
  return /[.!?…]$/.test(head) ? head : `${head}.`;
}
