// Вкладка «Дерево потребностей»: таблица -> дерево -> назад. Второй слой только читается,
// поэтому проверяем показ, а не команды.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NeedsPane } from '../NeedsPane'
import type { NeedsRow, NeedsTree } from '../api'

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
  counts: { works: 2, segments: 1, phrases: 4, excluded: 2, gaps: 1, occupied: 1, needs_serp: 1 },
  works: [
    {
      name: 'оживить фото',
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
      top_freq: 589,
      phrase_count: 1,
      occupied_by: null,
      unclear: false,
      gap_candidate: true,
      needs_serp: false,
      serp_question: null,
      why: 'узкая аудитория, мейнстрим не обслуживает',
      phrases: [{ phrase: 'генератор фанфиков нейросеть бесплатно без регистрации', freq: 589 }],
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
