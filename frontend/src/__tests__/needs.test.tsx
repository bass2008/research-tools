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
  ranked: 16,
  best_score: 88,
  ranked_at: 1_785_091_140,
  ranked_by: 'codex',
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
  ranked_at: 1_785_091_140,
  ranked_by: 'codex',
  counts: { works: 2, best_score: 88, ranked: 2, segments: 1, phrases: 4, excluded: 2 },
  products: null,      // группировка живёт в своей вкладке; здесь её нет
  works: [
    {
      name: 'оживить фото',
      score: 35,
      score_why: 'интент смешанный: часть запросов ищет инструкцию, но редактор возможен',
      intent: 'mixed',
      product: 'фото → короткое анимированное видео',
      blocker: 'много информационных запросов',
      evidence: ['оживить фото нейросеть бесплатно без регистрации'],
      factors: { external_control: 80, tool_intent: 30, outcome_clarity: 70, product_shape: 60, repeatability: 40, user_value: 55 },
      sum_freq: 12388,
      top_freq: 11081,
      phrase_count: 3,
      unclear: false,
      why: 'одна работа: анимировать статичный снимок',
      phrases: [
        { phrase: 'оживить фото нейросеть бесплатно без регистрации', freq: 11081 },
        { phrase: 'оживление фото нейросеть бесплатно без регистрации', freq: 734 },
      ],
      artifacts: [],
      segments: [
        {
          name: 'через Алису',
          why: 'работу уже закрывает голосовой помощник',
          phrases: [{ phrase: 'алиса нейросеть оживить фото бесплатно без регистрации', freq: 573 }],
        },
      ],
    },
    {
      name: 'написать фанфик',
      score: 88,
      score_why: 'ясный результат можно выдать отдельным генератором',
      intent: 'product',
      product: 'описание → законченный фанфик',
      blocker: null,
      evidence: ['генератор фанфиков нейросеть бесплатно без регистрации'],
      factors: { external_control: 95, tool_intent: 90, outcome_clarity: 85, product_shape: 90, repeatability: 75, user_value: 85 },
      sum_freq: 589,
      top_freq: 589,
      phrase_count: 1,
      unclear: false,
      why: 'узкая аудитория, мейнстрим не обслуживает',
      phrases: [{ phrase: 'генератор фанфиков нейросеть бесплатно без регистрации', freq: 589 }],
      artifacts: [],
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
    expect(score).toHaveAttribute('title', expect.stringContaining('интент смешанный'))
  })

  it('ставит сердечко и показывает только избранные работы', async () => {
    let favorites: string[] = []
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/api/needs/favorite')) {
        const body = JSON.parse(String(init?.body)) as {
          work: string
          favorite: boolean
        }
        favorites = body.favorite
          ? [...new Set([...favorites, body.work])]
          : favorites.filter((work) => work !== body.work)
        return res(200, { work: body.work, favorite: body.favorite, favorites })
      }
      return url.includes('/api/needs/tree/')
        ? res(200, TREE)
        : res(200, { trees: [row()] })
    })

    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const hearts = await screen.findAllByTestId('needs-favorite')
    expect(hearts[0]).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(hearts[0])
    await waitFor(() => expect(hearts[0]).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByTestId('needs-favorites-only')).toHaveTextContent('(1)')

    await userEvent.click(screen.getByTestId('needs-favorites-only'))
    const shown = screen.getAllByTestId('needs-work')
    expect(shown).toHaveLength(1)
    expect(shown[0]).toHaveTextContent('оживить фото')
    expect(screen.queryByText('написать фанфик')).toBeNull()

    await userEvent.click(screen.getByTestId('needs-favorite'))
    expect(await screen.findByTestId('needs-favorites-empty')).toBeTruthy()
    expect(screen.queryAllByTestId('needs-work')).toHaveLength(0)

    await userEvent.click(screen.getByTestId('needs-favorites-only'))
    expect(screen.getAllByTestId('needs-work')).toHaveLength(2)
  })

  it('до отдельного анализа классификация не показывает и не выдумывает шанс', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/needs/tree/')
        ? res(200, {
            ...TREE,
            ranked_at: null,
            ranked_by: null,
            counts: { ...TREE.counts, ranked: 0, best_score: null },
            works: TREE.works.map((w) => ({
              ...w, score: null, score_why: null, intent: null, product: null,
              blocker: null, evidence: null, factors: null,
            })),
          })
        : res(200, { trees: [row()] }),
    )
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const tree = await screen.findByTestId('needs-tree')

    expect(within(tree).queryByTestId('needs-score')).toBeNull()
    expect(tree).toHaveTextContent('продуктовый анализ не запускался')
    expect(tree).not.toHaveTextContent('82')
  })

  it('показывает сумму частот и отдельно прежний максимум', async () => {
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const work = (await screen.findAllByTestId('needs-work'))[0]

    expect(within(work).getByTestId('needs-sum-freq')).toHaveTextContent('Σ 12 388')
    expect(within(work).getByTestId('needs-top-freq')).toHaveTextContent('max 11 081')
  })

  it('форма продукта скрыта в подсказке рядом с типом интента', async () => {
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    const works = await screen.findAllByTestId('needs-work')
    expect(within(works[0]).getByTestId('needs-intent')).toHaveTextContent('смешанный интент')
    const product = within(works[0]).getByTestId('needs-product')
    expect(product).toHaveTextContent('?')
    expect(product).toHaveAttribute('title', expect.stringContaining('анимированное видео'))
    expect(works[0]).not.toHaveTextContent('статичный снимок → анимированное видео')
    expect(within(works[1]).getByTestId('needs-intent')).toHaveTextContent('продукт')
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

  it('на работе остались домеры спроса и smoke-test — разборы уехали на продукт', async () => {
    const work = await opened()
    for (const id of [
      'season', 'adjacent', 'dump', 'claude-test', 'codex-test',
    ]) {
      const b = within(work).getByTestId('needs-run-' + id)
      expect(b).toBeEnabled()
      expect(b.getAttribute('title')!.length).toBeGreaterThan(40)
    }
    expect(within(work).getByText('Basic')).toBeTruthy()
    // три разбора запускаются по группе во вкладке «Дерево продуктов», а не по работе
    expect(within(work).queryByTestId('needs-run-claude-analyze')).toBeNull()
    expect(within(work).queryByTestId('needs-run-claude-product')).toBeNull()
  })

  it('сборка дерева продуктов предупреждает, что снесёт разборы прошлой раскладки', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/needs/tree/')
        ? res(200, {
            ...TREE,
            products: {
              task_id: 'p1', model_family: 'claude', created_at: 1, tree_revision: 0,
              why: null, report_link: null,
              groups: [{ id: 'macro-1' }, { id: 'micro-1' }],
            },
          })
        : res(200, { trees: [row()] }),
    )
    render(<NeedsPane active />)
    await userEvent.click(await screen.findByTestId('needs-row'))
    await userEvent.click((await screen.findByTestId('tree-actions')).querySelector('summary')!)
    await userEvent.click(screen.getByTestId('needs-products-claude'))

    const warn = await screen.findByTestId('needs-products-warn')
    expect(warn).toHaveTextContent('2 групп')
    expect(warn).toHaveTextContent('будут удалены вместе с отчётами')
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
    // ревизия ушла из строки в подсказку на корне: решение по ней не принимают
    expect(screen.getByTestId('needs-branch')).toHaveAttribute(
      'title', expect.stringContaining('классификация v2'))
    expect(screen.getByTestId('needs-refine-claude')).toBeEnabled()
    await userEvent.click(screen.getByTestId('tree-actions').querySelector('summary')!)
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

  it('общий «Анализ» запускает Opus/Sol по принятой классификации', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('/api/needs/rank')
        ? res(200, { task_id: 'rank-1' })
        : url.includes('/api/needs/tree/')
          ? res(200, TREE)
          : res(200, { trees: [row()] }),
    )
    await opened()
    expect(screen.getByTestId('needs-rank-claude')).toBeEnabled()
    await userEvent.click(screen.getByTestId('tree-actions').querySelector('summary')!)
    await userEvent.click(screen.getByTestId('needs-rank-codex'))
    expect(await screen.findByTestId('needs-rank-confirm')).toHaveTextContent(
      'контроль результата сторонним продуктом',
    )
    await userEvent.click(screen.getByTestId('needs-rank-confirm-yes'))

    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/needs/rank'))!
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

  it('первый запуск идёт сразу, повторный — через подтверждение', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('/api/needs/dump')) return res(200, { task_id: 't9' })
      if (url.includes('/api/needs/tree/')) {
        return res(200, {
          ...TREE,
          works: [
            {
              ...TREE.works[0],
              artifacts: [
                {
                  kind: 'season',
                  created_at: 1,
                  report_link: 'reports/r1.html',
                  task_id: 'r1',
                  verdict: null,
                  verdict_score: null,
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

    // выгрузки ещё не было — запускается без вопросов
    await userEvent.click(within(work).getByTestId('needs-run-dump'))
    expect(screen.queryByTestId('needs-confirm')).toBeNull()

    // сезонность уже снимали: счётчик на кнопке и подтверждение вместо запуска
    await userEvent.click(within(work).getByTestId('needs-menu').querySelector('summary')!)
    const again = within(work).getByTestId('needs-run-season')
    expect(again).toHaveTextContent('(1)')
    await userEvent.click(again)
    expect(await screen.findByTestId('needs-confirm')).toHaveTextContent('уже считали')
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
