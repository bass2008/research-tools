import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import * as api from './api'
import { fmt, fmtWhen, reportHref } from './api'
import type {
  ArtifactKind,
  ModelFamily,
  NeedsAction,
  NeedsArtifact,
  NeedsPhrase,
  NeedsRow,
  NeedsTree,
  NeedsWork,
  TaskRow,
} from './api'

// Второй слой — толкование: работы и сегменты, а не фразы. Разборы работают над одной работой,
// а второй проход перепроверяет и заменяет классификацию всего дерева.

// Три разбора — воронка от рынка к продукту, поэтому и названы по тому, что ищут.
const LABEL: Record<NeedsAction, string> = {
  analyze: '1 · Ниша',
  analyze_adv: '2 · Функции',
  product: '3 · Продукт',
  test: 'Test · 1 мин',
  season: 'Сезонность',
  adjacent: 'Смежные ключи',
  dump: 'Выгрузка TOP 10',
}

const ACTION_HINT: Record<NeedsAction, string> = {
  analyze:
    'РЫНОК И ТРАФИК. Отвечает: можно ли перехватить поисковый трафик и кто его уже держит. Единица ответа — работа целиком, оценка считается как спрос ÷ конкуренция, поэтому заполненная выдача тянет вердикт вниз. ~7 минут, 2 платных запроса (повтор по купленной выдаче бесплатен).',
  analyze_adv:
    'ЧТО МОЖНО СДЕЛАТЬ. Отвечает: какие функции есть внутри работы, у какой есть вход из поиска и кто за неё платит. Единица ответа — функция «вход → выход». Занятость ниши тут не минус, а доказательство спроса; статьи в топе — улика, что инструмента нет. Требует назвать, на чём зарабатываем мы и во сколько обходится один пользователь. Выдача из кэша — бесплатно.',
  product:
    'ЧТО СТРОИМ. Берёт ОДНУ функцию и превращает её в спецификацию микро-продукта: кто пользователь, что получает за минуту, цена и модель оплаты, почему заплатят, а не уйдут к бесплатному, откуда первые сто пользователей, что НЕ входит в первую версию, срок до первого платящего и недельная проверка без кода. Плюс ПРОГНОЗ ПРОДАЖ: воронкой от частоты — платящие и ₽/мес на 1-й, 2-й, 3-й и 6-й месяц, потолок ниши, бюджет разработки, окупаемость и ответ, почему в это стоит вложить деньги и месяцы. На вход берёт выдачу и последние отчёты «Ниша» и «Функции» целиком. Бесплатно.',
  test:
    'МИНУТНЫЙ SMOKE-TEST. Запускает дешёвого исполнителя своего семейства (Haiku для Claude, Luna для Codex), удерживает его не меньше минуты и сохраняет простой HTML-отчёт-пустышку. Нужен для проверки независимого dispatcher/MCP, бизнес-анализа не делает.',
  season:
    'История частоты по самой частотной фразе работы за два года: есть ли сезон, во сколько раз расходятся пик и дно, где мы сейчас. Один платный запрос.',
  adjacent:
    'Как ту же работу ищут БЕЗ слова-технологии. Наше дерево выросло из одной ветки и видит только тех, кто уже думает про технологию, — это домер настоящего размера ниши. 6–12 платных запросов.',
  dump:
    'Скачать топ-10 обоих движков страницами целиком в reports/<работа>/yandex и /google — чтобы прочитать, что там на самом деле, а не сниппеты. Берёт пять РАЗНЫХ углов (головная фраза, фраза кандидата из Adv, «как это делают руками», «бесплатно», коммерческая): топы по близким фразам совпадают на 70–80%. Страницы, которые рисует скрипт, догружает браузером. LLM не нужна, до 10 платных запросов за выдачу.',
}

// имя действия и вид артефакта совпадают не всегда: «Продукт» запускается как `product`,
// а прогоны его копятся под `analyze_product` — без этой карты счётчик прогонов не находился
const ARTIFACT_OF: Record<NeedsAction, ArtifactKind> = {
  analyze: 'analyze',
  analyze_adv: 'analyze_adv',
  product: 'analyze_product',
  test: 'model_test',
  season: 'season',
  adjacent: 'adjacent',
  dump: 'dump',
}

const BASIC_ACTIONS: NeedsAction[] = ['season', 'adjacent', 'dump']
const ANALYSIS_ACTIONS: NeedsAction[] = ['analyze', 'analyze_adv', 'product', 'test']
const MODEL_FAMILIES: ModelFamily[] = ['claude', 'codex']
const FAMILY_LABEL: Record<ModelFamily, string> = { claude: 'Claude', codex: 'Codex' }

const KIND_LABEL: Record<string, string> = {
  analyze: 'Ниша',
  analyze_adv: 'Функции',
  analyze_product: 'Продукт',
  model_test: 'Test',
  season: 'Сезонность',
  adjacent: 'Смежные ключи',
  dump: 'Выгрузка',
}

const WHY: Record<string, string> = {
  brand: 'бренд — ищут вход в конкретный продукт',
  catalog: 'каталог — «покажи список»',
  consumption: 'потребление — хотят готовое, а не сделать',
  broken: 'сломанный запрос — опечатка или обрывок',
  condition: 'условие — работы не называет',
  unclear: 'результат из фразы не ясен',
  other: 'прочее',
}

/** Закрыть выпадающее меню после выбора пункта. */
function closeMenu(e: { currentTarget: HTMLElement }) {
  e.currentTarget.closest('details')?.removeAttribute('open')
}

function errText(e: unknown): string {
  if (e instanceof api.ApiError) return `${e.status} · ${e.message}${e.detail ? ' — ' + e.detail : ''}`
  return e instanceof Error ? e.message : String(e)
}

const artifactFamily = (a: NeedsArtifact): ModelFamily | null =>
  ['analyze', 'analyze_adv', 'analyze_product', 'model_test'].includes(a.kind)
    ? (a.model_family ?? 'claude')
    : null

const busyKey = (work: string, action: NeedsAction, family?: ModelFamily) =>
  `${work}|${action}|${family ?? 'basic'}`

const WORK_TASK_ACTION: Record<string, NeedsAction> = {
  needs_analyze: 'analyze',
  needs_analyze_adv: 'analyze_adv',
  needs_analyze_product: 'product',
  needs_model_test: 'test',
  needs_season: 'season',
  needs_adjacent: 'adjacent',
  needs_dump: 'dump',
}

export function NeedsPane({ active, tasks = [] }: { active: boolean; tasks?: TaskRow[] }) {
  const [rows, setRows] = useState<NeedsRow[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [tree, setTree] = useState<NeedsTree | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<Record<string, string>>({}) // "работа|действие|семейство" -> task_id
  const [ask, setAsk] = useState<{
    work: string
    action: NeedsAction
    family?: ModelFamily
    text: string
  } | null>(null)
  const [refineAsk, setRefineAsk] = useState<ModelFamily | null>(null)
  const [refineTask, setRefineTask] = useState<string | null>(null)
  const statuses = useRef(new Map<string, string>())

  useEffect(() => {
    if (!active || rows) return
    api
      .needsTrees()
      .then((r) => setRows(r.trees))
      .catch((e) => setErr(errText(e)))
  }, [active, rows])

  useEffect(() => {
    if (!open) return
    setTree(null)
    api
      .needsTree(open)
      .then(setTree)
      .catch((e) => setErr(errText(e)))
  }, [open])

  // Разбор — фоновая задача; её финал ловим по вкладке Task (тот же поток событий WS) и
  // перечитываем дерево: вердикт и ссылка на отчёт лежат рядом с ним файлом.
  // Смотрим на СМЕНУ статуса в журнале задач, а не на то, что запустили из этой вкладки:
  // задачу мог поставить кто угодно и до перезагрузки страницы, а отчёт всё равно наш.
  useEffect(() => {
    const seen = statuses.current
    const first = !seen.size
    let finished = false
    for (const t of tasks) {
      const prev = seen.get(t.id)
      seen.set(t.id, t.status)
      if (!first && prev !== t.status && t.type.startsWith('needs_') &&
          (t.status === 'DONE' || t.status === 'FAILED')) finished = true
    }
    if (!finished) return
    setBusy((b) =>
      Object.fromEntries(Object.entries(b).filter(([, id]) => {
        const s = seen.get(id)
        return s !== 'DONE' && s !== 'FAILED'
      })),
    )
    if (open) api.needsTree(open).then(setTree).catch((e) => setErr(errText(e)))
    setRows(null)
    if (refineTask && ['DONE', 'FAILED'].includes(seen.get(refineTask) ?? '')) {
      setRefineTask(null)
    }
  }, [tasks, open, refineTask])

  // Работы, по которым разбор уже идёт. Считаем по журналу задач (он приходит с сервера),
  // иначе после перезагрузки страницы кнопка снова становится нажимаемой и ловит 409.
  // занятость по паре «работа + действие»: разбор и сезонность могут идти одновременно
  const busyWorks = new Set([
    ...Object.keys(busy),
    ...tasks
      .filter((t) => WORK_TASK_ACTION[t.type] && ['QUEUED', 'WAITING', 'RUNNING'].includes(t.status))
      .map((t) => {
        const action = WORK_TASK_ACTION[t.type]
        return busyKey(t.node ?? '', action, t.model_family ?? undefined)
      }),
  ])
  const refineBusy = Boolean(refineTask) || tasks.some(
    (t) => t.type === 'needs_refine' && t.node === open &&
      ['QUEUED', 'WAITING', 'RUNNING'].includes(t.status),
  )

  async function run(action: NeedsAction, work: string, family?: ModelFamily) {
    if (!open) return
    try {
      const { task_id } = await api.needsRun(action, open, work, family)
      setBusy((b) => ({ ...b, [busyKey(work, action, family)]: task_id }))
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  async function runRefine(family: ModelFamily) {
    if (!open) return
    try {
      const { task_id } = await api.needsRefine(open, family)
      setRefineTask(task_id)
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  /** Повтор — не ошибка, а смысл: данных могло прибавиться. Но спрашиваем. */
  function start(action: NeedsAction, work: string, done: number, family?: ModelFamily) {
    if (!done) return void run(action, work, family)
    const owner = family ? `${FAMILY_LABEL[family]} · ` : ''
    setAsk({
      work,
      action,
      family,
      text:
        action === 'analyze'
          ? `${owner}разбор этой работы уже делали ${done} раз(а). Запустить ещё раз? Смысл есть, если с прошлого раза добавились данные — сезонность или смежные ключи. Старые отчёты останутся.`
          : `${owner}«${LABEL[action]}» уже считали ${done} раз(а). Посчитать заново? Прошлый отчёт останется.`,
    })
  }

  if (err) {
    return (
      <div className="cerr" data-testid="needs-error">
        {err}
        <button
          className="x"
          onClick={() => {
            setErr('')
            setRows(null)
          }}
          title="повторить"
        >
          ↻
        </button>
      </div>
    )
  }

  if (open) {
    return (
      <>
        <div className="bar-row">
          <button className="act" data-testid="needs-back" onClick={() => setOpen(null)}>
            ← Назад к списку
          </button>
          {/* по какому узлу дерева запросов собрано — иначе по одному id не понять */}
          <span className="ph" data-testid="needs-branch">
            {tree?.root ?? '…'}
          </span>
          <span className="mut">{open}</span>
        </div>
        <div className="bar-row needs-refine-bar" data-testid="needs-refine-bar">
          <span className="mut">
            Классификация v{tree?.revision ?? 0} · второй проход проверяет границы работ и unclear
          </span>
          {MODEL_FAMILIES.map((family) => (
            <button
              key={family}
              className={`act model-${family}`}
              data-testid={`needs-refine-${family}`}
              disabled={refineBusy || !tree}
              title="Перепроверить все фразы, разделить работы с разными MVP и убрать неоднозначные фразы в «не ясно»"
              onClick={() => setRefineAsk(family)}
            >
              {refineBusy ? '2-й проход идёт…' : `${FAMILY_LABEL[family]} · 2-й проход`}
            </button>
          ))}
          {tree?.refined_by && (
            <span className="mut" data-testid="needs-refined-by">
              последний: {FAMILY_LABEL[tree.refined_by]} · {fmtWhen(tree.refined_at)}
            </span>
          )}
        </div>
        {tree ? (
          <TreeView tree={tree} busy={busyWorks} locked={refineBusy} onRun={start} />
        ) : (
          <div className="mut">загружаем дерево…</div>
        )}
        {ask && (
          <div className="modal">
            <div className="dlg" data-testid="needs-confirm">
              <b>
                {ask.family ? FAMILY_LABEL[ask.family] + ' · ' : ''}{LABEL[ask.action]}: {ask.work}
              </b>
              <p>{ask.text}</p>
              <div className="dlg-btns">
                <button
                  className="go"
                  data-testid="needs-confirm-yes"
                  onClick={() => {
                    const a = ask
                    setAsk(null)
                    void run(a.action, a.work, a.family)
                  }}
                >
                  Да, запустить
                </button>
                <button className="act" data-testid="needs-confirm-no" onClick={() => setAsk(null)}>
                  Нет
                </button>
              </div>
            </div>
          </div>
        )}
        {refineAsk && (
          <div className="modal">
            <div className="dlg" data-testid="needs-refine-confirm">
              <b>{FAMILY_LABEL[refineAsk]} · второй проход всего дерева</b>
              <p>
                Модель заново проверит каждую фразу, разделит работы, которым нужны разные
                микро-продукты, и перенесёт неоднозначное в «не ясно». Исправленное дерево станет
                новой канонической версией; прежняя версия и её отчёты останутся на диске.
              </p>
              <div className="dlg-btns">
                <button
                  className="go"
                  data-testid="needs-refine-confirm-yes"
                  onClick={() => {
                    const family = refineAsk
                    setRefineAsk(null)
                    void runRefine(family)
                  }}
                >
                  Да, перепроверить
                </button>
                <button className="act" onClick={() => setRefineAsk(null)}>Нет</button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return <TreeTable rows={rows} onOpen={setOpen} />
}

function TreeTable({ rows, onOpen }: { rows: NeedsRow[] | null; onOpen: (id: string) => void }) {
  if (rows === null) return <div className="mut">загружаем список…</div>
  return (
    <>
      <div className="hint">
        Второй слой — <b>толкование</b>: работы, которые люди хотят сделать, собранные из фраз
        первого дерева. Складывается файлами в <code>logs/needs-lab</code>, приложение их только
        показывает. Клик по строке открывает дерево.
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <Th label="узел дерева запросов" hint="Ветка первого дерева, по фразам которой собрано это толкование. Мелким снизу — id сборки: по одной ветке их может быть несколько, они не мешают друг другу." />
            <Th num label="лучший шанс" hint="Самая высокая оценка среди работ, которые ещё не разбирали. Показывает, стоит ли вообще открывать это дерево: если лучший шанс низкий, интересного внутри, скорее всего, нет." />
            <Th num label="частота" hint="Частота корневой фразы ветки по Вордстату. Это широкое соответствие: число уже включает все уточнения, поэтому складывать частоты внутри ветки нельзя." />
            <Th num label="работ" hint="Сколько работ собрала модель. Работа — это результат, которого человек хочет добиться («оживить фото»); одну работу выражают десятки формулировок." />
            <Th num label="сегм." hint="Сегменты внутри работ — более узкие потребности: другой вход, другая аудитория, другое ограничение. Именно там обычно и живёт микро-продукт." />
            <Th num label="фраз" hint="Сколько фраз ветки попало в работы и их сегменты. Остальные ушли в исключённые: вместе эти два числа дают все фразы ветки, каждую ровно один раз." />
            <Th num label="исключ." hint="Фразы, которые работой не являются: бренды (ищут конкретный продукт), каталоги («лучшие нейросети»), потребление («слушать» вместо «сделать»), сломанные запросы и фразы-условия." />
            <Th num label="щели" hint="Работы, где сборка предполагает незакрытую потребность. Это гипотеза по словам, выдачей не проверенная: разбор её либо подтвердит, либо снимет." />
            <Th num label="занято" hint="Работы, для которых сборка назвала конкретный продукт, уже закрывающий их (рядом в ветке лежат его брендовые запросы). Такие проверяют в последнюю очередь." />
            <Th num label="разобрано" hint="По скольким работам уже прошёл разбор: куплена выдача, Opus дал вердикт и написал отчёт." />
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
              data-testid="needs-row"
              onClick={() => onOpen(r.id)}
            >
              {/* название — сам узел; id сборки мелким под ним, иначе по нему ничего не понять */}
              <td>
                <div className="ph">{r.root ?? r.condition ?? '—'}</div>
                <div className="mut small">{r.id}</div>
              </td>
              <td className="num">
                <span className={'chance ' + band(r.best_score)}>{r.best_score}</span>
              </td>
              <td className="num">{fmt(r.root_freq)}</td>
              <td className="num">{r.works}</td>
              <td className="num">{r.segments}</td>
              <td className="num">{r.phrases}</td>
              <td className="num">{r.excluded}</td>
              <td className="num">{r.gaps ? <span className="gap">{r.gaps}</span> : '—'}</td>
              <td className="num">{r.occupied || '—'}</td>
              <td className="num">{r.analyzed || '—'}</td>
              <td>{r.error ? <span className="err">{r.error}</span> : fmtWhen(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

// полоса шанса: 70+ стоит смотреть, 40-69 неочевидно, ниже — вряд ли
function band(score: number | null): string {
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

function Phrases({ items }: { items: NeedsPhrase[] }) {
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

function ModelScore({ family, artifacts }: { family: ModelFamily; artifacts: NeedsArtifact[] }) {
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
  const product = latest('analyze_product')
  const title = stages
    .filter((x) => x.artifact?.verdict_score != null)
    .map(({ n, artifact }) =>
      `${n}: ${artifact?.verdict ?? '—'} ${artifact?.verdict_score ?? '—'}`,
    )
    .join(' · ')
  return (
    <>
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
      {product?.mrr6 != null && (
        <span
          className="model-mrr"
          data-testid={`needs-mrr-${family}`}
          title={`${FAMILY_LABEL[family]} · MRR на шестом месяце`}
        >
          {fmt(product.mrr6)} ₽/мес
        </span>
      )}
    </>
  )
}

function Work({
  w,
  busy,
  locked,
  onRun,
}: {
  w: NeedsWork
  busy: Set<string>
  locked: boolean
  onRun: (action: NeedsAction, work: string, done: number, family?: ModelFamily) => void
}) {
  const [open, setOpen] = useState(false)
  const segs = w.segments ?? []
  const artifacts = w.artifacts ?? []
  // Backward-compatible с уже запущенным backend без sum_freq: все частоты фраз в ответе есть.
  const sumFreq =
    w.sum_freq ??
    [...w.phrases, ...segs.flatMap((s) => s.phrases)].reduce(
      (total, phrase) => total + (phrase.freq ?? 0),
      0,
    )
  const hasNiche = artifacts.some((x) => x.kind === 'analyze')
  const linksFor = (family: ModelFamily | null) => {
    const seen: Record<string, number> = {}
    const selected = artifacts
      .filter((x) => x.report_link && artifactFamily(x) === family)
      .sort((x, y) => (x.created_at ?? 0) - (y.created_at ?? 0))
      .map((x) => {
        seen[x.kind] = (seen[x.kind] ?? 0) + 1
        return { ...x, n: seen[x.kind] }
      })
    return selected.map((x) => ({
      ...x,
      label:
        (KIND_LABEL[x.kind] ?? x.kind) +
        (selected.filter((y) => y.kind === x.kind).length > 1 ? ' ' + x.n : ''),
    }))
  }
  const basicLinks = linksFor(null)
  return (
    <div className="nwork" data-testid="needs-work">
      <div className="row">
        <button
          className="tg tg-real"
          data-testid="needs-toggle"
          title={open ? 'свернуть' : 'показать фразы и сегменты'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '−' : '+'}
        </button>
        {/* оценка сборки: шанс, что разбор найдёт незакрытую потребность. По ней и порядок. */}
        <span
          className={'chance ' + band(w.score)}
          data-testid="needs-score"
          title={w.score_why ?? 'оценка сборки: шанс найти незакрытую потребность'}
        >
          {w.score ?? '—'}
        </span>
        <span className="ph">{w.name ?? '—'}</span>
        <span
          className="fr freq-sum"
          data-testid="needs-sum-freq"
          title="сырая сумма частот всех формулировок работы, включая сегменты"
        >
          Σ {fmt(sumFreq)}
        </span>
        <span
          className="fr freq-max"
          data-testid="needs-top-freq"
          title="наибольшая частота одной формулировки в работе"
        >
          max {fmt(w.top_freq)}
        </span>
        <span className="ct" title="фраз в работе">
          {w.phrase_count ?? w.phrases.length} фраз
        </span>
        {w.unclear && (
          <span
            className="occ"
            data-testid="needs-unclear"
            title="объект понятен, результат из фраз не ясен — спрос есть, отнести не к чему"
          >
            НЕ ЯСНО
          </span>
        )}
        {w.gap_candidate && (
          <span className="gap" data-testid="needs-gap" title={w.why ?? 'кандидат в щель'}>
            ЩЕЛЬ
          </span>
        )}
        {w.occupied_by && (
          <span className="occ" data-testid="needs-occupied" title="работа похоже занята">
            занято: {w.occupied_by}
          </span>
        )}
        {w.needs_serp && !hasNiche && (
          <span className="serp" title={w.serp_question ?? 'нужна проверка выдачей'}>
            ?выдача
          </span>
        )}
        {/* По одному компактному кружку score на семейство: 1 · Ниша, 2 · Функции,
            3 · Продукт. MRR шестого месяца — отдельной зелёной колонкой рядом. */}
        {MODEL_FAMILIES.map((family) => (
          <ModelScore key={family} family={family} artifacts={artifacts} />
        ))}
        <span className="acts">
          {/* всё в одном меню: действий три, а отчётов копится сколько угодно */}
          {/* меню закрывается по любому выбору: иначе оно перекрывает соседние работы */}
          <details className="menu" data-testid="needs-menu">
            <summary className="act">Действие ▾</summary>
            <div className="menu-body" onClick={closeMenu}>
              <div className="menu-title">Basic</div>
              {BASIC_ACTIONS.map((act) => {
                const done = artifacts.filter((x) => x.kind === ARTIFACT_OF[act]).length
                const wait = busy.has(busyKey(w.name ?? '', act))
                return (
                  <button
                    key={act}
                    className="act"
                    data-testid={'needs-run-' + act}
                    disabled={locked || wait}
                    title={ACTION_HINT[act]}
                    onClick={() => w.name && onRun(act, w.name, done)}
                  >
                    {wait ? 'идёт…' : LABEL[act]}
                    {done ? ` (${done})` : ''}
                  </button>
                )
              })}
              {basicLinks.length > 0 && <div className="menu-sep">отчёты</div>}
              {basicLinks.map((x) => (
                <a
                  key={x.task_id ?? x.created_at}
                  className="act act-link"
                  data-testid={'needs-report-' + x.kind}
                  href={reportHref(x.report_link!)}
                  target="_blank"
                  rel="noreferrer"
                  title={[x.summary, fmtWhen(x.created_at)].filter(Boolean).join(' · ')}
                >
                  {x.label}
                </a>
              ))}
              {MODEL_FAMILIES.map((family) => {
                const links = linksFor(family)
                return (
                  <div className="menu-group" key={family}>
                    <div className={`menu-title model-title model-${family}`}>
                      {FAMILY_LABEL[family]}
                    </div>
                    {ANALYSIS_ACTIONS.map((act) => {
                      const done = artifacts.filter(
                        (x) => x.kind === ARTIFACT_OF[act] && artifactFamily(x) === family,
                      ).length
                      const wait = busy.has(busyKey(w.name ?? '', act, family))
                      return (
                        <button
                          key={act}
                          className="act"
                          data-testid={`needs-run-${family}-${act}`}
                          disabled={locked || wait}
                          title={ACTION_HINT[act]}
                          onClick={() => w.name && onRun(act, w.name, done, family)}
                        >
                          {wait ? 'идёт…' : LABEL[act]}
                          {done ? ` (${done})` : ''}
                        </button>
                      )
                    })}
                    {links.length > 0 && <div className="menu-sep">отчёты</div>}
                    {links.map((x) => (
                      <a
                        key={x.task_id ?? x.created_at}
                        className="act act-link"
                        data-testid={`needs-report-${family}-${x.kind}`}
                        href={reportHref(x.report_link!)}
                        target="_blank"
                        rel="noreferrer"
                        title={[x.summary, fmtWhen(x.created_at)].filter(Boolean).join(' · ')}
                      >
                        {x.label}
                      </a>
                    ))}
                  </div>
                )
              })}
            </div>
          </details>
          {[...busy].some((k) => k.startsWith((w.name ?? '') + '|')) && (
            <span className="spin" title="идёт прогон" />
          )}
        </span>
      </div>
      {open && (
        <div className="nbody">
          {w.why && <div className="nwhy">{w.why}</div>}
          {w.serp_question && (
            <div className="nwhy">
              <b>к выдаче:</b> {w.serp_question}
            </div>
          )}
          <Phrases items={w.phrases} />
          {segs.map((s) => (
            <div className="nseg" data-testid="needs-segment" key={s.name ?? Math.random()}>
              <div className="row">
                <span className="ph">└ {s.name ?? '—'}</span>
                <span className="ct">{s.phrases.length} фраз</span>
                {s.gap_candidate && (
                  <span className="gap" title={s.why ?? 'кандидат в щель'}>
                    ЩЕЛЬ
                  </span>
                )}
              </div>
              {s.why && <div className="nwhy">{s.why}</div>}
              <Phrases items={s.phrases} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TreeView({
  tree,
  busy,
  locked,
  onRun,
}: {
  tree: NeedsTree
  busy: Set<string>
  locked: boolean
  onRun: (action: NeedsAction, work: string, done: number, family?: ModelFamily) => void
}) {
  const [showEx, setShowEx] = useState(false)
  const byWhy = new Map<string, typeof tree.excluded>()
  for (const e of tree.excluded) {
    const k = e.why ?? 'other'
    byWhy.set(k, [...(byWhy.get(k) ?? []), e])
  }
  return (
    <div className="ntree" data-testid="needs-tree">
      <div className="nhead">
        <div className="nroot">
          <span className="mut">собрано по узлу дерева запросов</span>
          <b className="ph" data-testid="needs-root">
            {tree.root ?? '— (вход не сохранён)'}
          </b>
          <span className="fr">{fmt(tree.root_freq)}</span>
        </div>
        <div className="ncond" data-testid="needs-condition">
          <span className="mut">условие ветки · не ниша</span>
          <b>{tree.condition ?? '—'}</b>
          <span className="mut">
            {tree.counts.works} работ · {tree.counts.segments} сегментов · {tree.counts.phrases} фраз
            · {tree.counts.excluded} исключено · лучший шанс {tree.counts.best_score}
          </span>
        </div>
      </div>
      {/* то же, что заголовки колонок в таблице: у работы не колонки, а метки — поясняем их */}
      <div className="legend nlegend">
        <Mark sample={<span className="chance ch-high">82</span>} label="шанс"
              hint="Оценка сборки: насколько вероятно, что разбор с выдачей найдёт здесь незакрытую потребность. Ставит модель, а не формула по признакам, и именно по этому числу отсортированы работы. Выдачей оценка не проверена — разбор её либо подтвердит, либо снимет." />
        <Mark sample={<span className="fr freq-sum">Σ 18 431</span>} label="сумма частот"
              hint="Сырая сумма частот всех формулировок работы, включая сегменты. Запросы могут пересекаться, поэтому это не число уникальных пользователей." />
        <Mark sample={<span className="fr freq-max">max 11 081</span>} label="максимум"
              hint="Прежний показатель: наибольшая частота одной формулировки работы. Не содержит повторного сложения пересекающихся запросов." />
        <Mark sample={<span className="ct">15 фраз</span>} label="формулировок"
              hint="Сколько фраз ветки собрано в эту работу, включая её сегменты. Это и есть ядро ключей ниши — оно попадает в отчёт." />
        <Mark sample={<span className="gap">ЩЕЛЬ</span>} label="незакрытая потребность"
              hint="Сборка считает, что работу обслуживают плохо или не обслуживают вовсе. Гипотеза по словам: у первой же проверенной работы выдача её опровергла, поэтому метка — повод посмотреть, а не повод строить." />
        <Mark sample={<span className="occ">НЕ ЯСНО</span>} label="работа не названа"
              hint="Объект понятен, а результат из фраз не виден: «нейросеть фото» — сгенерировать? улучшить? оживить? Это реальный спрос, который не удалось отнести к работе; разбирать там нечего." />
        <Mark sample={<span className="occ">занято: …</span>} label="кто закрывает"
              hint="Сборка нашла в ветке брендовые запросы продукта, который эту работу уже делает. Такие работы проверяют в последнюю очередь." />
        <Mark sample={<span className="serp">?выдача</span>} label="нужна проверка"
              hint="Сборка сама говорит: по словам не решается, занято или нет. Это список покупок — выдача платная, и покупается она по этим отметкам." />
        <Mark sample={<span className="model-score model-claude">(30,58,27)</span>}
              label="Claude · числа: Ниша, Функции, Продукт"
              hint="Один компактный кружок хранит до трёх score по этапам 1–2–3. Старые отчёты мигрированы в Claude." />
        <Mark sample={<span className="model-score model-codex">(42,61)</span>}
              label="Codex · тот же порядок этапов"
              hint="Цвет рамки показывает семейство модели. Claude и Codex могут считать один этап одной работы параллельно и не смешивают входы Product." />
        <Mark sample={<span className="model-mrr">4 233 ₽/мес</span>}
              label="MRR на шестом месяце"
              hint="Прогноз месячной выручки из отчёта «Продукт». Деньги вынесены из кружка score в отдельную зелёную колонку." />
        <div className="verdict-key" data-testid="needs-verdict-legend">
          <table>
            <tbody>
              <tr><td><span className="vscore vscore-SKIP">30</span></td><th>SKIP</th><td>не строить</td></tr>
              <tr><td><span className="vscore vscore-MAYBE">58</span></td><th>MAYBE</th><td>сначала проверить</td></tr>
              <tr><td><span className="vscore vscore-BUILD">77</span></td><th>BUILD</th><td>можно строить</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      {tree.works.map((w) => (
        <Work
          key={w.name ?? Math.random()}
          w={w}
          busy={busy}
          locked={locked}
          onRun={onRun}
        />
      ))}
      {tree.excluded.length > 0 && (
        <div className="nex">
          <button className="act" data-testid="needs-excluded-toggle" onClick={() => setShowEx((v) => !v)}>
            {showEx ? '−' : '+'} вне дерева: {tree.excluded.length} фраз
          </button>
          {showEx && (
            <div className="nbody" data-testid="needs-excluded">
              {[...byWhy.entries()].map(([why, list]) => (
                <div className="nseg" key={why}>
                  <div className="row">
                    <span className="ph">{WHY[why] ?? why}</span>
                    <span className="ct">{list.length} фраз</span>
                  </div>
                  <Phrases items={list} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
