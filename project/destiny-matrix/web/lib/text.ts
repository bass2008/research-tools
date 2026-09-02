/** Обрезка по границе слова: `slice` рубил описания карточек посередине — «для давно отло…». */
export function clip(text: string, limit: number): string {
  const value = text.trim();
  if (value.length <= limit) return value;
  const cut = value.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  const head = (space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:—-]+$/, "");
  return `${head}…`;
}

/** Сюжет повтора аркана дописывается к итогу раздела, а не заменяет его: в замещающем варианте
 *  вместе с предметным текстом со страницы уходил и дисклеймер раздела — «не прогноз брака»,
 *  «не говорит о проклятиях» — на 2 190 разборах. */
export function withRepeat(base: string, repeated: string | null): string {
  return repeated ? `${base} ${repeated}` : base;
}

/** Короткая подпись как самостоятельная фраза: в списках `short` идёт строчными и без точки,
 *  а лидом страницы такая строка читается как обрывок машинной склейки. */
export function sentence(text: string): string {
  const value = text.trim();
  if (!value) return value;
  const head = value[0].toUpperCase() + value.slice(1);
  return /[.!?…]$/.test(head) ? head : `${head}.`;
}

/** Кубик роли бывает двух видов: придаточное к «человек» («переводит спор в задачу») и готовое
 *  предложение с заглавной буквы — так написаны четырёхчастные тексты корпуса и все рамки
 *  вариантных ролей. Рамка «когда человек …» подходит только первому: на 2 027 вставках из
 *  выборки в 2 278 разборов получалось «когда в позиции R2 человек Движение теряет устойчивость». */
export function cubeClause(cube: string): string {
  const value = cube.trim();
  if (!value) return value;
  return /^[А-ЯЁ]/.test(value) ? value[0].toLowerCase() + value.slice(1) : `человек ${value}`;
}

/** Две роли одного вида — восемь десятилетий, колонка чакр — несут одну и ту же рамку, и во
 *  фразе связи она печаталась дважды подряд. Общий зачин сворачивается до подлежащего. */
export function pairCubes(left: string, right: string): [string, string] {
  const mark = /,\s+когда человек\s+/;
  const a = mark.exec(left);
  const b = mark.exec(right);
  if (a && b && left.slice(0, a.index) === right.slice(0, b.index)) {
    return [
      `человек ${left.slice(a.index + a[0].length)}`,
      `человек ${right.slice(b.index + b[0].length)}`,
    ];
  }
  return [cubeClause(left), cubeClause(right)];
}
