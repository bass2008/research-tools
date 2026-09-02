// Редьюсер событий WS (tech §6.2, testing-plan §7): roots / snapshot / children / node /
// progress / log_cleared. Чистая функция — проверяем без DOM.
import { describe, expect, it } from 'vitest'
import type { LogLine, Node, TaskRow, WsEvent } from '../api'
import { applyEvent, emptyNode, initialState } from '../store'
import type { State } from '../store'

const n = (phrase: string, over: Partial<Node> = {}): Node => ({
  ...emptyNode(phrase),
  freq: 100,
  ...over,
})

const run = (evs: WsEvent[], from: State = initialState): State => evs.reduce(applyEvent, from)

const log = (msg: string, over: Partial<LogLine> = {}): LogLine => ({
  ts: 1_700_000_000,
  level: 'INFO',
  stage: 'full_load',
  node: 'a',
  msg,
  ...over,
})

describe('roots', () => {
  it('рисует список отправных фраз в порядке сервера', () => {
    const s = run([
      { type: 'roots', data: { roots: [n('нейросеть', { freq: 900_000 }), n('удалить фон')] } },
    ])
    expect(s.roots).toEqual(['нейросеть', 'удалить фон'])
    expect(s.nodes['нейросеть'].freq).toBe(900_000)
    expect(s.root).toBeNull() // корень дерева не выбирается автоматически
    expect(s.kids).toEqual({})
  })

  it('повторные roots заменяют список', () => {
    const s = run([
      { type: 'roots', data: { roots: [n('a'), n('b')] } },
      { type: 'roots', data: { roots: [n('c')] } },
    ])
    expect(s.roots).toEqual(['c'])
  })

  it('собирает домен как именованный набор входных веток', () => {
    const s = run([{ type: 'roots', data: {
      domains: [{ id: 'matrix', name: 'Матрица судьбы',
        members: [n('матрица судьбы'), n('аркан по дате')] }],
      roots: [n('другой корень')],
    } }])
    expect(s.domains).toEqual([{ id: 'matrix', name: 'Матрица судьбы',
      members: ['матрица судьбы', 'аркан по дате'] }])
    expect(s.nodes['аркан по дате']).toBeTruthy()
  })
})

describe('snapshot', () => {
  const first: WsEvent = {
    type: 'snapshot',
    data: { root: n('a'), children: [n('a1'), n('a2')] },
  }

  it('строит дерево: корень и реальные дети', () => {
    const s = run([first])
    expect(s.root).toBe('a')
    expect(s.kids['a'].map((k) => k.phrase)).toEqual(['a1', 'a2'])
    expect(Object.keys(s.nodes).sort()).toEqual(['a', 'a1', 'a2'])
  })

  it('ЗАМЕНЯЕТ дерево целиком, а не дописывает', () => {
    const s = run([
      first,
      { type: 'children', data: { parent: 'a1', children: [n('a1x')] } },
      { type: 'snapshot', data: { root: n('b'), children: [n('b1')] } },
    ])
    expect(s.root).toBe('b')
    expect(Object.keys(s.kids)).toEqual(['b']) // от прежнего дерева структуры не осталось
    expect(s.kids['b'].map((k) => k.phrase)).toEqual(['b1'])
  })

  it('пустое поддерево — валидный снимок (чтение ничего не догружает)', () => {
    const s = run([{ type: 'snapshot', data: { root: n('a'), children: [] } }])
    expect(s.kids['a']).toEqual([])
    expect(s.root).toBe('a')
  })

  it('локальные дети из пула родителя собираются в карту узлов', () => {
    const s = run([
      {
        type: 'snapshot',
        data: { root: n('a', { children: [n('a-loc')] }), children: [n('a1')] },
      },
    ])
    expect(s.nodes['a-loc']).toBeTruthy()
    expect(s.nodes['a'].children).toBeUndefined() // в карте узлы без структуры
  })
})

describe('children', () => {
  const base = run([{ type: 'snapshot', data: { root: n('a'), children: [n('a1')] } }])

  it('ДОПИСЫВАЕТ детей узлу, старых не теряет', () => {
    const s = applyEvent(base, { type: 'children', data: { parent: 'a', children: [n('a2')] } })
    expect(s.kids['a'].map((k) => k.phrase)).toEqual(['a1', 'a2'])
    expect(s.root).toBe('a')
  })

  it('совпавшего по фразе обновляет, а не дублирует', () => {
    const s = applyEvent(base, {
      type: 'children',
      data: { parent: 'a', children: [n('a1', { status: 'LOADED' }), n('a2')] },
    })
    expect(s.kids['a'].map((k) => k.phrase)).toEqual(['a1', 'a2'])
    expect(s.nodes['a1'].status).toBe('LOADED')
  })

  it('дописывает детей вложенному узлу, не задевая корень', () => {
    const s = applyEvent(base, { type: 'children', data: { parent: 'a1', children: [n('a1x')] } })
    expect(s.kids['a'].map((k) => k.phrase)).toEqual(['a1'])
    expect(s.kids['a1'].map((k) => k.phrase)).toEqual(['a1x'])
  })

  it('пустой список — «детей нет», узел помечается загруженным пустым', () => {
    const s = applyEvent(base, { type: 'children', data: { parent: 'a1', children: [] } })
    expect(s.kids['a1']).toEqual([])
  })
})

describe('node', () => {
  const base = run([
    {
      type: 'snapshot',
      data: {
        root: n('a', { status: 'FULLY_LOADED' }),
        children: [n('a1', { status: 'LOADED', freq: 500 })],
      },
    },
  ])

  it('обновляет узел на месте, прочие поля сохраняются', () => {
    const s = applyEvent(base, {
      type: 'node',
      data: { phrase: 'a1', status: 'FULLY_LOADED', task_id: null },
    })
    expect(s.nodes['a1'].status).toBe('FULLY_LOADED')
    expect(s.nodes['a1'].freq).toBe(500) // дельта не обнуляет то, чего в ней нет
  })

  it('не двигает структуру дерева', () => {
    const s = applyEvent(base, { type: 'node', data: { phrase: 'a1', status: 'LOADED' } })
    expect(s.kids).toBe(base.kids)
    expect(s.root).toBe('a')
  })

  it('дельта по неизвестной фразе создаёт узел с дефолтами', () => {
    const s = applyEvent(base, { type: 'node', data: { phrase: 'zz', freq: 77 } })
    expect(s.nodes['zz'].status).toBe('NEW')
    expect(s.nodes['zz'].freq).toBe(77)
    expect(s.nodes['zz'].task_id).toBeNull()
  })

  it('доносит блокировку и снятие блокировки', () => {
    const busy = applyEvent(base, { type: 'node', data: { phrase: 'a', task_id: 't1' } })
    expect(busy.nodes['a'].task_id).toBe('t1')
    const free = applyEvent(busy, { type: 'node', data: { phrase: 'a', task_id: null } })
    expect(free.nodes['a'].task_id).toBeNull()
  })

  it('доносит смену статуса загрузки на месте', () => {
    const s = applyEvent(base, { type: 'node', data: { phrase: 'a1', status: 'FULLY_LOADED' } })
    expect(s.nodes['a1'].status).toBe('FULLY_LOADED')
  })
})

describe('progress', () => {
  it('total может расти, done при этом не едет назад', () => {
    const evs: WsEvent[] = [
      { type: 'progress', data: { stage: 'full_load', node: 'a', done: 3, total: 10 } },
      { type: 'progress', data: { stage: 'full_load', node: 'a', done: 3, total: 40 } },
      { type: 'progress', data: { stage: 'full_load', node: 'a', done: 12, total: 40 } },
      { type: 'progress', data: { stage: 'full_load', node: 'a', done: 12, total: 55 } },
    ]
    let s = initialState
    let prevDone = 0
    let prevTotal = 0
    for (const ev of evs) {
      s = applyEvent(s, ev)
      const p = s.progress!
      expect(p.done).toBeGreaterThanOrEqual(prevDone) // назад не откатились
      expect(p.total).toBeGreaterThanOrEqual(prevTotal)
      expect(p.done).toBeLessThanOrEqual(p.total)
      prevDone = p.done
      prevTotal = p.total
    }
    expect(s.progress).toEqual({ stage: 'full_load', node: 'a', done: 12, total: 55 })
  })

  it('прогресс не затирает дерево и лог', () => {
    const base = run([
      { type: 'snapshot', data: { root: n('a'), children: [n('a1')] } },
      { type: 'log', data: log('старт') },
    ])
    const s = applyEvent(base, {
      type: 'progress',
      data: { stage: 'crawl', node: 'a', done: 1, total: 2 },
    })
    expect(s.kids).toBe(base.kids)
    expect(s.logs).toBe(base.logs)
  })
})

describe('log / log_cleared', () => {
  it('одиночная строка и пачка (хвост при подписке) добавляются в порядке прихода', () => {
    const s = run([
      { type: 'log', data: [log('один'), log('два')] },
      { type: 'log', data: log('три') },
    ])
    expect(s.logs.map((l) => l.msg)).toEqual(['один', 'два', 'три'])
    expect(new Set(s.logs.map((l) => l.seq)).size).toBe(3) // ключи уникальны
  })

  it('log_cleared чистит лог и не трогает остального', () => {
    const base = run([
      { type: 'snapshot', data: { root: n('a'), children: [n('a1')] } },
      { type: 'log', data: [log('один'), log('два')] },
      {
        type: 'task',
        data: {
          id: 't1',
          type: 'full_load',
          node: 'a',
          status: 'RUNNING',
          created_at: 1,
          started_at: 1,
          finished_at: null,
          error: null,
        } as TaskRow,
      },
    ])
    expect(base.logs).toHaveLength(2)
    const s = applyEvent(base, { type: 'log_cleared', data: {} })
    expect(s.logs).toEqual([])
    expect(s.tasks).toHaveLength(1)
    expect(s.root).toBe('a')
  })

  it('лог держит хвост, не растёт без предела', () => {
    const many = Array.from({ length: 3200 }, (_, i) => log('m' + i))
    const s = run([{ type: 'log', data: many }])
    expect(s.logs.length).toBeLessThanOrEqual(3000)
    expect(s.logs[s.logs.length - 1].msg).toBe('m3199')
  })
})

describe('task', () => {
  const task = (over: Partial<TaskRow> & { id: string }): TaskRow => ({
    type: 'classify',
    node: 'a',
    status: 'QUEUED',
    created_at: 10,
    started_at: null,
    finished_at: null,
    error: null,
    ...over,
  })

  it('строка задачи обновляется по id, а не дублируется', () => {
    const s = run([
      { type: 'task', data: task({ id: 't1' }) },
      { type: 'task', data: task({ id: 't1', status: 'DONE', finished_at: 20 }) },
    ])
    expect(s.tasks).toHaveLength(1)
    expect(s.tasks[0].status).toBe('DONE')
    expect(s.tasks[0].finished_at).toBe(20)
  })

  it('задачи идут свежими сверху', () => {
    const s = run([
      { type: 'task', data: [task({ id: 't1', created_at: 10 }), task({ id: 't2', created_at: 30 })] },
      { type: 'task', data: task({ id: 't3', created_at: 20 }) },
    ])
    expect(s.tasks.map((t) => t.id)).toEqual(['t2', 't3', 't1'])
  })

  it('tasks_cleared удаляет все задачи', () => {
    const withTask = applyEvent(initialState, { type: 'task', data: task({ id: 't1' }) })
    const cleared = applyEvent(withTask, { type: 'tasks_cleared', data: {} })
    expect(cleared.tasks).toEqual([])
  })

  it('обновляет индикатор петли', () => {
    const data = {
      online: true,
      last_seen_at: 1_700_000_000,
      families: {
        claude: { online: false, last_seen_at: null },
        codex: { online: true, last_seen_at: 1_700_000_000 },
      },
    }
    const s = run([{ type: 'llm_status', data }])
    expect(s.llm).toEqual(data)
  })
})

describe('неизвестное событие', () => {
  it('игнорируется без падения', () => {
    const base = run([{ type: 'snapshot', data: { root: n('a'), children: [] } }])
    const s = applyEvent(base, { type: 'wat' } as unknown as WsEvent)
    expect(s).toBe(base)
  })
})
