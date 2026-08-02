// Вкладка «Стоп-слова»: предложение модели слева, принятый список справа, перенос кнопками.
// Проверяем, что принимает ИМЕННО пользователь: без его действия в список ничего не уходит.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StopPane } from '../StopPane'
import type { StopState, TaskRow } from '../api'

const state = (over: Partial<StopState> = {}): StopState => ({
  kinds: ['stop', 'brand', 'unwanted'],
  saved: [{ word: 'проститутки', kind: 'stop', added_at: 1 }],
  suggestion: {
    task_id: 't1',
    root: 'телеграм',
    created_at: 2,
    words_seen: 400,
    words_total: 1200,
    stop: [
      { word: 'наркотики', why: 'запрещённое' },
      { word: 'проститутки', why: 'запрещённое' },
    ],
    brand: [{ word: 'подоляка', why: 'имя блогера' }],
    unwanted: [{ word: 'новости', why: 'там СМИ, а не работа' }],
  },
  ...over,
})

const res = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body })

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () => res(200, state()))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const body = () => JSON.parse(String(fetchMock.mock.calls.at(-1)![1].body))
const url = () => String(fetchMock.mock.calls.at(-1)![0])

describe('вкладка «Стоп-слова»', () => {
  it('пока вкладка закрыта, за списком не ходит', async () => {
    render(<StopPane active={false} />)
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled())
  })

  it('три категории; предложенное не показывается, если уже принято', async () => {
    render(<StopPane active />)
    await screen.findByTestId('stop-block-stop')

    // «проститутки» уже в списке — во втором показе слева его быть не должно
    expect(screen.getByTestId('stop-offered-count-stop')).toHaveTextContent('1')
    expect(within(screen.getByTestId('stop-offered-stop')).getByText('наркотики')).toBeTruthy()
    expect(screen.getByTestId('stop-saved-count-stop')).toHaveTextContent('1')
    expect(screen.getByTestId('stop-offered-count-brand')).toHaveTextContent('1')
    expect(screen.getByTestId('stop-offered-count-unwanted')).toHaveTextContent('1')
    expect(screen.getByTestId('stop-scanned')).toHaveTextContent('400')
  })

  it('«›» переносит выбранное слово в список, «≫» — все', async () => {
    render(<StopPane active />)
    await screen.findByTestId('stop-block-brand')

    await userEvent.selectOptions(screen.getByTestId('stop-offered-brand'), ['подоляка'])
    fetchMock.mockResolvedValueOnce(res(200, { added: 1, saved: state().saved }))
    await userEvent.click(screen.getByTestId('stop-add-brand'))

    await waitFor(() => expect(url()).toBe('/api/stopwords'))
    expect(body()).toEqual({ words: [{ word: 'подоляка', kind: 'brand' }] })

    fetchMock.mockResolvedValueOnce(res(200, { added: 1, saved: state().saved }))
    await userEvent.click(screen.getByTestId('stop-add-all-unwanted'))
    expect(body()).toEqual({ words: [{ word: 'новости', kind: 'unwanted' }] })
  })

  it('«‹» убирает принятое слово из списка', async () => {
    render(<StopPane active />)
    await screen.findByTestId('stop-block-stop')

    await userEvent.selectOptions(screen.getByTestId('stop-saved-stop'), ['проститутки'])
    fetchMock.mockResolvedValueOnce(res(200, { removed: 1, saved: [] }))
    await userEvent.click(screen.getByTestId('stop-del-stop'))

    await waitFor(() => expect(url()).toBe('/api/stopwords'))
    expect(body()).toEqual({ words: ['проститутки'] })
    expect(fetchMock.mock.calls.at(-1)![1].method).toBe('DELETE')
  })

  it('кнопка разбора отправляет узел и блокируется на время задачи', async () => {
    const task: TaskRow = {
      id: 's1',
      type: 'stopwords_scan',
      node: 'телеграм',
      status: 'RUNNING',
      created_at: 1,
      started_at: 1,
      finished_at: null,
      error: null,
    }
    const { rerender } = render(<StopPane active />)
    await screen.findByTestId('stop-block-stop')

    await userEvent.type(screen.getByTestId('stop-input'), 'телеграм')
    fetchMock.mockResolvedValueOnce(res(200, { task_id: 's1' }))
    await userEvent.click(screen.getByTestId('stop-scan'))
    await waitFor(() => expect(url()).toBe('/api/stopwords/scan'))
    expect(body()).toEqual({ phrase: 'телеграм' })

    rerender(<StopPane active tasks={[task]} />)
    expect(screen.getByTestId('stop-scan')).toBeDisabled()

    // задача закончилась — списки перечитываются, кнопка снова доступна
    const before = fetchMock.mock.calls.length
    rerender(<StopPane active tasks={[{ ...task, status: 'DONE' }]} />)
    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(before + 1))
    expect(screen.getByTestId('stop-scan')).toBeEnabled()
  })
})
