// API-слой: команды — HTTP POST (tech §6.1), чтение — WebSocket /ws (tech §6.2).
// Чтение не мутирует: root/expand только проецируют уже загруженное, ничего не догружают.

// Дерево запросов — только загрузка. Выводы (интент, конкуренция, разбор ниши) переехали во
// второй слой, где единица — работа; поэтому статусов три, а не одиннадцать.
export type Status = 'NEW' | 'LOADED' | 'FULLY_LOADED'
// WAITING — джоб отдан в очередь LLM, но исполнитель его ещё не взял: сервер свою
// часть сделал, работы никто не делает. RUNNING = работа реально идёт.
export type TaskStatus = 'QUEUED' | 'WAITING' | 'RUNNING' | 'DONE' | 'FAILED'
export type ModelFamily = 'claude' | 'codex'

// Объект узла (tech §6.2). children — ЛОКАЛЬНЫЕ дети из пула родителя (вложенность
// по словам), приходят вместе с родителем; реальные дети — событием children.
export interface Node {
  phrase: string
  freq: number | null
  status: Status
  task_id: string | null // ≠ null -> узел занят операцией
  error: string | null
  cached: boolean // фраза запрашивалась отдельно -> есть свой (глубже) пул
  childCount: number // реальных уточнений в кэше
  children?: Node[]
}

/** SEO-домен: ручной набор входных веток одного сайта. */
export interface Domain {
  id: string
  name: string
  members: Node[]
}

export interface LogLine {
  ts: number
  level: string
  stage: string | null
  node: string | null
  msg: string
}

export interface TaskRow {
  id: string
  type: string
  node: string | null
  status: TaskStatus
  created_at: number | null
  started_at: number | null
  finished_at: number | null
  error: string | null
  model_family?: ModelFamily | null
}

// Отчёт принадлежит РАБОТЕ второго слоя, а не узлу дерева запросов.
export interface ReportRow {
  tree_id: string
  kind: string
  /** Единица отчёта — группа дерева продуктов. */
  group: string
  name: string
  level: ProductLevel | null
  root: string | null
  condition: string | null
  pool: number | null
  phrases: number | null
  verdict: string | null
  verdict_score: number | null
  confidence: number | null
  report_link: string | null
  created_at: number | null
  model_family?: ModelFamily | null
}

export const needsReports = (): Promise<{ reports: ReportRow[] }> => req('/api/needs/reports')

export interface Progress {
  stage: string
  node: string | null
  done: number
  total: number
}

export interface LlmFamilyStatus {
  online: boolean
  last_seen_at: number | null
}

export interface LlmStatus extends LlmFamilyStatus {
  families?: Record<ModelFamily, LlmFamilyStatus>
}

export interface Estimate {
  nodes: number
  requests: number
}

// Сервер -> клиент, конверт {type, data}. Список/одиночка допускаются там, где сервер
// может прислать пачку (хвост лога, накопленные задачи и отчёты при подписке).
export type WsEvent =
  | { type: 'roots'; data: { roots: Node[]; domains?: Domain[] } }
  // root: null — такой фразы в дереве нет (в `missing` то, что искали)
  | { type: 'snapshot'; data: { root: Node | null; missing?: string; children: Node[] } }
  | { type: 'children'; data: { parent: string; children: Node[] } }
  | { type: 'node'; data: Partial<Node> & { phrase: string } }
  | { type: 'progress'; data: Progress }
  | { type: 'log'; data: LogLine | LogLine[] }
  | { type: 'task'; data: TaskRow | TaskRow[] }
  | { type: 'log_cleared'; data: Record<string, never> }
  | { type: 'tasks_cleared'; data: Record<string, never> }
  | { type: 'llm_status'; data: LlmStatus }

// Клиент -> сервер.
export type WsAction =
  | { action: 'subscribe' }
  | { action: 'root'; phrase: string }
  | { action: 'expand'; phrase: string }

export type ConnState = 'connecting' | 'open' | 'closed'

export interface Conn {
  send(a: WsAction): void
  close(): void
}

// В бою фронт раздаёт тот же сервер, что и /ws; для отдельного дев-сервера — VITE_WS_URL.
function wsUrl(): string {
  const env = import.meta.env.VITE_WS_URL
  if (env) return String(env)
  return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'
}

/** WS-клиент с реконнектом и бэкоффом. onOpen — место для subscribe/root после (пере)подключения. */
export function connect(
  onEvent: (ev: WsEvent) => void,
  onState: (s: ConnState) => void,
  onOpen?: () => void,
): Conn {
  let sock: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let delay = 500 // бэкофф 0.5с -> ×1.8 -> потолок 10с, сбрасывается на успешном открытии
  let dead = false
  const queue: WsAction[] = [] // отправленное, пока канал был закрыт

  function open() {
    onState('connecting')
    const s = new WebSocket(wsUrl())
    sock = s
    s.onopen = () => {
      delay = 500
      onState('open')
      onOpen?.()
      while (queue.length) s.send(JSON.stringify(queue.shift()))
    }
    s.onmessage = (e) => {
      try {
        const ev = JSON.parse(String(e.data)) as WsEvent
        if (ev && ev.type) onEvent(ev)
      } catch {
        // мусор в канале игнорируем — рвать соединение из-за одной строки незачем
      }
    }
    s.onclose = () => {
      sock = null
      if (dead) return
      onState('closed')
      timer = setTimeout(open, delay)
      delay = Math.min(Math.round(delay * 1.8), 10000)
    }
  }

  open()
  return {
    send(a) {
      if (sock && sock.readyState === WebSocket.OPEN) sock.send(JSON.stringify(a))
      else queue.push(a)
    },
    close() {
      dead = true
      if (timer) clearTimeout(timer)
      sock?.close()
    },
  }
}

// ---------- команды (HTTP) ----------

/** Ошибка команды: 404 (нет узла), 409 (занят узел или предок), 422 (переход недопустим). */
export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, error: string, detail: string) {
    super(error)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function req(path: string, init?: RequestInit) {
  const r = await fetch(path, init)
  const data = await r.json().catch(() => null)
  if (!r.ok) {
    // тело ошибки одинаковое: {error, detail}
    const error = (data && data.error) || `HTTP ${r.status}`
    throw new ApiError(r.status, String(error), data && data.detail ? String(data.detail) : '')
  }
  return data
}

const post = (path: string, body: unknown = {}) =>
  req(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const del = (path: string, body: unknown = {}) =>
  req(path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/** Новый корень дерева запросов: заводит узел и грузит его пул. Корни независимы. */
export const addRoot = (phrase: string): Promise<{ task_id: string }> =>
  post('/api/node/root', { phrase })

export const loadNode = (phrase: string): Promise<{ task_id: string }> =>
  post('/api/node/load', { phrase })

export const fullLoad = (phrase: string): Promise<{ task_id: string }> =>
  post('/api/node/full-load', { phrase })

/** Сборка дерева потребностей по ветке — замена узловым classify/drill. */
export const needsBuild = (phrase: string): Promise<{ task_id: string }> =>
  post('/api/needs/build', { phrase })

export const clearLogs = (): Promise<{ ok: boolean }> => post('/api/logs/clear')

export const clearTasks = (): Promise<{ ok: boolean; deleted: number }> => post('/api/tasks/clear')

/** Повторить упавшую задачу: тот же вызов, что и в первый раз, новый task_id. */
export const retryTask = (id: string): Promise<{ task_id: string }> =>
  post(`/api/task/${encodeURIComponent(id)}/retry`)

/** Снять задачу, которую исполнитель не взял (только WAITING). */
export const cancelTask = (id: string): Promise<{ ok: boolean; task_id: string }> =>
  post(`/api/task/${encodeURIComponent(id)}/cancel`)

// ---------- стоп-слова ----------

export type StopKind = 'stop' | 'brand' | 'unwanted'

export interface StopWord {
  word: string
  kind: StopKind
  added_at: number
}

/** Предложение модели: слова с обоснованием, по категориям. Ничего не фильтрует само. */
export interface StopSuggestion {
  task_id: string
  root: string | null
  created_at: number | null
  words_seen: number | null
  words_total: number | null
  stop: { word: string; why: string }[]
  brand: { word: string; why: string }[]
  unwanted: { word: string; why: string }[]
}

export interface StopState {
  saved: StopWord[]
  suggestion: StopSuggestion | null
  kinds: StopKind[]
}

export const stopwords = (): Promise<StopState> => req('/api/stopwords')

export const stopScan = (phrase: string): Promise<{ task_id: string }> =>
  post('/api/stopwords/scan', { phrase })

export const stopAdd = (words: { word: string; kind: StopKind }[]): Promise<{ saved: StopWord[] }> =>
  post('/api/stopwords', { words })

export const stopRemove = (words: string[]): Promise<{ saved: StopWord[] }> =>
  del('/api/stopwords', { words })

export const estimate = (phrase: string): Promise<Estimate> =>
  req(`/api/estimate?phrase=${encodeURIComponent(phrase)}`)

// ---------- деревья потребностей (второй слой; классификация и рейтинги лежат файлами) ----------

export interface NeedsCounts {
  works: number
  best_score: number | null
  ranked: number
  segments: number
  phrases: number
  excluded: number
}

// строка таблицы: счётчики плоско, чтобы таблица читалась без вложенности
export interface NeedsRow extends NeedsCounts {
  analyzed: number
  /** Сколько групп в дереве продуктов текущей ревизии. */
  products?: number
  id: string
  condition: string | null
  root: string | null
  root_freq: number | null
  created_at: number | null
  ranked_at?: number | null
  ranked_by?: ModelFamily | null
  error: string | null
}

export interface NeedsPhrase {
  phrase: string
  freq: number | null
}

export type ProductLevel = 'micro' | 'medium' | 'macro'

/** Группа дерева продуктов: один вход, один движок, несколько работ. */
export interface ProductGroup {
  id: string
  level: ProductLevel
  name: string | null
  works: string[]
  parent: string | null
  input: string | null
  engine: string | null
  output: string | null
  money: string | null
  pool: number | null
  pool_why: string | null
  core: string | null
  order: string[] | null
  why: string | null
  /** Агрегаты по работам группы — считает backend, не модель. */
  work_items: Array<{
    name: string
    top_freq: number | null
    /** Сырая сумма частот всех фраз потребности, включая её подгруппы. */
    sum_freq: number
    phrase_count: number | null
    unclear: boolean | null
    why: string | null
    score: number | null
    intent: string | null
    blocker: string | null
    /** Ключи потребности: продукт → потребность → фразы. */
    phrases: NeedsPhrase[]
    sections: Array<{ name: string | null; kind?: string | null; why: string | null; phrase_count: number }>
  }>
  sum_freq: number
  top_freq: number
  phrase_count: number
  section_count: number
  best_score: number | null
  /** Ручной лайк человека — стоит на продукте, а не на потребности. */
  favorite?: boolean
  artifacts: NeedsArtifact[]
}

export interface NeedsProducts {
  task_id: string | null
  model_family: ModelFamily | null
  created_at: number | null
  tree_revision: number | null
  why: string | null
  /** HTML-отчёт самой группировки: как ветка раскладывается на продукты. */
  report_link: string | null
  groups: ProductGroup[]
}

export interface NeedsSegment {
  name: string | null
  /** section — тот же вход и продукт, другой раздел ответа; segment — другой вход или аудитория. */
  kind?: 'segment' | 'section' | null
  why: string | null
  phrases: NeedsPhrase[]
}


export type NeedsAction =
  | 'analyze'
  | 'analyze_adv'
  | 'product'
  | 'test'
  | 'season'
  | 'adjacent'
  | 'dump'

// Вид артефакта — не то же, что имя действия: «Продукт» запускается как `product`, а хранится
// как `analyze_product` (третий разбор, а не отдельная сущность).
export type ArtifactKind =
  | 'analyze'
  | 'analyze_adv'
  | 'analyze_product'
  | 'model_test'
  | 'season'
  | 'adjacent'
  | 'dump'

/** Прогон над работой: разбор, сезонность или смежные ключи. Копятся, не перезаписываются. */
export interface NeedsArtifact {
  kind: ArtifactKind
  created_at: number | null
  report_link: string | null
  task_id: string | null
  verdict: string | null
  verdict_score: number | null
  summary: string | null
  model_family?: ModelFamily | null
}

export interface NeedsWork {
  name: string | null
  /** Ручной лайк пользователя; хранится отдельно от классификации и рейтинга. */
  favorite?: boolean
  // 0-100: возможность самостоятельного продукта; появляется только после общей команды «Анализ».
  score: number | null
  score_why: string | null
  intent: 'product' | 'mixed' | 'information' | 'platform_action' | 'support' | 'navigation' | 'unclear' | null
  product: string | null
  blocker: string | null
  evidence: string[] | null
  factors: Record<string, number> | null
  /** Сырая сумма частот всех формулировок работы, включая сегменты. */
  sum_freq: number
  top_freq: number | null
  phrase_count: number | null
  unclear: boolean | null
  why: string | null
  phrases: NeedsPhrase[]
  segments: NeedsSegment[]
  artifacts: NeedsArtifact[]
}

export interface NeedsExcluded extends NeedsPhrase {
  why: string | null
  note: string | null
}

export interface NeedsTree {
  id: string
  condition: string | null
  root: string | null
  root_freq: number | null
  created_at: number | null
  /** Версия классификации: 0 — исходная сборка, +1 за каждый успешный второй проход. */
  revision?: number
  refined_at?: number | null
  refined_by?: ModelFamily | null
  ranked_at?: number | null
  ranked_by?: ModelFamily | null
  rank_task_id?: string | null
  refinements?: Array<{
    task_id: string
    model_family: ModelFamily
    created_at: number
    from_revision: number
    revision: number
  }>
  counts: NeedsCounts
  /** Дерево продуктов текущей ревизии; null — группировка ещё не запускалась. */
  products: NeedsProducts | null
  works: NeedsWork[]
  excluded: NeedsExcluded[]
}

export const needsTrees = (): Promise<{ trees: NeedsRow[] }> => req('/api/needs/trees')

export const needsTree = (id: string): Promise<NeedsTree> =>
  req(`/api/needs/tree/${encodeURIComponent(id)}`)

/** Поставить или снять ручной лайк у работы. */
export const needsFavorite = (
  tree_id: string,
  work: string,
  favorite: boolean,
): Promise<{ work: string; favorite: boolean; favorites: string[] }> =>
  post('/api/needs/favorite', { tree_id, work, favorite })

/** Второй проход классификации всего дерева. Результат заменяет каноническую ревизию. */
export const needsRefine = (
  tree_id: string,
  model_family: ModelFamily,
): Promise<{ task_id: string }> => post('/api/needs/refine', { tree_id, model_family })

/** Продуктовый рейтинг всей принятой классификации, без выдачи и анализа конкурентов. */
export const needsRank = (
  tree_id: string,
  model_family: ModelFamily,
): Promise<{ task_id: string }> => post('/api/needs/rank', { tree_id, model_family })

/** «Продукты»: разложить работы ветки в дерево продуктов на трёх масштабах. */
export const needsProducts = (
  tree_id: string,
  model_family: ModelFamily,
): Promise<{ task_id: string; replacing: ProductsPlan }> =>
  post('/api/needs/products', { tree_id, model_family })

/** Что потеряет пересборка: сколько групп сейчас и сколько по ним готовых отчётов. */
export interface ProductsPlan {
  groups: number
  with_reports: number
  reports: number
}

/** Лайк продукта: та же ручка, что у работы, но единица — группа. */
export const needsFavoriteGroup = (
  tree_id: string,
  group: string,
  favorite: boolean,
): Promise<{ group: string; favorite: boolean; favorites: string[] }> =>
  post('/api/needs/favorite', { tree_id, group, favorite })

/** Действие по работе: сезонность, смежные ключи, выгрузка, smoke-test. */
export const needsRun = (
  action: NeedsAction,
  tree_id: string,
  work: string,
  model_family?: ModelFamily,
): Promise<{ task_id: string }> =>
  post('/api/needs/' + action, { tree_id, work, ...(model_family ? { model_family } : {}) })

/** Разбор по ГРУППЕ дерева продуктов: «Ниша», «Функции», «Спецификация». */
export const needsRunGroup = (
  action: NeedsAction,
  tree_id: string,
  group: string,
  model_family?: ModelFamily,
): Promise<{ task_id: string }> =>
  post('/api/needs/' + action, { tree_id, group, ...(model_family ? { model_family } : {}) })

// ---------- форматирование ----------

// частота с пробелами-разделителями: 1234567 -> "1 234 567"
export const fmt = (n: number | null | undefined): string =>
  n == null ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

const pad = (n: number) => String(n).padStart(2, '0')

function toDate(ts: number | string | null | undefined): Date | null {
  if (ts == null || ts === '') return null
  const ms = typeof ts === 'number' ? (ts < 1e11 ? ts * 1000 : ts) : Date.parse(ts)
  return Number.isFinite(ms) ? new Date(ms) : null
}

/** ЧЧ:ММ:СС — для строк лога. */
/** Только время — для мест, где дата и так очевидна. */
export function fmtClock(ts: number | string | null | undefined): string {
  const d = toDate(ts)
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : '—'
}

/** Дата и время: в логе одного времени мало — прогон мог идти вчера. */
export function fmtTime(ts: number | string | null | undefined): string {
  const d = toDate(ts)
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${fmtClock(ts)}` : '—'
}

/** ДД.ММ ЧЧ:ММ:СС — для таблиц задач и отчётов. */
export function fmtWhen(ts: number | string | null | undefined): string {
  const d = toDate(ts)
  return d ? fmtTime(ts) : '—'
}

/** ЧЧ:ММ:СС — фактическое время выполнения между стартом и финишем. */
export function fmtDuration(
  startedAt: number | string | null | undefined,
  finishedAt: number | string | null | undefined,
): string {
  const started = toDate(startedAt)
  const finished = toDate(finishedAt)
  if (!started || !finished || finished < started) return '—'

  const totalSeconds = Math.floor((finished.getTime() - started.getTime()) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${pad(minutes)}:${pad(seconds)}`
}

/** Ссылка на отчёт: в БД лежит относительный путь вида reports/{id}.html. */
export const reportHref = (link: string): string =>
  /^(https?:)?\/\//.test(link) || link.startsWith('/') ? link : '/' + link
