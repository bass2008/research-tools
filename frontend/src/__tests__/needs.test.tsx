// Вкладка «Дерево потребностей»: таблица -> дерево -> назад. Второй слой только читается,
// поэтому проверяем показ, а не команды.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NeedsPane } from '../NeedsPane'
import type { NeedsRow, NeedsTree, TaskRow } from '../api'

const row = (over: Partial<NeedsRow> = {}): NeedsRow => ({
  id: 'local-needs-001-runA',
  condition: 'бесплатно · без регистрации',
  root: 'нейросеть бесплатно без регистрации',
  root_freq: 86201,
  created_at: 1785091133,
  works: 16,
  segments: 18,
  phrases: 247,
  excluded: 82,
  gaps: 8,
  occupied: 4,
  needs_serp: 11,
  best_score: 88,
  analyzed: 0,
  error: null,
  ...over,
})

const TREE: NeedsTree = {
  id: 'local-needs-001-runA',
  condition: 'бесплатно · без регистрации',
  root: 'нейросеть бесплатно без регистрации',
  root_freq: 86201,
  created_at: 1785091133,
  counts: { works: 2, best_score: 88, segments: 1, phrases: 4, excluded: 2, gaps: 1, occupied: 1, needs_serp: 1 },
  works: [
    {
      name: 'оживить фото',
      score: 35,
      score_why: 'спрос большой, но работу держит Алиса',
      top_freq: 11081,
      phrase_count: 3,
      occupied_by: 'Яндекс Алиса',
      unclear: false,
      gap_candidate: false,
      needs_serp: true,
      serp_question: 'кто в топе по «оживить фото»',
      why: 'одна работа: анимировать статичный снимок',
      phrases: [
        { phrase: 'оживить фото нейросеть бесплатно без регистрации', freq: 11081 },
        { phrase: 'оживление фото нейросеть бесплатно без регистрации', freq: 734 },
      ],
      artifacts: [],
      analysis: null,
      segments: [
        {
          name: 'через Алису',
          gap_candidate: false,
          why: 'работу уже закрывает голосовой помощник',
          phrases: [{ phrase: 'алиса нейросеть оживить фото бесплатно без регистрации', freq: 573 }],
        },
      ],
    },
    {
      name: 'написать фанфик',
      score: 88,
      score_why: 'узкая аудитория, профильных продуктов нет',
      sum_freq: 589,
      top_freq: 589,
      phrase_count: 1,
      occupied_by: null,
      unclear: false,
      gap_candidate: true,
      needs_serp: false,
      serp_question: null,
      why: 'узкая аудитория, мейнстрим не обслуживает',
      phrases: [{ phrase: 'генератор фанфиков нейросеть бесплатно без регистрации', freq: 589 }],
      artifacts: [],
      analysis: null,
      segments: [],
    },
  ],
  excluded: [
    { phrase: 'нейросеть алиса бесплатно без регистрации', freq: 2451, why: 'brand', note: null },
    { phrase: 'лучшие бесплатные нейросети без регистрации', freq: 8273, why: 'catalog', note: null },
  ],
}

const res = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
})

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) =>
    url.includes('/api/needs/tree/') ? res(200, TREE) : res(200, { trees: [row()] }),
  )
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('вкладка «Дерево потребностей»', () => {
  it('пока вкладка не открыта, за списком не ходит', async () => {
    render(<NeedsPane active={false} />)
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled())
  })

  it('показывает таблицу деревьев со счётчиками', async () => {
    render(<NeedsPane active />)
    const r = await screen.findByTestId('needs-row')
    expect(r).toHaveTextContent('local-needs-001-runA')
    expect(r).toHaveTextContent('нейросеть бесплатно без регистрации')
    expect(r).toHaveTextContent('86 201') // частота с разделителями
    expect(r).toHaveTextContent('16')
    expect(r).toHaveTextContent('8') // щели
  })

  it('клик по строке открывает дерево, «Назад» возвращает к таблице', async () => {
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))

    const tree = await screen.findByTestId('needs-tree')
    expect(within(tree).getByTestId('needs-condition')).toHaveTextContent('бесплатно · без регистрации')
    expect(screen.getAllByTestId('needs-work')).toHaveLength(2)
    expect(screen.queryByTestId('needs-row')).toBeNull()

    await userEvent.click(screen.getByTestId('needs-back'))
    expect(await screen.findByTestId('needs-row')).toBeTruthy()
    expect(screen.queryByTestId('needs-tree')).toBeNull()
  })

  it('работа раскрывается: фразы с частотами и сегмент', async () => {
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const work = (await screen.findAllByTestId('needs-work'))[0]

    expect(screen.queryAllByTestId('needs-phrase')).toHaveLength(0) // свёрнуто
    await userEvent.click(within(work).getByTestId('needs-toggle'))

    const phrases = within(work).getAllByTestId('needs-phrase')
    expect(phrases).toHaveLength(3) // 2 свои + 1 из сегмента
    expect(phrases[0]).toHaveTextContent('оживить фото нейросеть бесплатно без регистрации')
    expect(phrases[0]).toHaveTextContent('11 081')
    expect(within(work).getByTestId('needs-segment')).toHaveTextContent('через Алису')
    expect(within(work).getByText(/анимировать статичный снимок/)).toBeTruthy()
  })

  it('шанс виден на работе и объясняется при наведении', async () => {
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const works = await screen.findAllByTestId('needs-work')
    const score = within(works[0]).getByTestId('needs-score')
    expect(score).toHaveTextContent('35')
    expect(score).toHaveAttribute('title', 'спрос большой, но работу держит Алиса')
  })

  it('показывает сумму частот и отдельно прежний максимум', async () => {
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const work = (await screen.findAllByTestId('needs-work'))[0]

    expect(within(work).getByTestId('needs-sum-freq')).toHaveTextContent('Σ 12 388')
    expect(within(work).getByTestId('needs-top-freq')).toHaveTextContent('max 11 081')
  })

  it('щель и занятость видны на строке работы', async () => {
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const works = await screen.findAllByTestId('needs-work')
    expect(within(works[0]).getByTestId('needs-occupied')).toHaveTextContent('Яндекс Алиса')
    expect(within(works[0]).queryByTestId('needs-gap')).toBeNull()
    expect(within(works[1]).getByTestId('needs-gap')).toHaveTextContent('ЩЕЛЬ')
  })

  it('исключённые фразы скрыты и раскрываются по причинам', async () => {
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    await screen.findByTestId('needs-tree')
    expect(screen.queryByTestId('needs-excluded')).toBeNull()

    await userEvent.click(screen.getByTestId('needs-excluded-toggle'))
    const ex = screen.getByTestId('needs-excluded')
    expect(ex).toHaveTextContent('бренд')
    expect(ex).toHaveTextContent('каталог')
    expect(within(ex).getAllByTestId('needs-phrase')).toHaveLength(2)
  })

  it('ошибка чтения папки показывается, а не молчит', async () => {
    fetchMock.mockImplementation(async () => res(422, { error: 'дерево не читается', detail: 'битый json' }))
    render(<NeedsPane active />)
    const err = await screen.findByTestId('needs-error')
    expect(err).toHaveTextContent('дерево не читается')
    expect(err).toHaveTextContent('битый json')
  })

  it('битое дерево в списке помечено, но список показан', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/needs/tree/')
        ? res(200, TREE)
        : res(200, { trees: [row(), row({ id: 'broken', error: 'ожидался объект', works: 0 })] }),
    )
    render(<NeedsPane active />)
    const rows = await screen.findAllByTestId('needs-row')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toHaveTextContent('ожидался объект')
  })

  it('пустая папка — понятная подсказка', async () => {
    fetchMock.mockImplementation(async () => res(200, { trees: [] }))
    render(<NeedsPane active />)
    expect(await screen.findByText(/деревьев пока нет/)).toBeTruthy()
  })
})

describe('меню действий', () => {
  const opened = async () => {
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const work = (await screen.findAllByTestId('needs-work'))[0]
    await userEvent.click(within(work).getByTestId('needs-menu').querySelector('summary')!)
    return work
  }

  it('три Basic-действия и по три анализа каждого семейства с подсказками', async () => {
    const work = await opened()
    for (const id of [
      'season', 'adjacent', 'dump',
      'claude-analyze', 'claude-analyze_adv', 'claude-product', 'claude-test',
      'codex-analyze', 'codex-analyze_adv', 'codex-product', 'codex-test',
    ]) {
      const b = within(work).getByTestId('needs-run-' + id)
      expect(b).toBeEnabled()
      expect(b.getAttribute('title')!.length).toBeGreaterThan(40)
    }
    expect(within(work).getByText('Basic')).toBeTruthy()
    expect(within(work).getByText('Claude')).toBeTruthy()
    expect(within(work).getByText('Codex')).toBeTruthy()
  })

  it('второй проход есть у Claude и Codex и требует подтверждения', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/needs/refine')
        ? res(200, { task_id: 'refine-1' })
        : url.includes('/api/needs/tree/')
          ? res(200, { ...TREE, revision: 2 })
          : res(200, { trees: [row()] }),
    )
    await opened()
    expect(screen.getByTestId('needs-refine-bar')).toHaveTextContent('Классификация v2')
    expect(screen.getByTestId('needs-refine-claude')).toBeEnabled()
    await userEvent.click(screen.getByTestId('needs-refine-codex'))
    expect(await screen.findByTestId('needs-refine-confirm')).toHaveTextContent(
      'разделит работы, которым нужны разные микро-продукты',
    )
    await userEvent.click(screen.getByTestId('needs-refine-confirm-yes'))

    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/needs/refine'))!
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      tree_id: TREE.id,
      model_family: 'codex',
    })
  })

  it('после выбора действия меню закрывается', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/needs/season')
        ? res(200, { task_id: 't9' })
        : url.includes('/api/needs/tree/')
          ? res(200, TREE)
          : res(200, { trees: [row()] }),
    )
    const work = await opened()
    const menu = within(work).getByTestId('needs-menu')
    expect(menu).toHaveAttribute('open')

    await userEvent.click(within(work).getByTestId('needs-run-season'))
    expect(menu).not.toHaveAttribute('open')
  })

  it('команда анализа передаёт slug семейства модели', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/needs/analyze')
        ? res(200, { task_id: 'c1' })
        : url.includes('/api/needs/tree/')
          ? res(200, TREE)
          : res(200, { trees: [row()] }),
    )
    const work = await opened()
    await userEvent.click(within(work).getByTestId('needs-run-codex-analyze'))
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/needs/analyze'))!
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      tree_id: TREE.id,
      work: 'оживить фото',
      model_family: 'codex',
    })
  })

  it('первый запуск идёт сразу, повторный — через подтверждение', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/needs/season')) return res(200, { task_id: 't9' })
      if (url.includes('/api/needs/tree/')) {
        return res(200, {
          ...TREE,
          works: [
            {
              ...TREE.works[0],
              artifacts: [
                {
                  kind: 'analyze',
                  created_at: 1,
                  report_link: 'reports/r1.html',
                  task_id: 'r1',
                  verdict: 'SKIP',
                  verdict_score: 30,
                  summary: null,
                },
              ],
            },
            TREE.works[1],
          ],
        })
      }
      return res(200, { trees: [row()] })
    })
    const work = await opened()

    // сезонности ещё не было — запускается без вопросов
    await userEvent.click(within(work).getByTestId('needs-run-season'))
    expect(screen.queryByTestId('needs-confirm')).toBeNull()

    // разбор уже был: счётчик на кнопке и подтверждение вместо запуска
    await userEvent.click(within(work).getByTestId('needs-menu').querySelector('summary')!)
    const again = within(work).getByTestId('needs-run-claude-analyze')
    expect(again).toHaveTextContent('(1)')
    await userEvent.click(again)
    expect(await screen.findByTestId('needs-confirm')).toHaveTextContent('уже делали')
  })

  it('на работе три оценки и MRR схлопнуты в один кружок семейства', async () => {
    // они отвечают на разные вопросы: «Ниша» про перехват трафика, «Функции» про то, за что
    // платят, «Продукт» про спецификацию. Расхождение — сигнал, поэтому показываем все три
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/needs/tree/')
        ? res(200, {
            ...TREE,
            works: [
              {
                ...TREE.works[0],
                artifacts: [
                  { kind: 'analyze', model_family: 'codex', created_at: 4, report_link: 'reports/c.html', task_id: 'c', verdict: 'MAYBE', verdict_score: 44, summary: null },
                  { kind: 'analyze_product', created_at: 3, report_link: 'reports/p.html', task_id: 'p', verdict: 'BUILD', verdict_score: 72, summary: 'бот-расшифровщик, 199 ₽/мес', mrr6: 39800 },
                  { kind: 'analyze_adv', created_at: 2, report_link: 'reports/adv.html', task_id: 'adv', verdict: 'MAYBE', verdict_score: 58, summary: null },
                  { kind: 'analyze', created_at: 1, report_link: 'reports/a1.html', task_id: 'a1', verdict: 'SKIP', verdict_score: 27, summary: null },
                ],
                analysis: { verdict: 'SKIP', verdict_score: 27, report_link: 'reports/a1.html', created_at: 1, searched: [], confidence: 0.5 },
              },
              TREE.works[1],
            ],
          })
        : res(200, { trees: [row()] }),
    )
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const work = (await screen.findAllByTestId('needs-work'))[0]

    const score = within(work).getByTestId('needs-score-claude')
    expect(score).toHaveTextContent('(27,58,72)')
    expect(within(work).getByTestId('needs-mrr-claude')).toHaveTextContent('39 800 ₽/мес')
    expect(score).toHaveAttribute('title', expect.stringContaining('1: SKIP 27'))
    expect(score).toHaveAttribute('title', expect.stringContaining('2: MAYBE 58'))
    expect(score).toHaveAttribute('title', expect.stringContaining('3: BUILD 72'))
    expect(within(work).getByTestId('needs-score-codex')).toHaveTextContent('(44)')
    expect(within(work).queryByTestId('needs-mrr-codex')).toBeNull()

    // счётчик прогонов на кнопке ищет СВОЙ вид артефакта: «Продукт» запускается как `product`,
    // а копится как `analyze_product` — раньше на этой паре счётчик молчал
    await userEvent.click(within(work).getByTestId('needs-menu').querySelector('summary')!)
    expect(within(work).getByTestId('needs-run-claude-product')).toHaveTextContent('(1)')
    expect(within(work).getByTestId('needs-run-claude-analyze_adv')).toHaveTextContent('(1)')
  })

  it('все отчёты остаются ссылками, а не заменяют друг друга', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/needs/tree/')
        ? res(200, {
            ...TREE,
            works: [
              {
                ...TREE.works[0],
                artifacts: [
                  { kind: 'analyze', created_at: 3, report_link: 'reports/a2.html', task_id: 'a2', verdict: 'MAYBE', verdict_score: 55, summary: null },
                  { kind: 'analyze', created_at: 2, report_link: 'reports/a1.html', task_id: 'a1', verdict: 'SKIP', verdict_score: 30, summary: null },
                  { kind: 'season', created_at: 1, report_link: 'reports/s1.html', task_id: 's1', verdict: null, verdict_score: null, summary: 'сезонность есть, размах ×11.9' },
                ],
              },
              TREE.works[1],
            ],
          })
        : res(200, { trees: [row()] }),
    )
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const work = (await screen.findAllByTestId('needs-work'))[0]
    // ссылки живут внутри того же меню, что и действия: их может накопиться много
    await userEvent.click(within(work).getByTestId('needs-menu').querySelector('summary')!)
    expect(within(work).getByTestId('needs-report-season').closest('.menu-body')).not.toBeNull()

    const analyze = within(work).getAllByTestId('needs-report-claude-analyze')
    expect(analyze).toHaveLength(2)
    expect(analyze[0]).toHaveTextContent('Ниша 1')
    expect(analyze[1]).toHaveTextContent('Ниша 2')
    const season = within(work).getByTestId('needs-report-season')
    expect(season).toHaveAttribute('href', '/reports/s1.html')
    expect(season.getAttribute('title')).toContain('размах')
  })

  // отчёт появляется файлом рядом с деревом, а событий второго слоя по WS нет: единственный
  // сигнал «готово» — смена статуса в журнале задач, и она приходит независимо от того, кто
  // задачу запускал. После перезагрузки страницы запуск «наш» уже неотличим от чужого.
  it('перечитывает дерево, когда чужая задача второго слоя завершилась', async () => {
    const task = (status: string): TaskRow => ({
      id: 's7', type: 'needs_season', node: 'оживить фото', status: status as TaskRow['status'],
      created_at: 1, started_at: 1, finished_at: null, error: null,
    })
    const { rerender } = render(<NeedsPane active tasks={[task('RUNNING')]} />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    await screen.findAllByTestId('needs-work')
    const before = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/needs/tree/')).length

    rerender(<NeedsPane active tasks={[task('DONE')]} />)
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/needs/tree/')).length,
      ).toBe(before + 1),
    )
  })
})
