// API-слой: команды — HTTP POST (tech §6.1), чтение — WebSocket /ws (tech §6.2).
// Чтение не мутирует: root/expand только проецируют уже загруженное, ничего не догружают.

// Дерево запросов — только загрузка. Выводы (интент, конкуренция, разбор ниши) переехали во
// второй слой, где единица — работа; поэтому статусов три, а не одиннадцать.
export type Status = 'NEW' | 'LOADED' | 'FULLY_LOADED'
// WAITING — джоб отдан в очередь LLM, но исполнитель его ещё не взял: сервер свою
// часть сделал, работы никто не делает. RUNNING = работа реально идёт.
export type TaskStatus = 'QUEUED' | 'WAITING' | 'RUNNING' | 'DONE' | 'FAILED'

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
}

// Отчёт принадлежит РАБОТЕ второго слоя, а не узлу дерева запросов.
export interface ReportRow {
  tree_id: string
  work: string
  root: string | null
  condition: string | null
  top_freq: number | null
  phrases: number | null
  gap_candidate: boolean | null
  verdict: string | null
  verdict_score: number | null
  confidence: number | null
  report_link: string | null
  created_at: number | null
}

export const needsReports = (): Promise<{ reports: ReportRow[] }> => req('/api/needs/reports')

export interface Progress {
  stage: string
  node: string | null
  done: number
  total: number
}

export interface LlmStatus {
  online: boolean
  last_seen_at: number | null
}

export interface Estimate {
  nodes: number
  requests: number
}

// Сервер -> клиент, конверт {type, data}. Список/одиночка допускаются там, где сервер
// может прислать пачку (хвост лога, накопленные задачи и отчёты при подписке).
export type WsEvent =
  | { type: 'roots'; data: { roots: Node[] } }
  // root: null — такой фразы в дереве нет (в `missing` то, что искали)
  | { type: 'snapshot'; data: { root: Node | null; missing?: string; children: Node[] } }
  | { type: 'children'; data: { parent: string; children: Node[] } }
  | { type: 'node'; data: Partial<Node> & { phrase: string } }
  | { type: 'progress'; data: Progress }
  | { type: 'log'; data: LogLine | LogLine[] }
  | { type: 'task'; data: TaskRow | TaskRow[] }
  | { type: 'log_cleared'; data: Record<string, never> }
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

export const loadNode = (phrase: string): Promise<{ task_id: string }> =>
  post('/api/node/load', { phrase })

export const fullLoad = (phrase: string): Promise<{ task_id: string }> =>
  post('/api/node/full-load', { phrase })

/** Сборка дерева потребностей по ветке — замена узловым classify/drill. */
export const needsBuild = (phrase: string): Promise<{ task_id: string }> =>
  post('/api/needs/build', { phrase })

export const clearLogs = (): Promise<{ ok: boolean }> => post('/api/logs/clear')

export const estimate = (phrase: string): Promise<Estimate> =>
  req(`/api/estimate?phrase=${encodeURIComponent(phrase)}`)

// ---------- деревья потребностей (второй слой; пока читаются из папки) ----------

export interface NeedsCounts {
  works: number
  best_score: number
  segments: number
  phrases: number
  excluded: number
  gaps: number
  occupied: number
  needs_serp: number
}

// строка таблицы: счётчики плоско, чтобы таблица читалась без вложенности
export interface NeedsRow extends NeedsCounts {
  analyzed: number
  id: string
  condition: string | null
  root: string | null
  root_freq: number | null
  created_at: number | null
  error: string | null
}

export interface NeedsPhrase {
  phrase: string
  freq: number | null
}

export interface NeedsSegment {
  name: string | null
  gap_candidate: boolean | null
  why: string | null
  phrases: NeedsPhrase[]
}

export interface NeedsAnalysis {
  verdict: string | null
  verdict_score: number | null
  confidence: number | null
  report_link: string | null
  created_at: number | null
  searched: string[] | null
}

export type NeedsAction = 'analyze' | 'season' | 'adjacent'

/** Прогон над работой: разбор, сезонность или смежные ключи. Копятся, не перезаписываются. */
export interface NeedsArtifact {
  kind: NeedsAction
  created_at: number | null
  report_link: string | null
  task_id: string | null
  verdict: string | null
  verdict_score: number | null
  summary: string | null
}

export interface NeedsWork {
  name: string | null
  // 0-100: шанс, что разбор найдёт незакрытую потребность. Ставит сборка (LLM), не формула.
  score: number | null
  score_why: string | null
  top_freq: number | null
  phrase_count: number | null
  occupied_by: string | null
  unclear: boolean | null
  gap_candidate: boolean | null
  needs_serp: boolean | null
  serp_question: string | null
  why: string | null
  phrases: NeedsPhrase[]
  segments: NeedsSegment[]
  artifacts: NeedsArtifact[]
  analysis: NeedsAnalysis | null
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
  counts: NeedsCounts
  works: NeedsWork[]
  excluded: NeedsExcluded[]
}

export const needsTrees = (): Promise<{ trees: NeedsRow[] }> => req('/api/needs/trees')

export const needsTree = (id: string): Promise<NeedsTree> =>
  req(`/api/needs/tree/${encodeURIComponent(id)}`)

/** Действие над работой. Повторный запуск разрешён: каждый прогон копит свой артефакт. */
export const needsRun = (
  action: NeedsAction,
  tree_id: string,
  work: string,
): Promise<{ task_id: string }> => post('/api/needs/' + action, { tree_id, work })

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

/** Ссылка на отчёт: в БД лежит относительный путь вида reports/{id}.html. */
export const reportHref = (link: string): string =>
  /^(https?:)?\/\//.test(link) || link.startsWith('/') ? link : '/' + link
