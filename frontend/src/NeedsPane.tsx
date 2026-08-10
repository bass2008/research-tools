import { useEffect, useRef, useState } from 'react'
import * as api from './api'
import { fmt, fmtWhen, reportHref } from './api'
import type {
  ArtifactKind,
  ModelFamily,
  NeedsAction,
  NeedsRow,
  NeedsTree,
  NeedsWork,
  TaskRow,
} from './api'
import {
  FAMILY_LABEL,
  TreeActions,
  TreeHead,
  TreeTable as SharedTreeTable,
  INTENT_LABEL,
  KIND_LABEL,
  Legend,
  MODEL_FAMILIES,
  ModelScore,
  Phrases,
  Segments,
  artifactFamily,
  band,
  closeMenu,
  errText,
} from './needsUi'

// Второй слой — толкование: классификация отделена от продуктового рейтинга. Разборы работают
// над одной работой, второй проход меняет классы, а общая команда «Анализ» только ранжирует их.

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
// три разбора переехали на группу дерева продуктов; здесь остался только smoke-test
const ANALYSIS_ACTIONS: NeedsAction[] = ['test']

const WHY: Record<string, string> = {
  brand: 'бренд — ищут вход в конкретный продукт',
  catalog: 'каталог — «покажи список»',
  consumption: 'потребление — хотят готовое, а не сделать',
  broken: 'сломанный запрос — опечатка или обрывок',
  condition: 'условие — работы не называет',
  unclear: 'результат из фразы не ясен',
  other: 'прочее',
}


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

export function NeedsPane({ active, tasks = [], onOpenTree }: {
  active: boolean
  tasks?: TaskRow[]
  onOpenTree?: (treeId: string | null) => void
}) {
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
  const [rankAsk, setRankAsk] = useState<ModelFamily | null>(null)
  const [rankTask, setRankTask] = useState<string | null>(null)
  const [branchAsk, setBranchAsk] = useState<ModelFamily | null>(null)
  const [branchTask, setBranchTask] = useState<string | null>(null)
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({})
  const statuses = useRef(new Map<string, string>())

  useEffect(() => {
    if (!active || rows) return
    api
      .needsTrees()
      .then((r) => setRows(r.trees))
      .catch((e) => setErr(errText(e)))
  }, [active, rows])

  useEffect(() => {
    onOpenTree?.(open)
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
    if (rankTask && ['DONE', 'FAILED'].includes(seen.get(rankTask) ?? '')) {
      setRankTask(null)
    }
    if (branchTask && ['DONE', 'FAILED'].includes(seen.get(branchTask) ?? '')) {
      setBranchTask(null)
    }
  }, [tasks, open, refineTask, rankTask, branchTask])

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
  const rankBusy = Boolean(rankTask) || tasks.some(
    (t) => t.type === 'needs_rank' && t.node === open &&
      ['QUEUED', 'WAITING', 'RUNNING'].includes(t.status),
  )
  const branchBusy = Boolean(branchTask) || tasks.some(
    (t) => t.type === 'needs_products' && t.node === open &&
      ['QUEUED', 'WAITING', 'RUNNING'].includes(t.status),
  )
  const treeBusy = refineBusy || rankBusy || branchBusy

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

  async function runRank(family: ModelFamily) {
    if (!open) return
    try {
      const { task_id } = await api.needsRank(open, family)
      setRankTask(task_id)
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  async function runProducts(family: ModelFamily) {
    if (!open) return
    try {
      const { task_id } = await api.needsProducts(open, family)
      setBranchTask(task_id)
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  async function toggleFavorite(work: string, favorite: boolean) {
    if (!open) return
    setFavoriteBusy((current) => ({ ...current, [work]: true }))
    try {
      const result = await api.needsFavorite(open, work, favorite)
      setTree((current) => current && ({
        ...current,
        works: current.works.map((item) =>
          item.name === result.work ? { ...item, favorite: result.favorite } : item,
        ),
      }))
      setErr('')
    } catch (e) {
      setErr(errText(e))
    } finally {
      setFavoriteBusy((current) => {
        const next = { ...current }
        delete next[work]
        return next
      })
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
        <TreeHead
          onBack={() => setOpen(null)}
          backLabel="← Назад"
          backTestId="needs-back"
          root={tree?.root ?? null}
          condition={tree?.condition}
          rootTestId="needs-branch"
          meta={[
            `сборка ${open}`,
            `классификация v${tree?.revision ?? 0}`,
            tree?.refined_by && `уточнено: ${FAMILY_LABEL[tree.refined_by]} · ${fmtWhen(tree.refined_at)}`,
            tree?.ranked_by && `ранги: ${FAMILY_LABEL[tree.ranked_by]} · ${fmtWhen(tree.ranked_at)}`,
          ].filter(Boolean).join('\n')}
          actions={
          <TreeActions
            disabled={treeBusy || !tree}
            items={MODEL_FAMILIES.flatMap((family) => [
              {
                key: `refine-${family}`,
                family,
                testId: `needs-refine-${family}`,
                label: 'Уточнить дерево потребностей',
                busy: refineBusy,
                busyLabel: 'Уточняю…',
                hint: 'Перепроверить все фразы, склеить лишне разрезанные работы, разделить склеенные и убрать неоднозначные фразы в «не ясно». Меняет ревизию классификации: дерево продуктов и разборы под ним обесценятся.',
                onClick: () => setRefineAsk(family),
              },
              {
                key: `rank-${family}`,
                family,
                testId: `needs-rank-${family}`,
                label: 'Анализ рангов',
                busy: rankBusy,
                busyLabel: 'Ранжирую…',
                hint: 'Оценить физическую возможность самостоятельного продукта по шести факторам и разметить интент. Выдача и конкуренты не используются; ранг виден кружком на строке работы.',
                onClick: () => setRankAsk(family),
              },
              {
                key: `products-${family}`,
                family,
                testId: `needs-products-${family}`,
                label: 'Собрать дерево продуктов',
                busy: branchBusy,
                busyLabel: 'Собираю продукты…',
                hint: 'Разложить работы ветки в продукты на трёх вложенных масштабах: микро ⊂ средний ⊂ комплексный. Результат — во вкладке «Дерево продуктов».',
                onClick: () => setBranchAsk(family),
              },
            ])}
          />
          }
        />
        {tree ? (
          <TreeView
            tree={tree}
            busy={busyWorks}
            locked={treeBusy}
            favoriteBusy={favoriteBusy}
            onFavorite={toggleFavorite}
            onRun={start}
          />
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
        {rankAsk && (
          <div className="modal">
            <div className="dlg" data-testid="needs-rank-confirm">
              <b>{FAMILY_LABEL[rankAsk]} · анализ возможности продукта</b>
              <p>
                Opus/Sol перечитает принятую классификацию целиком и оценит каждую работу по
                шести факторам: контроль результата сторонним продуктом, инструментальный интент,
                ясность результата, форма продукта, повторяемость и ценность. Выдача и конкуренты
                не используются. Результат задаст порядок работ, классификацию не изменит.
              </p>
              <div className="dlg-btns">
                <button
                  className="go"
                  data-testid="needs-rank-confirm-yes"
                  onClick={() => {
                    const family = rankAsk
                    setRankAsk(null)
                    void runRank(family)
                  }}
                >
                  Да, анализировать
                </button>
                <button className="act" onClick={() => setRankAsk(null)}>Нет</button>
              </div>
            </div>
          </div>
        )}
        {branchAsk && (
          <div className="modal">
            <div className="dlg" data-testid="needs-products-confirm">
              <b>{FAMILY_LABEL[branchAsk]} · собрать дерево продуктов</b>
              <p>
                Разложит работы ветки в продукты на трёх масштабах — микро ⊂ средний ⊂
                комплексный. У каждой группы: один вход, один движок, рынок по головным
                контейнерам и модель денег. Покрытие полное: работа, которая ни с чем не
                склеивается, станет отдельным микропродуктом. Выдача не покупается,
                классификацию не меняет. Результат — во вкладке «Дерево продуктов».
              </p>
              {tree?.products?.groups?.length ? (
                <p className="warn" data-testid="needs-products-warn">
                  Дерево продуктов уже собрано: {tree.products.groups.length} групп. Новая
                  раскладка заменит текущую, а <b>разборы групп, которых в ней не окажется, будут
                  удалены вместе с отчётами</b> — id групп придумывает модель и между прогонами
                  они не стабильны. Прежний файл группировки останется на диске.
                </p>
              ) : null}
              <div className="dlg-btns">
                <button
                  className="go"
                  data-testid="needs-products-confirm-yes"
                  onClick={() => {
                    const family = branchAsk
                    setBranchAsk(null)
                    void runProducts(family)
                  }}
                >
                  Да, собрать продукты
                </button>
                <button className="act" onClick={() => setBranchAsk(null)}>Нет</button>
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
  return (
    <SharedTreeTable
      rows={rows}
      onOpen={onOpen}
      rowTestId="needs-row"
      hint={
        <>
          Второй слой — <b>толкование</b>: работы, которые люди хотят сделать, собранные из фраз
          первого дерева. Классификация и отдельный продуктовый анализ складываются файлами в{' '}
          <code>logs/needs-lab</code>. Клик по строке открывает дерево.
        </>
      }
    />
  )
}

function Work({
  w,
  busy,
  locked,
  favoriteBusy,
  onFavorite,
  onRun,
}: {
  w: NeedsWork
  busy: Set<string>
  locked: boolean
  favoriteBusy: boolean
  onFavorite: (work: string, favorite: boolean) => void
  onRun: (action: NeedsAction, work: string, done: number, family?: ModelFamily) => void
}) {
  const [open, setOpen] = useState(false)
  const segs = w.segments ?? []
  const artifacts = w.artifacts ?? []
  const sumFreq = w.sum_freq
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
        {w.score != null && (
          <span
            className={'chance ' + band(w.score)}
            data-testid="needs-score"
            title={w.score_why ?? 'физическая возможность самостоятельного продукта'}
          >
            {w.score}
          </span>
        )}
        <span className="ph">{w.name ?? '—'}</span>
        {(w.intent || w.product) && (
          <span className="intent-group">
            {w.intent && (
              <span className="occ" data-testid="needs-intent" title={w.blocker ?? w.score_why ?? ''}>
                {INTENT_LABEL[w.intent]}
              </span>
            )}
            {w.product && (
              <span
                className="q product-help"
                data-testid="needs-product"
                title={w.product}
                aria-label={`Возможная форма продукта: ${w.product}`}
              >
                ?
              </span>
            )}
          </span>
        )}
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
          {/* лайк — последним в строке, правее «Действие»: это отметка, а не команда */}
          <button
            type="button"
            className={'favorite ' + (w.favorite ? 'on' : '')}
            data-testid="needs-favorite"
            aria-label={w.favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            aria-pressed={Boolean(w.favorite)}
            title={w.favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            disabled={locked || favoriteBusy || !w.name}
            onClick={() => w.name && onFavorite(w.name, !w.favorite)}
          >
            {w.favorite ? '♥' : '♡'}
          </button>
        </span>
      </div>
      {open && (
        <div className="nbody">
          {w.why && <div className="nwhy">{w.why}</div>}
          {w.score_why && <div className="nwhy"><b>анализ:</b> {w.score_why}</div>}
          {w.evidence?.length ? (
            <div className="nwhy"><b>опорные фразы:</b> {w.evidence.join(' · ')}</div>
          ) : null}
          <Phrases items={w.phrases} />
          <Segments items={segs} />
        </div>
      )}
    </div>
  )
}

function TreeView({
  tree,
  busy,
  locked,
  favoriteBusy,
  onFavorite,
  onRun,
}: {
  tree: NeedsTree
  busy: Set<string>
  locked: boolean
  favoriteBusy: Record<string, boolean>
  onFavorite: (work: string, favorite: boolean) => void
  onRun: (action: NeedsAction, work: string, done: number, family?: ModelFamily) => void
}) {
  const [showEx, setShowEx] = useState(false)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const favoriteCount = tree.works.filter((work) => work.favorite).length
  const visibleWorks = favoritesOnly ? tree.works.filter((work) => work.favorite) : tree.works
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
            · {tree.counts.excluded} исключено
            {tree.counts.best_score == null
              ? ' · продуктовый анализ не запускался'
              : ` · лучший шанс продукта ${tree.counts.best_score}`}
          </span>
        </div>
      </div>
      {/* то же, что заголовки колонок в таблице: у работы не колонки, а метки — поясняем их */}
      <Legend ranked={Boolean(tree.ranked_at)} unit="работы" />
      <div className="favorite-tools">
        <button
          type="button"
          className={'act favorite-filter ' + (favoritesOnly ? 'on' : '')}
          data-testid="needs-favorites-only"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((value) => !value)}
        >
          {favoritesOnly ? 'Показать все' : `Показать только избранное (${favoriteCount})`}
        </button>
      </div>
      {favoritesOnly && visibleWorks.length === 0 && (
        <div className="empty favorite-empty" data-testid="needs-favorites-empty">
          Избранных работ пока нет
        </div>
      )}
      {visibleWorks.map((w) => (
        <Work
          key={w.name ?? Math.random()}
          w={w}
          busy={busy}
          locked={locked}
          favoriteBusy={Boolean(w.name && favoriteBusy[w.name])}
          onFavorite={onFavorite}
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
