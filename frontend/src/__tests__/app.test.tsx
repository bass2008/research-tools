// App целиком: события WS доезжают до DOM (tech §6.2) и ошибки команд (404/409/422)
// показываются пользователю, а не теряются (testing-plan §7).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import type { Node, WsEvent } from '../api'
import { emptyNode } from '../store'

const n = (phrase: string, over: Partial<Node> = {}): Node => ({
  ...emptyNode(phrase),
  freq: 100,
  ...over,
})

// ---------- подменённый WebSocket ----------
class FakeWS {
  static OPEN = 1
  static instances: FakeWS[] = []
  readyState = 0
  url: string
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  sent: unknown[] = []
  constructor(url: string) {
    this.url = url
    FakeWS.instances.push(this)
  }
  send(d: string) {
    this.sent.push(JSON.parse(d))
  }
  close() {
    this.readyState = 3
    this.onclose?.()
  }
  accept() {
    this.readyState = FakeWS.OPEN
    this.onopen?.()
  }
  push(ev: WsEvent | Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(ev) })
  }
}

const res = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
})

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  FakeWS.instances = []
  fetchMock = vi.fn(async () => res(200, { task_id: 'task-1' }))
  vi.stubGlobal('WebSocket', FakeWS)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mount() {
  const r = render(<App />)
  const ws = FakeWS.instances.at(-1)!
  act(() => ws.accept())
  return {
    ...r,
    ws,
    emit: (ev: WsEvent | Record<string, unknown>) => act(() => ws.push(ev)),
  }
}

/** Тело последнего POST-запроса. */
const lastBody = () => JSON.parse(String(fetchMock.mock.calls.at(-1)![1].body))
const lastUrl = () => String(fetchMock.mock.calls.at(-1)![0])

describe('подписка и выбор корня', () => {
  it('на открытии канала уходит subscribe', () => {
    const { ws } = mount()
    expect(ws.sent).toContainEqual({ action: 'subscribe' })
  })



  it('Enter в поле корня отправляет введённую фразу', async () => {
    const user = userEvent.setup()
    const { ws } = mount()
    const input = screen.getByTestId('root-input')
    await user.clear(input)
    await user.type(input, 'убрать фон{Enter}')
    expect(ws.sent).toContainEqual({ action: 'root', phrase: 'убрать фон' })
  })
})

describe('лес корней', () => {
  it('при открытии показываются ВСЕ корни, а не одна заранее выбранная ветка', () => {
    const { emit, ws } = mount()
    expect(ws.sent).not.toContainEqual(expect.objectContaining({ action: 'root' }))

    emit({ type: 'roots', data: { roots: [n('нейросеть', { freq: 4986011 }), n('телеграм', { freq: 5475727 })] } })
    const forest = screen.getByTestId('tree-forest')
    expect(within(forest).getByTestId('node-нейросеть')).toBeInTheDocument()
    expect(within(forest).getByTestId('node-телеграм')).toBeInTheDocument()
  })

  it('после выбора ветки есть возврат ко всем корням', async () => {
    const { emit } = mount()
    emit({ type: 'roots', data: { roots: [n('нейросеть'), n('телеграм')] } })
    emit({ type: 'snapshot', data: { root: n('телеграм'), children: [n('телеграм каналы')] } })
    expect(screen.queryByTestId('tree-forest')).toBeNull()

    await userEvent.click(screen.getByTestId('show-roots'))
    expect(screen.getByTestId('tree-forest')).toBeInTheDocument()
    expect(screen.getByTestId('node-нейросеть')).toBeInTheDocument()
  })
})

describe('новый корень', () => {
  it('фраза вне дерева предлагает завести корень, а не рисует фальшивый узел', async () => {
    const { emit, ws } = mount()
    emit({ type: 'snapshot', data: { root: null, missing: 'телеграм', children: [] } })
    expect(screen.getByTestId('tree-missing')).toHaveTextContent('телеграм')
    expect(screen.queryByTestId('node-телеграм')).toBeNull()

    await userEvent.click(screen.getByTestId('tree-add-root'))
    await waitFor(() => expect(lastUrl()).toBe('/api/node/root'))
    expect(lastBody()).toEqual({ phrase: 'телеграм' })
    // после заведения дерево переключается на новый корень — он независим от прежнего
    await waitFor(() => expect(ws.sent).toContainEqual({ action: 'root', phrase: 'телеграм' }))
  })
})

describe('дерево: snapshot / children / node', () => {
  it('snapshot рисует дерево и ЗАМЕНЯЕТ его следующим снимком', () => {
    const { emit } = mount()
    emit({ type: 'snapshot', data: { root: n('a'), children: [n('a1'), n('a2')] } })
    expect(screen.getByTestId('node-a')).toBeInTheDocument()
    expect(screen.getByTestId('node-a1')).toBeInTheDocument()

    emit({ type: 'snapshot', data: { root: n('b'), children: [n('b1')] } })
    expect(screen.queryByTestId('node-a')).toBeNull()
    expect(screen.queryByTestId('node-a1')).toBeNull()
    expect(screen.getByTestId('node-b1')).toBeInTheDocument()
  })

  it('children ДОПИСЫВАЕТ детей узлу', () => {
    const { emit } = mount()
    emit({ type: 'snapshot', data: { root: n('a'), children: [n('a1')] } })
    emit({ type: 'children', data: { parent: 'a', children: [n('a2')] } })
    expect(screen.getByTestId('node-a1')).toBeInTheDocument()
    expect(screen.getByTestId('node-a2')).toBeInTheDocument()
  })

  it('node обновляет узел на месте: статус и набор кнопок', () => {
    const { emit } = mount()
    emit({
      type: 'snapshot',
      data: { root: n('a', { status: 'FULLY_LOADED' }), children: [] },
    })
    expect(screen.getByTestId('btn-needs-build')).toBeInTheDocument()

    emit({ type: 'node', data: { phrase: 'a', status: 'LOADED' } })
    expect(within(screen.getByTestId('node-a')).getByTestId('node-status')).toHaveTextContent(
      'LOADED',
    )
    expect(screen.queryByTestId('btn-needs-build')).toBeNull()
    expect(screen.getByTestId('btn-full-load')).toBeInTheDocument()
  })

  it('блокировка приходит событием node и снимается им же — вместе с поддеревом', () => {
    const { emit } = mount()
    emit({ type: 'snapshot', data: { root: n('a'), children: [n('a1')] } })
    expect(screen.getAllByTestId('btn-full-load')[0]).not.toBeDisabled()

    emit({ type: 'node', data: { phrase: 'a', task_id: 'task-9' } })
    for (const b of screen.getAllByTestId('btn-full-load')) expect(b).toBeDisabled()

    emit({ type: 'node', data: { phrase: 'a', task_id: null } })
    for (const b of screen.getAllByTestId('btn-full-load')) expect(b).not.toBeDisabled()
  })

  it('на узле нет ни отчёта, ни выводов: они принадлежат работе второго слоя', () => {
    const { emit } = mount()
    emit({ type: 'snapshot', data: { root: n('a', { status: 'FULLY_LOADED' }), children: [] } })
    for (const gone of ['btn-link', 'node-score', 'node-verdict']) {
      expect(screen.queryByTestId(gone)).toBeNull()
    }
  })

  it('мусор в канале не ломает приложение', () => {
    const { ws, emit } = mount()
    act(() => ws.onmessage?.({ data: 'не json' }))
    emit({ type: 'snapshot', data: { root: n('a'), children: [] } })
    expect(screen.getByTestId('node-a')).toBeInTheDocument()
  })
})

describe('progress', () => {
  it('рост total не откатывает прогресс назад', () => {
    const { emit } = mount()
    emit({ type: 'progress', data: { stage: 'full_load', node: 'a', done: 3, total: 10 } })
    expect(screen.getByTestId('progress')).toHaveTextContent('3/10')

    emit({ type: 'progress', data: { stage: 'full_load', node: 'a', done: 3, total: 40 } })
    const p = screen.getByTestId('progress')
    expect(p).toHaveTextContent('3/40')
    expect(p).toHaveTextContent('full_load')

    emit({ type: 'progress', data: { stage: 'full_load', node: 'a', done: 40, total: 40 } })
    const bar = screen.getByTestId('progress').querySelector('i') as HTMLElement
    expect(parseFloat(bar.style.width)).toBeLessThanOrEqual(100)
  })
})

describe('вкладка Лог', () => {
  const line = (msg: string) => ({
    ts: 1_700_000_000,
    level: 'INFO',
    stage: 'crawl',
    node: 'a',
    msg,
  })

  it('строки капают в поток, log_cleared чистит вкладку', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    await user.click(screen.getByTestId('tab-log'))
    expect(screen.getByText('лог пуст')).toBeInTheDocument()

    emit({ type: 'log', data: [line('первая'), line('вторая')] })
    emit({ type: 'log', data: line('третья') })
    expect(screen.getAllByTestId('log-line')).toHaveLength(3)
    expect(screen.getAllByTestId('log-line')[0]).toHaveTextContent('первая')

    emit({ type: 'log_cleared', data: {} })
    expect(screen.queryAllByTestId('log-line')).toHaveLength(0)
    expect(screen.getByText('лог пуст')).toBeInTheDocument()
  })

  it('«Удалить всё» дёргает эндпоинт очистки', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    emit({ type: 'log', data: line('строка') })
    await user.click(screen.getByTestId('log-clear'))
    expect(lastUrl()).toBe('/api/logs/clear')
  })
})

describe('ошибки команд показываются пользователю', () => {
  const openTree = (emit: (ev: WsEvent) => void, status: Node['status']) =>
    emit({ type: 'snapshot', data: { root: n('a', { status }), children: [] } })

  it('409 (узел или предок заняты) — код, сообщение и деталь видны', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    openTree(emit, 'FULLY_LOADED')
    fetchMock.mockResolvedValueOnce(
      res(409, { error: 'node is busy', detail: 'занят предок: нейросеть' }),
    )
    await user.click(screen.getByTestId('btn-needs-build'))

    const box = await screen.findByTestId('cmd-error')
    expect(box).toHaveTextContent('409')
    expect(box).toHaveTextContent('node is busy')
    expect(box).toHaveTextContent('занят предок: нейросеть')
    // статус узла не изменился
    expect(within(screen.getByTestId('node-a')).getByTestId('node-status')).toHaveTextContent(
      'FULLY_LOADED',
    )
  })

  it('422 (недопустимый переход) виден', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    openTree(emit, 'FULLY_LOADED')
    fetchMock.mockResolvedValueOnce(
      res(422, { error: 'bad transition', detail: 'сборка возможна только из FULLY_LOADED' }),
    )
    await user.click(screen.getByTestId('btn-needs-build'))
    const box = await screen.findByTestId('cmd-error')
    expect(box).toHaveTextContent('422')
    expect(box).toHaveTextContent('bad transition')
  })

  it('404 (нет узла) виден', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    openTree(emit, 'NEW')
    fetchMock.mockResolvedValueOnce(res(404, { error: 'unknown phrase', detail: '' }))
    await user.click(screen.getByTestId('btn-load'))
    const box = await screen.findByTestId('cmd-error')
    expect(box).toHaveTextContent('404')
    expect(box).toHaveTextContent('unknown phrase')
  })

  it('ошибка без тела не теряется', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    openTree(emit, 'FULLY_LOADED')
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('no body')
      },
    })
    await user.click(screen.getByTestId('btn-needs-build'))
    expect(await screen.findByTestId('cmd-error')).toHaveTextContent('500')
  })

  it('сетевой сбой показывается, а не глотается', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    openTree(emit, 'FULLY_LOADED')
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'))
    await user.click(screen.getByTestId('btn-needs-build'))
    expect(await screen.findByTestId('cmd-error')).toHaveTextContent('Failed to fetch')
  })

  it('ошибку можно скрыть, а успешная команда её сбрасывает', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    openTree(emit, 'FULLY_LOADED')
    fetchMock.mockResolvedValueOnce(res(409, { error: 'busy', detail: '' }))
    await user.click(screen.getByTestId('btn-needs-build'))
    const box = await screen.findByTestId('cmd-error')
    await user.click(within(box).getByTitle('скрыть'))
    expect(screen.queryByTestId('cmd-error')).toBeNull()

    fetchMock.mockResolvedValueOnce(res(409, { error: 'busy', detail: '' }))
    await user.click(screen.getByTestId('btn-needs-build'))
    await screen.findByTestId('cmd-error')
    fetchMock.mockResolvedValueOnce(res(200, { task_id: 't2' }))
    await user.click(screen.getByTestId('btn-needs-build'))
    await waitFor(() => expect(screen.queryByTestId('cmd-error')).toBeNull())
  })

  it('команда уходит на свой эндпоинт с фразой', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    openTree(emit, 'FULLY_LOADED')
    await user.click(screen.getByTestId('btn-needs-build'))
    await waitFor(() => expect(lastUrl()).toBe('/api/needs/build'))
    expect(lastBody()).toEqual({ phrase: 'a' })
  })
})

describe('подтверждение объёма для Full load (design §8)', () => {
  it('«Нет» ничего не запускает', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    emit({ type: 'snapshot', data: { root: n('a', { status: 'NEW' }), children: [] } })
    fetchMock.mockResolvedValueOnce(res(200, { nodes: 120, requests: 34 }))
    await user.click(screen.getByTestId('btn-full-load'))

    const dlg = await screen.findByTestId('confirm-dialog')
    expect(dlg).toHaveTextContent('120')
    await user.click(screen.getByTestId('confirm-no'))
    expect(screen.queryByTestId('confirm-dialog')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1) // только оценка
  })

  it('«Да» запускает операцию, а провал оценки не мешает диалогу', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    emit({ type: 'snapshot', data: { root: n('a', { status: 'NEW' }), children: [] } })
    fetchMock.mockRejectedValueOnce(new Error('нет оценки'))
    await user.click(screen.getByTestId('btn-full-load'))

    const dlg = await screen.findByTestId('confirm-dialog')
    expect(dlg).toHaveTextContent('Оценка объёма недоступна')
    await user.click(screen.getByTestId('confirm-yes'))
    await waitFor(() => expect(lastUrl()).toBe('/api/node/full-load'))
    expect(lastBody()).toEqual({ phrase: 'a' })
  })
})

describe('вкладки Task и Отчёты', () => {
  it('задачи попадают в таблицу вкладки Task', async () => {
    const user = userEvent.setup()
    const { emit } = mount()
    emit({
      type: 'task',
      data: {
        id: 't1',
        type: 'needs_build',
        node: 'a',
        status: 'DONE',
        created_at: 1_700_000_000,
        started_at: 1_700_000_001,
        finished_at: 1_700_000_126,
        error: null,
      },
    })
    await user.click(screen.getByTestId('tab-tasks'))
    const task = screen.getByTestId('task-row')
    expect(task).toHaveTextContent('needs_build')
    expect(task).toHaveTextContent('DONE')
    const table = task.closest('table')!
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'тип',
      'узел',
      'статус',
      'создана',
      'финиш',
      'время',
      'ошибка',
    ])
    expect(within(task).getAllByRole('cell')[5]).toHaveTextContent('00:02:05')
  })

  it('вкладка «Отчёты» показывает разборы РАБОТ, а не узлов', async () => {
    const user = userEvent.setup()
    mount()
    fetchMock.mockResolvedValueOnce(
      res(200, {
        reports: [
          {
            tree_id: 'tree-1',
            work: 'создать песню или музыку',
            root: 'нейросеть бесплатно без регистрации',
            condition: 'бесплатно',
            top_freq: 7106,
            phrases: 31,
            gap_candidate: true,
            verdict: 'SKIP',
            verdict_score: 30,
            confidence: 0.6,
            report_link: 'reports/r1.html',
            created_at: 1_700_000_002,
          },
        ],
      }),
    )
    await user.click(screen.getByTestId('tab-reports'))
    const row = await screen.findByTestId('report-row')
    expect(row).toHaveTextContent('создать песню или музыку')
    expect(row).toHaveTextContent('30')
    expect(within(row).getByTitle('Claude')).toBeTruthy()
    expect(within(row).getByTitle('SKIP')).toBeTruthy()
    expect(screen.getByTestId('report-legend')).toHaveTextContent('SKIP')
    const link = within(row).getByTestId('report-link')
    expect(link).toHaveAttribute('href', '/reports/r1.html')
    expect(link).toHaveAttribute('target', '_blank')
  })
})

describe('DAG: одна фраза под разными родителями', () => {
  it('дельта node обновляет все вхождения узла сразу', () => {
    const { emit } = mount()
    emit({ type: 'snapshot', data: { root: n('a'), children: [n('y'), n('a1')] } })
    emit({ type: 'children', data: { parent: 'a1', children: [n('y')] } })
    expect(screen.getAllByTestId('node-y')).toHaveLength(2)

    emit({ type: 'node', data: { phrase: 'y', status: 'FULLY_LOADED' } })
    for (const el of screen.getAllByTestId('node-y')) {
      expect(within(el).getByTestId('node-status')).toHaveTextContent('FULLY_LOADED')
      expect(within(el).getByTestId('btn-needs-build')).toBeInTheDocument()
    }
  })
})

describe('обрыв и переподключение канала', () => {
  it('состояние WS отражается в индикаторе, после реконнекта подписка и корень восстановлены', async () => {
    vi.useFakeTimers()
    try {
      render(<App />)
      const first = FakeWS.instances.at(-1)!
      act(() => first.accept())
      expect(screen.getByTestId('ws-status')).toHaveTextContent('WS ✓')

      fireEvent.change(screen.getByTestId('root-input'), { target: { value: 'нейросеть' } })
      fireEvent.keyDown(screen.getByTestId('root-input'), { key: 'Enter' })
      expect(first.sent).toContainEqual({ action: 'root', phrase: 'нейросеть' })

      act(() => first.close())
      expect(screen.getByTestId('ws-status')).toHaveTextContent('WS ✕')

      await act(async () => {
        vi.advanceTimersByTime(600)
      })
      const second = FakeWS.instances.at(-1)!
      expect(second).not.toBe(first)
      act(() => second.accept())
      expect(second.sent).toEqual([
        { action: 'subscribe' },
        { action: 'root', phrase: 'нейросеть' },
      ])
      expect(screen.getByTestId('ws-status')).toHaveTextContent('WS ✓')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('индикатор LLM-петли', () => {
  it('показывает Claude и Codex независимо', () => {
    const { emit } = mount()
    expect(screen.getByTestId('llm-claude-status')).toHaveTextContent('Claude: офлайн')
    expect(screen.getByTestId('llm-codex-status')).toHaveTextContent('Codex: офлайн')
    emit({ type: 'llm_status', data: {
      online: true,
      last_seen_at: 1_700_000_000,
      families: {
        claude: { online: false, last_seen_at: null },
        codex: { online: true, last_seen_at: 1_700_000_000 },
      },
    } })
    expect(screen.getByTestId('llm-claude-status')).toHaveTextContent('Claude: офлайн')
    expect(screen.getByTestId('llm-codex-status')).toHaveTextContent('Codex: онлайн')
  })
})
