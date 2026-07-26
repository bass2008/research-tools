// Матрица «статус → кнопки» — проверяется ЦЕЛИКОМ: рендерятся только разрешённые кнопки и
// никаких лишних. Дерево запросов отвечает за загрузку, поэтому статусов три; выводы (интент,
// конкуренция, отчёт) переехали во второй слой, где единица — работа.
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import type { Status } from '../api'
import { ALL_BTNS, STATUSES, actionEls, actionsOf, node, nodeEl, renderTree } from './helpers'

// Таблица-источник.
const MATRIX: Record<Status, string[]> = {
  NEW: ['btn-load', 'btn-full-load'],
  LOADED: ['btn-full-load'],
  FULLY_LOADED: ['btn-needs-build'],
}

describe('матрица «статус → кнопки»', () => {
  it('таблица покрывает все статусы', () => {
    expect(Object.keys(MATRIX).sort()).toEqual([...STATUSES].sort())
  })

  it.each(STATUSES)('%s — ровно разрешённые кнопки и никаких лишних', (status) => {
    const want = MATRIX[status]
    const { container } = renderTree({ root: 'p', nodes: [node('p', { status })] })

    expect([...actionsOf(container, 'p')].sort()).toEqual([...want].sort())
    for (const t of ALL_BTNS) {
      if (want.includes(t)) expect(screen.getByTestId(t)).toBeInTheDocument()
      else expect(screen.queryByTestId(t)).toBeNull()
    }
    // выводов по фразе на узле больше нет: ни скор, ни вердикт, ни ссылка на отчёт
    for (const gone of ['node-score', 'node-verdict', 'btn-link']) {
      expect(screen.queryByTestId(gone)).toBeNull()
    }
  })

  it.each(STATUSES)('%s — статус отображается на узле', (status) => {
    const { container } = renderTree({ root: 'p', nodes: [node('p', { status })] })
    expect(nodeEl(container, 'p').querySelector('[data-testid="node-status"]')).toHaveTextContent(
      status,
    )
  })

  it('кнопка операции запускает команду через контекст', () => {
    const { api } = renderTree({ root: 'p', nodes: [node('p', { status: 'FULLY_LOADED' })] })
    fireEvent.click(screen.getByTestId('btn-needs-build'))
    expect(api.run).toHaveBeenCalledWith('p', 'needs_build')
  })

  it('загруженная ветка ведёт к сборке потребностей, а не к разметке узлов', () => {
    renderTree({ root: 'p', nodes: [node('p', { status: 'FULLY_LOADED' })] })
    // classify/drill/score/analyze с узла убраны: выводы делает второй слой по работе
    for (const gone of ['btn-classify', 'btn-drill', 'btn-score', 'btn-analyze',
                        'btn-search', 'btn-fix-kind', 'btn-search-view']) {
      expect(screen.queryByTestId(gone)).toBeNull()
    }
    expect(screen.getByTestId('btn-needs-build')).toBeInTheDocument()
  })
})

// Блокировка (design §8, tech §6): занят узел -> его кнопки disabled и кнопки всего поддерева.
describe('блокировка занятого узла и его поддерева', () => {
  const tree = (rootBusy: string | null, childBusy: string | null = null) =>
    renderTree({
      root: 'root',
      nodes: [
        node('root', { status: 'NEW', task_id: rootBusy }),
        node('kid', { status: 'LOADED', task_id: childBusy }),
        node('grand', { status: 'FULLY_LOADED' }),
      ],
      kids: {
        root: [node('kid', { status: 'LOADED', task_id: childBusy })],
        kid: [node('grand', { status: 'FULLY_LOADED' })],
      },
    })

  it('свободное дерево: кнопки узла и поддерева активны', () => {
    const { container } = tree(null)
    for (const p of ['root', 'kid', 'grand']) {
      const els = actionEls(container, p)
      expect(els.length).toBeGreaterThan(0)
      for (const e of els) expect(e).not.toBeDisabled()
    }
    expect(nodeEl(container, 'root').className).not.toContain('busy')
  })

  it('узел занят → его кнопки disabled', () => {
    const { container } = tree('task-1')
    const els = actionEls(container, 'root')
    expect(els.length).toBe(2)   // NEW: Load + Full load
    for (const e of els) expect(e).toBeDisabled()
    expect(nodeEl(container, 'root').className).toContain('busy')
  })

  it('узел занят → кнопки всего ПОДДЕРЕВА тоже disabled', () => {
    const { container } = tree('task-1')
    for (const p of ['kid', 'grand']) {
      const els = actionEls(container, p)
      expect(els.length).toBeGreaterThan(0)
      for (const e of els) expect(e).toBeDisabled()
    }
  })

  it('занят ребёнок → блокируется он и его поддерево, но НЕ родитель', () => {
    const { container } = tree(null, 'task-2')
    for (const e of actionEls(container, 'root')) expect(e).not.toBeDisabled()
    for (const e of actionEls(container, 'kid')) expect(e).toBeDisabled()
    for (const e of actionEls(container, 'grand')) expect(e).toBeDisabled()
  })

  it('заблокированная кнопка не запускает команду', () => {
    const { api, container } = tree('task-1')
    fireEvent.click(actionEls(container, 'root')[0])
    expect(api.run).not.toHaveBeenCalled()
  })

  it('индикатор операции есть у заблокированных узлов и отсутствует у свободных', () => {
    const spin = (c: HTMLElement, p: string) =>
      nodeEl(c, p).firstElementChild!.querySelector('.spin')

    const busy = tree('task-1').container
    expect(spin(busy, 'root')).not.toBeNull()

    const free = tree(null).container
    for (const p of ['root', 'kid', 'grand']) expect(spin(free, p)).toBeNull()
  })

  it('ошибка узла видна и не меняет набор кнопок', () => {
    const { container } = renderTree({
      root: 'p',
      nodes: [node('p', { status: 'LOADED', error: 'ReadTimeout: timed out' })],
    })
    expect(screen.getByTestId('node-error')).toHaveTextContent('ReadTimeout')
    expect([...actionsOf(container, 'p')].sort()).toEqual([...MATRIX.LOADED].sort())
  })
})
