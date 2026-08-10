import type { ReactNode } from 'react'
import { ApiError, fmt, fmtWhen } from './api'
import type { ArtifactKind, ModelFamily, NeedsArtifact, NeedsPhrase } from './api'

// Общая вёрстка второго и третьего слоя. Дерево продуктов — это дерево потребностей плюс один
// уровень сверху, поэтому строки, легенда, кружки оценок и таблица деревьев здесь одни и те же:
// два экземпляра одного вида разъезжаются на первой же правке.

export const MODEL_FAMILIES: ModelFamily[] = ['claude', 'codex']
export const FAMILY_LABEL: Record<ModelFamily, string> = { claude: 'Claude', codex: 'Codex' }

export const KIND_LABEL: Record<string, string> = {
  analyze: 'Ниша',
  analyze_adv: 'Функции',
  analyze_product: 'Спецификация',
  model_test: 'Test',
  season: 'Сезонность',
  adjacent: 'Смежные ключи',
  dump: 'Выгрузка',
  products: 'Продукты',
}

export const INTENT_LABEL: Record<string, string> = {
  product: 'продукт',
  mixed: 'смешанный интент',
  information: 'инфо',
  platform_action: 'действие платформы',
  support: 'поддержка',
  navigation: 'кнопка/навигация',
  unclear: 'не ясно',
}

export const artifactFamily = (a: NeedsArtifact): ModelFamily | null =>
  ['analyze', 'analyze_adv', 'analyze_product', 'model_test'].includes(a.kind)
    ? (a.model_family ?? 'claude')
    : null

/** Закрыть выпадающее меню после выбора пункта. */
export function closeMenu(e: { currentTarget: HTMLElement }) {
  e.currentTarget.closest('details')?.removeAttribute('open')
}

export function errText(e: unknown): string {
  if (e instanceof ApiError) return `${e.status} · ${e.message}${e.detail ? ' — ' + e.detail : ''}`
  return e instanceof Error ? e.message : String(e)
}

export function band(score: number | null): string {
  if (score == null) return 'ch-low'
  return score >= 70 ? 'ch-high' : score >= 40 ? 'ch-mid' : 'ch-low'
}

function Mark({ sample, label, hint }: { sample: ReactNode; label: string; hint: string }) {
  return (
    <div>
      {sample}
      <span className="mut">{label}</span>
      <span className="q" title={hint} data-testid="col-hint">
        ?
      </span>
    </div>
  )
}

function Th({ label, hint, num }: { label: string; hint: string; num?: boolean }) {
  return (
    <th className={num ? 'num' : undefined}>
      {label}{' '}
      <span className="q" title={hint} data-testid="col-hint">
        ?
      </span>
    </th>
  )
}

export function Phrases({ items }: { items: NeedsPhrase[] }) {
  if (!items.length) return null
  return (
    <div className="nphrases">
      {items.map((p) => (
        <div className="nphrase" data-testid="needs-phrase" key={p.phrase}>
          <span className="ph">{p.phrase}</span>
          <span className="fr">{fmt(p.freq)}</span>
        </div>
      ))}
    </div>
  )
}

export function ModelScore({ family, artifacts }: { family: ModelFamily; artifacts: NeedsArtifact[] }) {
  const latest = (kind: ArtifactKind) =>
    artifacts
      .filter((a) => a.kind === kind && artifactFamily(a) === family)
      .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))[0]
  const stageSlots = [
    { n: 1, artifact: latest('analyze') },
    { n: 2, artifact: latest('analyze_adv') },
    { n: 3, artifact: latest('analyze_product') },
  ]
  let last = stageSlots.length - 1
  while (last >= 0 && stageSlots[last].artifact?.verdict_score == null) last -= 1
  if (last < 0) return null
  // Не сдвигаем этапы влево: если есть только «Функции», `(—,58)` честнее, чем `(58)`,
  // которое выглядело бы как score «Ниши».
  const stages = stageSlots.slice(0, last + 1)
  const title = stages
    .filter((x) => x.artifact?.verdict_score != null)
    .map(({ n, artifact }) =>
      `${n}: ${artifact?.verdict ?? '—'} ${artifact?.verdict_score ?? '—'}`,
    )
    .join(' · ')
  return (
    <span
      className={`model-score model-${family}`}
      data-testid={`needs-score-${family}`}
      title={`${FAMILY_LABEL[family]} · ${title}`}
    >
      (
      {stages.map(({ n, artifact }, i) => (
        <span key={n}>
          {i > 0 && ','}
          <span className={`vscore vscore-${artifact?.verdict ?? 'unknown'}`}>
            {artifact?.verdict_score ?? '—'}
          </span>
        </span>
      ))}
      )
    </span>
  )
}

/** Подгруппа работы — раздел или сегмент. Один вид в обоих деревьях.

В потребностях у подгруппы есть сами фразы, в продуктах приезжает только их число: разворачивать
двадцать разделов с ключами внутри продукта незачем, ключи показывает сама потребность. */
export function Segments({ items }: { items: SegmentLike[] }) {
  if (!items.length) return null
  return (
    <>
      {items.map((s) => (
        <div className="nseg" data-testid="needs-segment" key={s.name ?? Math.random()}>
          <div className="row">
            <span className="ph">{s.name ?? '—'}</span>
            {s.kind && <span className="ct">{s.kind === 'section' ? 'раздел' : 'сегмент'}</span>}
            <span className="ct">{s.phrases?.length ?? s.phrase_count ?? 0} фраз</span>
          </div>
          {s.why && <div className="nwhy">{s.why}</div>}
          {s.phrases?.length ? <Phrases items={s.phrases} /> : null}
        </div>
      ))}
    </>
  )
}

export interface SegmentLike {
  name: string | null
  kind?: string | null
  why: string | null
  phrases?: NeedsPhrase[]
  phrase_count?: number
}

/** Легенда обоих деревьев: одни и те же метки, разница только в подписи единицы. */
export function Legend({ ranked, unit }: { ranked: boolean; unit: string }) {
  return (
    <div className="legend nlegend">
      {ranked && (
        <Mark sample={<span className="chance ch-high">0–100</span>} label="шанс продукта"
              hint="Отдельный анализ Opus/Sol: физически ли возможен самостоятельный продукт. Итог считается из шести факторов с жёсткими ограничителями для статей, поддержки, кнопок и действий самой платформы. Конкуренты и выдача не учитываются. У продукта показан лучший шанс среди его потребностей." />
      )}
      <Mark sample={<span className="fr freq-sum">Σ 18 431</span>} label="сумма частот"
            hint="Сырая сумма частот всех формулировок, включая подгруппы. Запросы могут пересекаться, поэтому это не число уникальных пользователей и не размер рынка." />
      <Mark sample={<span className="fr freq-max">max 11 081</span>} label="максимум"
            hint="Наибольшая частота одной формулировки. Не содержит повторного сложения пересекающихся запросов." />
      <Mark sample={<span className="ct">15 фраз</span>} label="формулировок"
            hint="Сколько фраз ветки здесь собрано, включая подгруппы. Это и есть ядро ключей — оно попадает в отчёт." />
      <Mark sample={<span className="occ">НЕ ЯСНО</span>} label="работа не названа"
            hint="Объект понятен, а результат из фраз не виден: «нейросеть фото» — сгенерировать? улучшить? оживить? Это реальный спрос, который не удалось отнести к работе; разбирать там нечего." />
      <Mark sample={<span className="model-score model-claude">(30,58,27)</span>}
            label="Claude · числа: Ниша, Функции, Спецификация"
            hint="Один компактный кружок хранит до трёх score по этапам 1–2–3." />
      <Mark sample={<span className="model-score model-codex">(42,61)</span>}
            label="Codex · тот же порядок этапов"
            hint="Цвет рамки показывает семейство модели. Claude и Codex могут считать один этап параллельно и не смешивают входы." />
      <div className="verdict-key" data-testid="needs-verdict-legend">
        <table>
          <tbody>
            <tr><td><span className="vscore vscore-SKIP">30</span></td><th>SKIP</th><td>не строить</td></tr>
            <tr><td><span className="vscore vscore-MAYBE">58</span></td><th>MAYBE</th><td>сначала проверить</td></tr>
            <tr><td><span className="vscore vscore-BUILD">77</span></td><th>BUILD</th><td>можно строить</td></tr>
          </tbody>
        </table>
      </div>
      <Mark sample={<span className="favorite on">♥</span>} label={'избранные ' + unit}
            hint="Ручная отметка человека. На классификацию, рейтинг и группировку не влияет, хранится отдельным файлом." />
    </div>
  )
}


/** Список веток: одна таблица на оба дерева, разница только в подсказке сверху. */
export function TreeTable({
  rows,
  onOpen,
  hint,
  rowTestId,
}: {
  rows: NeedsRowLike[] | null
  onOpen: (id: string) => void
  hint: ReactNode
  rowTestId: string
}) {
  if (rows === null) return <div className="mut">загружаем список…</div>
  return (
    <>
      <div className="hint">{hint}</div>
      <table className="tbl">
        <thead>
          <tr>
            <Th label="узел дерева запросов" hint="Ветка первого дерева, по фразам которой собрано это толкование. Мелким снизу — id сборки: по одной ветке их может быть несколько, они не мешают друг другу." />
            <Th num label="лучший шанс" hint="Самая высокая оценка физической возможности продукта среди работ ветки. До отдельной команды «Анализ» оценки нет." />
            <Th num label="частота" hint="Частота корневой фразы ветки по Вордстату. Это широкое соответствие: число уже включает все уточнения, поэтому складывать частоты внутри ветки нельзя." />
            <Th num label="работ" hint="Сколько работ собрала модель. Работа — это результат, которого человек хочет добиться («оживить фото»); одну работу выражают десятки формулировок." />
            <Th num label="продуктов" hint="Групп в дереве продуктов текущей ревизии: сумма трёх уровней — микро, средние, комплексные. Ноль — группировка ещё не запускалась." />
            <Th num label="сегм." hint="Подгруппы внутри работ: сегмент — другой вход или аудитория, раздел — тот же продукт и другая часть ответа." />
            <Th num label="фраз" hint="Сколько фраз ветки попало в работы и их подгруппы. Остальные ушли в исключённые: вместе эти два числа дают все фразы ветки, каждую ровно один раз." />
            <Th num label="исключ." hint="Фразы, которые работой не являются: бренды (ищут конкретный продукт), каталоги («лучшие нейросети»), потребление («слушать» вместо «сделать»), сломанные запросы и фразы-условия." />
            <Th num label="оценено" hint="Сколько работ прошло отдельный продуктовый анализ. Классификация сама шанс не выставляет." />
            <Th num label="разобрано" hint="По скольким продуктам уже прошёл разбор «Ниша»: куплена выдача, Opus дал вердикт и написал отчёт." />
            <Th label="собрано" hint="Когда собрано это дерево. Толкование одноразовое: ветка растёт, и старая сборка постепенно перестаёт её описывать." />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={11} className="mut">
                деревьев пока нет — положите json в logs/needs-lab
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.id}
              className={'clickable' + (r.error ? ' bad' : '')}
              data-testid={rowTestId}
              onClick={() => onOpen(r.id)}
            >
              <td>
                <div className="ph">{r.root ?? r.condition ?? '—'}</div>
                <div className="mut small">{r.id}</div>
              </td>
              <td className="num">
                {r.best_score == null ? '—' : (
                  <span className={'chance ' + band(r.best_score)}>{r.best_score}</span>
                )}
              </td>
              <td className="num">{fmt(r.root_freq)}</td>
              <td className="num">{r.works}</td>
              <td className="num">{r.products || '—'}</td>
              <td className="num">{r.segments}</td>
              <td className="num">{r.phrases}</td>
              <td className="num">{r.excluded}</td>
              <td className="num">{r.ranked || '—'}</td>
              <td className="num">{r.analyzed || '—'}</td>
              <td>{r.error ? <span className="err">{r.error}</span> : fmtWhen(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

export interface NeedsRowLike {
  id: string
  root: string | null
  condition: string | null
  root_freq: number | null
  works: number
  products?: number
  segments: number
  phrases: number
  excluded: number
  ranked: number
  analyzed: number
  best_score: number | null
  created_at: number | null
  error: string | null
}


export interface TreeAction {
  key: string
  label: string
  hint: string
  family?: ModelFamily
  busyLabel?: string
  busy?: boolean
  disabled?: boolean
  testId: string
  /** Пункт-ссылка (готовый отчёт) вместо кнопки-команды. */
  href?: string
  onClick?: () => void
}

/** Операции уровня дерева — за одной кнопкой «Действия».

Их шесть-восемь на обе вкладки, и в строку они не влезают: панель разъезжается, а важное
(корень, условие, состояние сборки) уходит вниз. Группировка по семействам — как в меню работы. */
export function TreeActions({ items, disabled }: { items: TreeAction[]; disabled?: boolean }) {
  const basic = items.filter((x) => !x.family)
  return (
    <details className="menu" data-testid="tree-actions">
      <summary className="act">Действия ▾</summary>
      <div className="menu-body" onClick={closeMenu}>
        {basic.length > 0 && <div className="menu-title">Basic</div>}
        {basic.map((x) => (x.href ? (
          <a
            key={x.key}
            className="act act-link"
            data-testid={x.testId}
            title={x.hint}
            href={x.href}
            target="_blank"
            rel="noreferrer"
          >
            {x.label}
          </a>
        ) : (
          <button
            key={x.key}
            className="act"
            data-testid={x.testId}
            disabled={disabled || x.disabled}
            title={x.hint}
            onClick={x.onClick}
          >
            {x.busy ? (x.busyLabel ?? 'идёт…') : x.label}
          </button>
        )))}
        {MODEL_FAMILIES.map((family) => {
          const mine = items.filter((x) => x.family === family)
          if (!mine.length) return null
          return (
            <div className="menu-group" key={family}>
              <div className={`menu-title model-title model-${family}`}>{FAMILY_LABEL[family]}</div>
              {mine.map((x) => (
                <button
                  key={x.key}
                  className="act"
                  data-testid={x.testId}
                  disabled={disabled || x.disabled}
                  title={x.hint}
                  onClick={x.onClick}
                >
                  {x.busy ? (x.busyLabel ?? 'идёт…') : x.label}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </details>
  )
}


/** Шапка открытого дерева: «назад» слева, «Действия» справа, между ними корень и условие.

Мета (ревизия, кем и когда собрано) уехала в подсказку на корне: в строке она занимала место,
а решение по ней не принимают. */
export function TreeHead({
  onBack,
  backLabel,
  backTestId,
  root,
  condition,
  meta,
  rootTestId,
  actions,
}: {
  onBack: () => void
  backLabel: string
  backTestId: string
  root: string | null
  condition?: string | null
  meta?: string
  rootTestId: string
  actions: ReactNode
}) {
  return (
    <div className="nhead tree-head">
      <button className="act" data-testid={backTestId} onClick={onBack}>
        {backLabel}
      </button>
      <span className="ph" data-testid={rootTestId} title={meta}>
        {root ?? '…'}
      </span>
      {condition && <span className="cond">{condition}</span>}
      <span className="head-actions">{actions}</span>
    </div>
  )
}
