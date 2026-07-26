// Матрица «статус → кнопки» (design §2, testing-plan §7) — проверяется ЦЕЛИКОМ:
// рендерятся только разрешённые кнопки и никаких лишних. Плюс Link и блокировки.
import { describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import type { Status } from '../api'
import { ALL_BTNS, STATUSES, actionEls, actionsOf, node, nodeEl, renderTree } from './helpers'

// Таблица-источник (design §2 «Кнопки по статусу»).
const MATRIX: Record<Status, string[]> = {
  NEW: ['btn-load', 'btn-full-load', 'btn-drill'],
  LOADED: ['btn-full-load', 'btn-drill'],
  FULLY_LOADED: ['btn-classify', 'btn-drill'],
  TRANSACTIONAL: ['btn-search', 'btn-drill', 'btn-fix-kind'],
  SEARCHED: ['btn-score', 'btn-drill'],
  SCORED: ['btn-analyze', 'btn-drill', 'btn-search-view'],
  CATEGORY: ['btn-fix-kind'],
  INFORMATIONAL: ['btn-fix-kind'],
  NAVIGATIONAL: ['btn-fix-kind'],
  LOW_SCORED: ['btn-search-view'],
  ANALYZED: [],
}

describe('матрица «статус → кнопки» (design §2)', () => {
  it('таблица покрывает все 11 статусов', () => {
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
    // без отчёта Link не показывается ни при каком статусе
    expect(screen.queryByTestId('btn-link')).toBeNull()
  })

  it.each(STATUSES)('%s — статус отображается на узле', (status) => {
    const { container } = renderTree({ root: 'p', nodes: [node('p', { status })] })
    expect(nodeEl(container, 'p').querySelector('[data-testid="node-status"]')).toHaveTextContent(
      status,
    )
  })

  it('нетерминальные статусы имеют Drill, терминальные — нет', () => {
    const terminals: Status[] = [
      'CATEGORY',
      'INFORMATIONAL',
      'NAVIGATIONAL',
      'LOW_SCORED',
      'ANALYZED',
    ]
    for (const s of STATUSES) {
      const has = MATRIX[s].includes('btn-drill')
      expect(has).toBe(!terminals.includes(s))
    }
  })

  it('Fix kind открывает выбор из остальных интентов и вызывает setKind', () => {
    const { api } = renderTree({
      root: 'p',
      nodes: [node('p', { status: 'CATEGORY', kind: 'category' })],
    })
    expect(screen.queryByTestId('btn-kind-transactional')).toBeNull()

    fireEvent.click(screen.getByTestId('btn-fix-kind'))
    expect(screen.getByTestId('btn-kind-transactional')).toBeInTheDocument()
    expect(screen.getByTestId('btn-kind-informational')).toBeInTheDocument()
    expect(screen.getByTestId('btn-kind-navigational')).toBeInTheDocument()
    // текущий kind в списке не предлагается
    expect(screen.queryByTestId('btn-kind-category')).toBeNull()

    fireEvent.click(screen.getByTestId('btn-kind-transactional'))
    expect(api.setKind).toHaveBeenCalledWith('p', 'transactional')
  })

  it('кнопка операции запускает команду через контекст', () => {
    const { api } = renderTree({ root: 'p', nodes: [node('p', { status: 'SEARCHED' })] })
    fireEvent.click(screen.getByTestId('btn-score'))
    expect(api.run).toHaveBeenCalledWith('p', 'score')
  })

  it('Search view раскрывает панель выдачи, а не команду', () => {
    const { api } = renderTree({ root: 'p', nodes: [node('p', { status: 'LOW_SCORED', score: 12 })] })
    expect(screen.queryByTestId('node-serp')).toBeNull()
    fireEvent.click(screen.getByTestId('btn-search-view'))
    expect(screen.getByTestId('node-serp')).toBeInTheDocument()
    expect(api.run).not.toHaveBeenCalled()
  })
})

describe('Link (design §2: только при наличии отчёта, при любом статусе)', () => {
  it.each(STATUSES)('%s + отчёт → Link виден', (status) => {
    renderTree({
      root: 'p',
      nodes: [node('p', { status, report_link: 'reports/abc.html' })],
    })
    const link = screen.getByTestId('btn-link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/reports/abc.html')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it.each(STATUSES)('%s без отчёта → Link не виден', (status) => {
    renderTree({ root: 'p', nodes: [node('p', { status })] })
    expect(screen.queryByTestId('btn-link')).toBeNull()
  })

  it('report_link = null трактуется как «отчёта нет»', () => {
    renderTree({ root: 'p', nodes: [node('p', { status: 'ANALYZED', report_link: null })] })
    expect(screen.queryByTestId('btn-link')).toBeNull()
  })

  it('ANALYZED без отчёта — вообще без кнопок', () => {
    const { container } = renderTree({ root: 'p', nodes: [node('p', { status: 'ANALYZED' })] })
    expect(actionsOf(container, 'p')).toEqual([])
  })

  it('абсолютная ссылка не портится префиксом', () => {
    renderTree({
      root: 'p',
      nodes: [node('p', { status: 'ANALYZED', report_link: '/reports/x.html' })],
    })
    expect(screen.getByTestId('btn-link')).toHaveAttribute('href', '/reports/x.html')
  })
})

// Блокировка (design §8, tech §6): занят узел -> его кнопки disabled и кнопки всего поддерева.
describe('блокировка занятого узла и его поддерева', () => {
  const tree = (rootBusy: string | null, childBusy: string | null = null) =>
    renderTree({
      root: 'root',
      nodes: [
        node('root', { status: 'NEW', task_id: rootBusy }),
        node('kid', { status: 'TRANSACTIONAL', task_id: childBusy }),
        node('grand', { status: 'SCORED' }),
      ],
      kids: { root: [node('kid', { status: 'TRANSACTIONAL', task_id: childBusy })], kid: [node('grand', { status: 'SCORED' })] },
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
    expect(els.length).toBe(3)
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
      nodes: [node('p', { status: 'TRANSACTIONAL', error: 'HTTP 500 от XMLRiver (Google)' })],
    })
    expect(screen.getByTestId('node-error')).toHaveTextContent('XMLRiver')
    expect([...actionsOf(container, 'p')].sort()).toEqual([...MATRIX.TRANSACTIONAL].sort())
  })
})
