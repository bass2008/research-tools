import { useEffect, useRef, useState } from 'react'
import * as api from './api'
import { fmt, fmtWhen, reportHref } from './api'
import type {
  ArtifactKind,
  ModelFamily,
  NeedsRow,
  NeedsTree,
  ProductGroup,
  ProductLevel,
  TaskRow,
} from './api'
import {
  FAMILY_LABEL,
  INTENT_LABEL,
  KIND_LABEL,
  Legend,
  MODEL_FAMILIES,
  ModelScore,
  Phrases,
  Segments,
  TreeActions,
  TreeHead,
  TreeTable as SharedTreeTable,
  artifactFamily,
  band,
  closeMenu,
  errText,
} from './needsUi'

// Третий слой — это дерево потребностей плюс один уровень сверху: продукт → потребность →
// ключи. Вся общая вёрстка (строки, легенда, кружки оценок, таблица веток) живёт в `needsUi`,
// здесь только то, что действительно отличается: уровни группировки и то, что действия с лайком
// стоят на продукте, а не на потребности.

const LEVEL_LABEL: Record<ProductLevel, string> = {
  micro: 'Микропродукты',
  medium: 'Средние',
  macro: 'Комплексные',
}

const LEVEL_HINT: Record<ProductLevel, string> = {
  micro: 'Минимальный самостоятельный продукт: одна дверь, недели работы.',
  medium: 'Связка микропродуктов вокруг общего движка.',
  macro: 'Комплексный продукт со всеми фичами ветки.',
}

const LEVELS: ProductLevel[] = ['macro', 'medium', 'micro']

const ACTIONS = ['analyze', 'analyze_adv', 'product', 'dump'] as const
type Action = (typeof ACTIONS)[number]
const BY_FAMILY: Action[] = ['analyze', 'analyze_adv', 'product']
const BASIC: Action[] = ['dump']

const LABEL: Record<Action, string> = {
  analyze: '1 · Ниша',
  analyze_adv: '2 · Функции',
  product: '3 · Спецификация',
  dump: 'Выгрузка TOP 10',
}

const ACTION_HINT: Record<Action, string> = {
  analyze:
    'РЫНОК И ТРАФИК. Отвечает: можно ли перехватить поисковый трафик этого продукта и кто его уже держит. Единица ответа — продукт целиком, оценка считается как спрос ÷ конкуренция. Требует назвать, что продаём, кому и почему купят у нас, плюс помесячную прикидку до шестого месяца. ~7 минут, 2 платных запроса (повтор по купленной выдаче бесплатен).',
  analyze_adv:
    'ЧТО МОЖНО СДЕЛАТЬ. Отвечает: какие функции есть внутри продукта, у какой есть вход из поиска и кто за неё платит. Занятость тут не минус, а доказательство спроса; статьи в топе — улика, что инструмента нет. Выдача из кэша — бесплатно.',
  product:
    'ЧТО СТРОИМ. Спецификация продукта: кто пользователь, что получает за минуту, цена и модель оплаты, почему заплатят, откуда первые сто пользователей, что НЕ входит в первую версию, срок и недельная проверка без кода. Плюс ПРОГНОЗ ПРОДАЖ на 1/2/3/6 месяц, потолок, бюджет и окупаемость. Стоимость движка и контента считает этот шаг по выдаче — группировка её не оценивает. Бесплатно.',
  dump:
    'СКАЧАТЬ ТОП-10 СТРАНИЦАМИ по дверям этого продукта — в reports/<группа>/yandex и /google. Нужна, чтобы разборы проверяли цены и пейволлы по самим страницам, а не по сниппетам: сниппет обещает «бесплатно», а на странице стоит форма регистрации. Берёт пять РАЗНЫХ углов (головная фраза продукта, фраза кандидата из «Функций», «как это делают руками», «бесплатно», коммерческая). LLM не нужна, до 10 платных запросов за выдачу. Запускать ДО «Спецификации».',
}

const ARTIFACT_OF: Record<Action, ArtifactKind> = {
  analyze: 'analyze',
  analyze_adv: 'analyze_adv',
  product: 'analyze_product',
  dump: 'dump',
}

const busyKey = (group: string, action: Action, family?: ModelFamily) =>
  `${group}|${action}|${family ?? 'basic'}`

/** Дерево продуктов: продукты одного уровня, внутри — потребности, внутри них — ключи. */
export function ProductsPane({
  active,
  treeId,
  tasks = [],
}: {
  active: boolean
  treeId?: string | null
  tasks?: TaskRow[]
}) {
  const [tree, setTree] = useState<NeedsTree | null>(null)
  const [rows, setRows] = useState<NeedsRow[] | null>(null)
  // своя ветка: вкладка не должна зависеть от того, открыл ли человек что-то в «Потребностях»
  const [picked, setPicked] = useState<string | null>(null)
  const [level, setLevel] = useState<ProductLevel>('macro')
  const [onlyFavorite, setOnlyFavorite] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<Record<string, string>>({})
  const [favoriteBusy, setFavoriteBusy] = useState<Record<string, boolean>>({})
  const [rebuildAsk, setRebuildAsk] = useState<ModelFamily | null>(null)
  const statuses = useRef(new Map<string, string>())

  const openId = picked ?? treeId ?? null

  useEffect(() => {
    if (!active || openId) return
    api.needsTrees().then((r) => setRows(r.trees)).catch((e) => setErr(errText(e)))
  }, [active, openId])

  useEffect(() => {
    if (!active || !openId) return
    api.needsTree(openId).then(setTree).catch((e) => setErr(errText(e)))
  }, [active, openId])

  // финал чужой задачи второго слоя перечитывает дерево: вердикт и ссылка лежат файлом рядом
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
    if (openId) api.needsTree(openId).then(setTree).catch((e) => setErr(errText(e)))
  }, [tasks, openId])

  const groupBusy = tasks.some(
    (t) => t.type === 'needs_products' && ['QUEUED', 'WAITING', 'RUNNING'].includes(t.status),
  )

  async function rebuild(family: ModelFamily) {
    if (!openId) return
    try {
      await api.needsProducts(openId, family)
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  async function run(action: Action, group: string, family?: ModelFamily) {
    if (!openId) return
    try {
      const { task_id } = await api.needsRunGroup(action, openId, group, family)
      setBusy((b) => ({ ...b, [busyKey(group, action, family)]: task_id }))
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  async function toggleFavorite(group: string, favorite: boolean) {
    if (!openId) return
    setFavoriteBusy((c) => ({ ...c, [group]: true }))
    try {
      await api.needsFavoriteGroup(openId, group, favorite)
      setTree((cur) => cur && ({
        ...cur,
        products: cur.products && {
          ...cur.products,
          groups: cur.products.groups.map((g) => (g.id === group ? { ...g, favorite } : g)),
        },
      }))
      setErr('')
    } catch (e) {
      setErr(errText(e))
    } finally {
      setFavoriteBusy((c) => ({ ...c, [group]: false }))
    }
  }

  if (!openId) {
    return (
      <SharedTreeTable
        rows={rows}
        onOpen={setPicked}
        rowTestId="products-tree-row"
        hint={
          <>
            Третий слой — <b>продукты</b>: работы второго дерева, сгруппированные в кандидаты на
            трёх вложенных масштабах (микро ⊂ средний ⊂ комплексный). Покрытие полное: работа,
            которая ни с чем не склеивается, становится отдельным микропродуктом. Клик по строке
            открывает дерево продуктов ветки.
          </>
        }
      />
    )
  }
  if (!tree) return <div className="mut">загружаем…</div>

  const products = tree.products
  const all = products?.groups ?? []
  const liked = all.filter((g) => g.favorite).length
  const withReports = all.filter((g) => (g.artifacts ?? []).length).length
  const reportCount = all.reduce((n, g) => n + (g.artifacts ?? []).length, 0)
  const shown = all.filter((g) => g.level === level && (!onlyFavorite || g.favorite))
  return (
    <>
      {err && (
        <div className="cerr" data-testid="products-error">
          {err}
        </div>
      )}
      <TreeHead
        onBack={() => setPicked(null)}
        backLabel="← Назад"
        backTestId="products-back"
        root={tree.root}
        condition={tree.condition}
        rootTestId="products-root"
        meta={products ? [
          `собрано ${fmtWhen(products.created_at)}`,
          FAMILY_LABEL[products.model_family ?? 'claude'],
          `ревизия ${products.tree_revision}`,
        ].join(' · ') : undefined}
        actions={
        <TreeActions
          disabled={groupBusy}
          items={[
            ...(products?.report_link ? [{
              key: 'products-report',
              testId: 'products-report',
              label: 'Отчёт группировки',
              hint: 'Как ветка раскладывается на продукты и почему именно так: состав групп, пулы по контейнерам, модели денег.',
              href: reportHref(products.report_link),
            }] : []),
          ...MODEL_FAMILIES.map((family) => ({
            key: `rebuild-${family}`,
            family,
            testId: `products-rebuild-${family}`,
            label: 'Собрать заново',
            busy: groupBusy,
            busyLabel: 'Собираю продукты…',
            hint: 'Разложить работы ветки в продукты на трёх масштабах заново. Разборы групп, которых в новой раскладке не окажется, удаляются вместе с их отчётами: id групп придумывает модель и между прогонами они не стабильны.',
            onClick: () => setRebuildAsk(family),
          }))]}
        />
        }
      />
      {!products && (
        <div className="mut" data-testid="products-none">
          дерево продуктов ещё не собрано — нажмите «Пересобрать» или «Продукты» во вкладке
          «Дерево потребностей»
        </div>
      )}

      {products && (
        <>
          <Legend ranked={all.some((g) => g.best_score != null)} unit="продукты" />
          <div className="favorite-tools">
            <button
              type="button"
              className={'act' + (onlyFavorite ? ' on' : '')}
              data-testid="products-favorites-only"
              disabled={!liked}
              onClick={() => setOnlyFavorite((v) => !v)}
            >
              {onlyFavorite ? 'Показать все' : 'Только избранные'} ({liked})
            </button>
          </div>
          <div className="bar-row" data-testid="products-levels">
            {LEVELS.map((lvl) => {
              const n = all.filter((g) => g.level === lvl).length
              return (
                <button
                  key={lvl}
                  className={'act' + (lvl === level ? ' on' : '')}
                  data-testid={`products-level-btn-${lvl}`}
                  title={LEVEL_HINT[lvl]}
                  onClick={() => setLevel(lvl)}
                >
                  {LEVEL_LABEL[lvl]} <span className="mut sm">{n}</span>
                </button>
              )
            })}
          </div>
          {products.why && <div className="nwhy" data-testid="products-why">{products.why}</div>}
          <section data-testid={`products-level-${level}`}>
            {shown.map((g) => (
              <Group
                key={g.id}
                g={g}
                busy={busy}
                favoriteBusy={Boolean(favoriteBusy[g.id])}
                onFavorite={toggleFavorite}
                onRun={run}
              />
            ))}
          </section>
        </>
      )}

      {rebuildAsk && (
        <div className="modal">
          <div className="dlg" data-testid="products-rebuild-confirm">
            <b>{FAMILY_LABEL[rebuildAsk]} · собрать дерево продуктов заново</b>
            <p>
              Новая раскладка заменит текущую: {all.length} групп на трёх уровнях. Прежний файл
              группировки останется на диске, показываться будет новый.
            </p>
            <p className="warn" data-testid="products-rebuild-warn">
              <b>Разборы групп, которых в новой раскладке не окажется, будут удалены вместе с
              отчётами.</b> Сейчас разборы есть у {withReports} из {all.length} групп — всего{' '}
              {reportCount} отчётов. Id групп придумывает модель, и между прогонами они не
              стабильны: в прошлый раз совпал один из тридцати двух.
            </p>
            <div className="dlg-btns">
              <button
                className="go"
                data-testid="products-rebuild-confirm-yes"
                onClick={() => {
                  const family = rebuildAsk
                  setRebuildAsk(null)
                  void rebuild(family)
                }}
              >
                Да, собрать заново
              </button>
              <button className="act" onClick={() => setRebuildAsk(null)}>Нет</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Продукт: та же строка, что у работы в «Потребностях» — на ней действия и лайк. */
function Group({
  g,
  busy,
  favoriteBusy,
  onFavorite,
  onRun,
}: {
  g: ProductGroup
  busy: Record<string, string>
  favoriteBusy: boolean
  onFavorite: (group: string, favorite: boolean) => void
  onRun: (action: Action, group: string, family?: ModelFamily) => void
}) {
  const [open, setOpen] = useState(false)
  const artifacts = g.artifacts ?? []
  const works = g.work_items ?? []
  const linksFor = (family: ModelFamily | null) =>
    artifacts
      .filter((x) => x.report_link && artifactFamily(x) === family)
      .sort((x, y) => (x.created_at ?? 0) - (y.created_at ?? 0))
      .map((x) => ({ ...x, label: `${KIND_LABEL[x.kind] ?? x.kind} · ${fmtWhen(x.created_at)}` }))

  return (
    <div className="nwork" data-testid="product-group">
      <div className="row">
        <button
          className="tg tg-real"
          data-testid="product-toggle"
          title={open ? 'свернуть' : 'показать потребности и ключи'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '−' : '+'}
        </button>
        {g.best_score != null && (
          <span
            className={'chance ' + band(g.best_score)}
            data-testid="product-best-score"
            title="лучший шанс продукта среди потребностей этой группы"
          >
            {g.best_score}
          </span>
        )}
        <span className="ph">{g.name ?? g.id}</span>
        <span className="intent-group">
          <span className="occ" data-testid="product-works-count" title={g.why ?? ''}>
            {(g.works ?? []).length} потребн.
          </span>
          <span
            className="q product-help"
            data-testid="product-io"
            title={`${g.input} → ${g.engine} → ${g.output}\n\nДеньги: ${g.money ?? '—'}`}
            aria-label={`Вход и движок: ${g.input} → ${g.engine}`}
          >
            ?
          </span>
        </span>
        <span
          className="fr freq-sum"
          data-testid="product-pool"
          title={g.pool_why ?? 'пул по головным контейнерам'}
        >
          пул {fmt(g.pool)}
        </span>
        <span
          className="fr freq-max"
          data-testid="product-sum-freq"
          title="сырая сумма частот всех фраз продукта"
        >
          Σ {fmt(g.sum_freq)}
        </span>
        <span className="ct" title="фраз в продукте">{fmt(g.phrase_count)} фраз</span>
        {MODEL_FAMILIES.map((family) => (
          <ModelScore key={family} family={family} artifacts={artifacts} />
        ))}
        <span className="acts">
          <details className="menu" data-testid="product-menu">
            <summary className="act">Действие ▾</summary>
            <div className="menu-body" onClick={closeMenu}>
              <div className="menu-title">Basic</div>
              {BASIC.map((act) => {
                const runs = artifacts.filter((x) => x.kind === ARTIFACT_OF[act]).length
                const wait = Boolean(busy[busyKey(g.id, act)])
                return (
                  <button
                    key={act}
                    className="act"
                    data-testid={`product-run-${act}`}
                    disabled={wait}
                    title={ACTION_HINT[act]}
                    onClick={() => onRun(act, g.id)}
                  >
                    {wait ? 'идёт…' : LABEL[act]}
                    {runs ? ` (${runs})` : ''}
                  </button>
                )
              })}
              {linksFor(null).length > 0 && <div className="menu-sep">отчёты</div>}
              {linksFor(null).map((x) => (
                <a
                  key={x.task_id ?? x.created_at}
                  className="act act-link"
                  data-testid={`product-report-${x.kind}`}
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
                    {BY_FAMILY.map((act) => {
                      const runs = artifacts.filter(
                        (x) => x.kind === ARTIFACT_OF[act] && artifactFamily(x) === family,
                      ).length
                      const wait = Boolean(busy[busyKey(g.id, act, family)])
                      return (
                        <button
                          key={act}
                          className="act"
                          data-testid={`product-run-${family}-${act}`}
                          disabled={wait}
                          title={ACTION_HINT[act]}
                          onClick={() => onRun(act, g.id, family)}
                        >
                          {wait ? 'идёт…' : LABEL[act]}
                          {runs ? ` (${runs})` : ''}
                        </button>
                      )
                    })}
                    {links.length > 0 && <div className="menu-sep">отчёты</div>}
                    {links.map((x) => (
                      <a
                        key={x.task_id ?? x.created_at}
                        className="act act-link"
                        data-testid={`product-report-${family}-${x.kind}`}
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
          {/* лайк — последним в строке, как у работы: это отметка, а не команда */}
          <button
            type="button"
            className={'favorite ' + (g.favorite ? 'on' : '')}
            data-testid="product-favorite"
            aria-label={g.favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            aria-pressed={Boolean(g.favorite)}
            title={g.favorite ? 'Убрать из избранного' : 'Добавить в избранное'}
            disabled={favoriteBusy}
            onClick={() => onFavorite(g.id, !g.favorite)}
          >
            {g.favorite ? '♥' : '♡'}
          </button>
        </span>
      </div>
      {open && (
        <div className="nbody">
          {g.why && <div className="nwhy">{g.why}</div>}
          <div className="nwhy sm">
            <b>вход → движок → выход:</b> {g.input} → {g.engine} → {g.output}
          </div>
          <div className="nwhy sm"><b>деньги:</b> {g.money}</div>
          {g.pool_why && <div className="nwhy sm"><b>пул:</b> {g.pool_why}</div>}
          {g.core && <div className="nwhy sm"><b>ядро:</b> {g.core}</div>}
          {g.order?.length ? (
            <div className="nwhy sm"><b>порядок:</b> {g.order.join(' → ')}</div>
          ) : null}
          {works.map((w) => (
            <Work key={w.name} w={w} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Потребность внутри продукта: та же строка, но без действий и лайка — они на продукте. */
function Work({ w }: { w: ProductGroup['work_items'][number] }) {
  const [open, setOpen] = useState(false)
  const sections = w.sections ?? []
  const phrases = w.phrases ?? []
  return (
    <div className="nwork nwork-nested" data-testid="product-work">
      <div className="row">
        <button
          className="tg tg-real"
          data-testid="product-work-toggle"
          title={open ? 'свернуть' : 'показать ключи потребности'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '−' : '+'}
        </button>
        {w.score != null && (
          <span className={'chance ' + band(w.score)} title="шанс самостоятельного продукта">
            {w.score}
          </span>
        )}
        <span className="ph">{w.name}</span>
        {w.intent && (
          <span className="intent-group">
            <span className="occ" title={w.blocker ?? ''}>
              {INTENT_LABEL[w.intent] ?? w.intent}
            </span>
          </span>
        )}
        <span className="fr freq-sum" title="сырая сумма частот всех фраз потребности">
          Σ {fmt(w.sum_freq)}
        </span>
        <span className="fr freq-max" title="наибольшая частота одной формулировки">
          max {fmt(w.top_freq)}
        </span>
        <span className="ct" title="фраз в потребности">{fmt(w.phrase_count)} фраз</span>
        {w.unclear && (
          <span className="occ" title="объект понятен, результат из фраз не ясен">НЕ ЯСНО</span>
        )}
      </div>
      {open && (
        <div className="nbody">
          {w.why && <div className="nwhy">{w.why}</div>}
          <Phrases items={phrases} />
          <Segments items={sections} />
        </div>
      )}
    </div>
  )
}
