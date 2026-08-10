// Вкладка «Дерево продуктов»: три уровня группировки и три разбора по группе.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductsPane } from '../ProductsPane'
import type { NeedsTree, ProductGroup, ProductLevel } from '../api'

const group = (id: string, level: ProductLevel, over: Partial<ProductGroup> = {}): ProductGroup => ({
  id,
  level,
  name: `продукт ${id}`,
  works: ['оживить фото'],
  parent: level === 'macro' ? null : 'macro-1',
  input: 'фото',
  engine: 'диффузия',
  output: 'короткое видео',
  money: 'разово 199 ₽',
  pool: 204741,
  pool_why: 'контейнер «оживить фото» 204 741',
  core: 'загрузил фото — получил видео',
  order: ['добавить озвучку'],
  why: 'один вход и один движок',
  work_items: [
    {
      name: 'оживить фото',
      top_freq: 11081,
      sum_freq: 11815,
      phrase_count: 3,
      unclear: false,
      why: 'одна работа: анимировать статичный снимок',
      score: 35,
      intent: 'mixed',
      blocker: 'много информационных запросов',
      phrases: [
        { phrase: 'оживить фото нейросеть', freq: 11081 },
        { phrase: 'оживление фото онлайн', freq: 734 },
      ],
      sections: [{ name: 'через Алису', kind: 'segment', why: 'другой вход', phrase_count: 1 }],
    },
  ],
  sum_freq: 12388,
  top_freq: 11081,
  phrase_count: 3,
  section_count: 1,
  best_score: 35,
  artifacts: [],
  ...over,
})

const TREE = {
  id: 'local-needs-001',
  condition: 'бесплатно · без регистрации',
  root: 'нейросеть бесплатно без регистрации',
  root_freq: 86201,
  created_at: 1785091133,
  counts: { works: 2, best_score: 88, ranked: 2, segments: 1, phrases: 4, excluded: 2 },
  works: [],
  excluded: [],
  products: {
    task_id: 'p1',
    model_family: 'claude',
    created_at: 1785091200,
    tree_revision: 0,
    why: 'ветка складывается в один комплексный продукт',
    report_link: 'reports/p1.html',
    groups: [
      group('macro-1', 'macro'),
      group('medium-1', 'medium'),
      group('micro-1', 'micro'),
      group('micro-2', 'micro', {
        artifacts: [
          {
            kind: 'analyze',
            created_at: 5,
            report_link: 'reports/a.html',
            task_id: 'a',
            verdict: 'MAYBE',
            verdict_score: 58,
            summary: null,
            model_family: 'claude',
          },
        ],
      }),
    ],
  },
} as unknown as NeedsTree

const res = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () => res(200, TREE))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('вкладка «Дерево продуктов»', () => {
  it('без выбранной ветки показывает свой список и даёт выбрать', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/needs/trees')
        ? res(200, { trees: [{ id: 'local-needs-001', root: 'матрица судьбы', root_freq: 1069301, works: 23, products: 32 }] })
        : res(200, TREE),
    )
    render(<ProductsPane active treeId={null} tasks={[]} />)

    const pick = await screen.findByTestId('products-tree-row')
    expect(pick).toHaveTextContent('матрица судьбы')
    expect(pick).toHaveTextContent('32')

    await userEvent.click(pick)
    expect(await screen.findByTestId('products-level-macro')).toBeTruthy()
  })

  it('пока вкладка не открыта, за деревом не ходит', async () => {
    render(<ProductsPane active={false} treeId="local-needs-001" tasks={[]} />)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('показывает один уровень за раз и переключается кнопками', async () => {
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)

    // по умолчанию — комплексные: сверху вниз, от всей ветки к нарезке
    expect(await screen.findByTestId('products-level-macro')).toBeTruthy()
    expect(screen.queryByTestId('products-level-micro')).toBeNull()
    expect(screen.getAllByTestId('product-group')).toHaveLength(1)

    await userEvent.click(screen.getByTestId('products-level-btn-micro'))
    expect(await screen.findByTestId('products-level-micro')).toBeTruthy()
    expect(screen.queryByTestId('products-level-macro')).toBeNull()
    expect(screen.getAllByTestId('product-group')).toHaveLength(2)
  })

  it('показывает агрегаты группы', async () => {
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)
    await screen.findByTestId('products-level-macro')

    const first = screen.getAllByTestId('product-group')[0]
    expect(within(first).getByTestId('product-pool')).toHaveTextContent('204 741')
    expect(within(first).getByTestId('product-sum-freq')).toHaveTextContent('12 388')
    expect(within(first).getByTestId('product-best-score')).toHaveTextContent('35')
    // «вход → движок → выход» и модель денег живут в подсказке: в строке они ломали вёрстку
    const io = within(first).getByTestId('product-io')
    expect(io.getAttribute('title')).toContain('фото → диффузия → короткое видео')
    expect(io.getAttribute('title')).toContain('Деньги: разово 199 ₽')
  })

  it('раскрытая группа показывает свои работы с рангом и интентом', async () => {
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)
    const first = (await screen.findAllByTestId('product-group'))[0]

    expect(within(first).queryAllByTestId('product-work')).toHaveLength(0)
    await userEvent.click(within(first).getByTestId('product-toggle'))

    const work = within(first).getByTestId('product-work')
    expect(work).toHaveTextContent('оживить фото')
    expect(work).toHaveTextContent('11 081')
    expect(work).toHaveTextContent('11 815')      // Σ по фразам потребности
    expect(work).toHaveTextContent('35')
    expect(work).toHaveTextContent('смешанный интент')
    expect(within(first).getByText(/контейнер «оживить фото»/)).toBeTruthy()

    // продукт → потребность → ключи: фразы раскрываются на самой потребности
    expect(within(work).queryAllByTestId('needs-phrase')).toHaveLength(0)
    await userEvent.click(within(work).getByTestId('product-work-toggle'))
    const phrases = within(work).getAllByTestId('needs-phrase')
    expect(phrases).toHaveLength(2)
    expect(phrases[0]).toHaveTextContent('оживить фото нейросеть')
    expect(phrases[0]).toHaveTextContent('11 081')
    expect(work).toHaveTextContent('через Алису')
  })

  it('разбор запускается по ГРУППЕ, а не по работе', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/needs/analyze') ? res(200, { task_id: 'x1' }) : res(200, TREE),
    )
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)
    const first = (await screen.findAllByTestId('product-group'))[0]

    await userEvent.click(within(first).getByTestId('product-menu').querySelector('summary')!)
    await userEvent.click(within(first).getByTestId('product-run-codex-analyze'))
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/needs/analyze'))!
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      tree_id: 'local-needs-001',
      group: 'macro-1',
      model_family: 'codex',
    })
  })

  it('лайк стоит на продукте, а не на потребности', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/needs/favorite')
        ? res(200, { group: 'macro-1', favorite: true, favorites: ['macro-1'] })
        : res(200, TREE),
    )
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)
    const first = (await screen.findAllByTestId('product-group'))[0]

    const heart = within(first).getByTestId('product-favorite')
    expect(heart).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(heart)

    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/needs/favorite'))!
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      tree_id: 'local-needs-001',
      group: 'macro-1',
      favorite: true,
    })
    await waitFor(() => expect(heart).toHaveAttribute('aria-pressed', 'true'))

    // у потребности внутри продукта ни лайка, ни меню действий нет
    await userEvent.click(within(first).getByTestId('product-toggle'))
    const work = within(first).getByTestId('product-work')
    expect(within(work).queryByTestId('product-favorite')).toBeNull()
    expect(within(work).queryByTestId('product-menu')).toBeNull()
  })

  it('выгрузка топа запускается по группе и без семейства модели', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/needs/dump') ? res(200, { task_id: 'd1' }) : res(200, TREE),
    )
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)
    const first = (await screen.findAllByTestId('product-group'))[0]

    await userEvent.click(within(first).getByTestId('product-menu').querySelector('summary')!)
    await userEvent.click(within(first).getByTestId('product-run-dump'))

    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/needs/dump'))!
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      tree_id: 'local-needs-001',
      group: 'macro-1',
    })
  })

  it('готовый отчёт группы остаётся ссылкой с оценкой', async () => {
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)
    await userEvent.click(await screen.findByTestId('products-level-btn-micro'))
    const groups = await screen.findAllByTestId('product-group')
    const withReport = groups[groups.length - 1]      // micro-2, у него засеян отчёт

    await userEvent.click(within(withReport).getByTestId('product-menu').querySelector('summary')!)
    const link = within(withReport).getByTestId('product-report-claude-analyze')
    expect(link).toHaveAttribute('href', '/reports/a.html')
    expect(link).toHaveTextContent('Ниша')
    expect(within(withReport).getByTestId('needs-score-claude')).toHaveTextContent('58')
  })

  it('пересборка требует подтверждения и предупреждает о потере разборов', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      String(url).includes('/api/needs/products') ? res(200, { task_id: 'p2' }) : res(200, TREE),
    )
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)
    await userEvent.click((await screen.findByTestId('tree-actions')).querySelector('summary')!)
    await userEvent.click(screen.getByTestId('products-rebuild-claude'))

    // без подтверждения запроса нет: операция удаляет уже сделанную работу
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/api/needs/products'))).toBe(false)
    const warn = await screen.findByTestId('products-rebuild-warn')
    expect(warn).toHaveTextContent('будут удалены вместе с отчётами')
    expect(warn).toHaveTextContent('1 из 4')      // отчёты засеяны одной группе из четырёх

    await userEvent.click(screen.getByTestId('products-rebuild-confirm-yes'))
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/api/needs/products'))!
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      tree_id: 'local-needs-001',
      model_family: 'claude',
    })
  })

  it('отчёт группировки открывается из панели', async () => {
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)
    const link = await screen.findByTestId('products-report')
    expect(link).toHaveAttribute('href', '/reports/p1.html')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('без группировки объясняет, где кнопка', async () => {
    fetchMock.mockImplementation(async () => res(200, { ...TREE, products: null }))
    render(<ProductsPane active treeId="local-needs-001" tasks={[]} />)
    expect(await screen.findByTestId('products-none')).toHaveTextContent('ещё не собрано')
  })
})
