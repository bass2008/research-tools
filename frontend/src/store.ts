// Состояние клиента и редьюсер событий WS (tech §6.2).
// Данные узла живут в плоской карте nodes (по фразе) — дельта node обновляет все его
// вхождения сразу; структура дерева — в kids (реальные дети по фразе) и в поле children
// самих payload-объектов (локальные дети из пула родителя, зависят от контекста родителя).

import { createContext } from 'react'
import type { LlmStatus, LogLine, Node, Progress, TaskRow, WsEvent } from './api'

export type Cmd = 'load' | 'full_load' | 'needs_build'

export interface LogRow extends LogLine {
  seq: number
}

export interface State {
  roots: string[] // корни-кандидаты (отправные фразы)
  root: string | null // корень текущего дерева
  missing: string | null // искали такую фразу, а в дереве её нет
  nodes: Record<string, Node> // данные узлов по фразе
  kids: Record<string, Node[]> // реальные дети по фразе
  logs: LogRow[]
  logSeq: number
  tasks: TaskRow[]
  progress: Progress | null
  llm: LlmStatus
}

export const initialState: State = {
  roots: [],
  root: null,
  missing: null,
  nodes: {},
  kids: {},
  logs: [],
  logSeq: 0,
  tasks: [],
  progress: null,
  llm: {
    online: false,
    last_seen_at: null,
    families: {
      claude: { online: false, last_seen_at: null },
      codex: { online: false, last_seen_at: null },
    },
  },
}

const LOG_CAP = 3000 // держим хвост, чтобы вкладка Лог не съела память на длинном крауле

export function emptyNode(phrase: string): Node {
  return {
    phrase,
    freq: null,
    status: 'NEW',
    task_id: null,
    error: null,
    cached: false,
    childCount: 0,
  }
}

// в карту nodes кладём узел без children: структура хранится отдельно
function bare(n: Node): Node {
  const c = { ...n }
  delete c.children
  return c
}

function collect(list: Node[], into: Record<string, Node>): void {
  for (const n of list) {
    into[n.phrase] = { ...into[n.phrase], ...bare(n) }
    if (n.children && n.children.length) collect(n.children, into)
  }
}

// children ДОПИСЫВАЕТ: старые остаются, новые в конец, совпавшие по фразе обновляются
function mergeKids(cur: Node[] | undefined, add: Node[]): Node[] {
  if (!cur || !cur.length) return add
  const out = cur.slice()
  const at = new Map(cur.map((n, i) => [n.phrase, i]))
  for (const n of add) {
    const i = at.get(n.phrase)
    if (i === undefined) {
      at.set(n.phrase, out.length)
      out.push(n)
    } else out[i] = n
  }
  return out
}

function asList<T>(d: T | T[]): T[] {
  return Array.isArray(d) ? d : [d]
}

function upsert<T extends { id: string }>(cur: T[], add: T[], cmp: (a: T, b: T) => number): T[] {
  const by = new Map(cur.map((x) => [x.id, x]))
  for (const x of add) by.set(x.id, { ...by.get(x.id), ...x })
  return [...by.values()].sort(cmp)
}

/** Локальное действие экрана: вернуться к списку корней (сервер об этом не знает). */
export type LocalEvent = { type: 'forest' }

/** Применение события WS к состоянию. Чистая функция. */
export function applyEvent(s: State, ev: WsEvent | LocalEvent): State {
  switch (ev.type) {
    // дерево запросов — лес: ни одна ветка не выбрана, показываем все корни
    case 'forest':
      return { ...s, root: null, missing: null }
    case 'roots': {
      const nodes = { ...s.nodes }
      collect(ev.data.roots, nodes)
      return { ...s, roots: ev.data.roots.map((n) => n.phrase), nodes }
    }
    case 'snapshot': {
      // ЗАМЕНЯЕТ дерево целиком; root === null — такой фразы в дереве нет
      if (!ev.data.root) {
        return { ...s, root: null, missing: ev.data.missing ?? '' }
      }
      const nodes = { ...s.nodes }
      const kids = ev.data.children ?? []
      collect([ev.data.root], nodes)
      collect(kids, nodes)
      return {
        ...s,
        root: ev.data.root.phrase,
        missing: null,
        kids: { [ev.data.root.phrase]: kids },
        nodes,
      }
    }
    case 'children': {
      const nodes = { ...s.nodes }
      const add = ev.data.children ?? []
      collect(add, nodes)
      return {
        ...s,
        nodes,
        kids: { ...s.kids, [ev.data.parent]: mergeKids(s.kids[ev.data.parent], add) },
      }
    }
    case 'node': {
      // дельта узла: мерджим в карту — обновятся все вхождения узла в дереве
      const d = { ...ev.data }
      delete d.children
      const prev = s.nodes[d.phrase] ?? emptyNode(d.phrase)
      return { ...s, nodes: { ...s.nodes, [d.phrase]: { ...prev, ...d } } }
    }
    case 'progress':
      // total — текущая оценка, может расти; признак конца — последнее событие операции
      return { ...s, progress: ev.data }
    case 'log': {
      let seq = s.logSeq
      const add = asList(ev.data).map((l) => ({ ...l, seq: seq++ }))
      const logs = s.logs.concat(add)
      return { ...s, logSeq: seq, logs: logs.length > LOG_CAP ? logs.slice(-LOG_CAP) : logs }
    }
    case 'task':
      return {
        ...s,
        tasks: upsert(s.tasks, asList(ev.data), (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)),
      }
    case 'log_cleared':
      return { ...s, logs: [] }
    case 'tasks_cleared':
      return { ...s, tasks: [] }
    case 'llm_status':
      return { ...s, llm: ev.data }
    default:
      return s
  }
}

// ---------- контекст дерева ----------

export interface TreeApi {
  nodes: Record<string, Node>
  kids: Record<string, Node[]>
  expand(phrase: string): void // чистое чтение: раскрыть уже загруженное
  run(phrase: string, cmd: Cmd): void // команда (full_load — через подтверждение объёма)
}

export const TreeCtx = createContext<TreeApi>({
  nodes: {},
  kids: {},
  expand: () => {},
  run: () => {},
})
