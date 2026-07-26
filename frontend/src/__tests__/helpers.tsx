// Общие помощники компонентных тестов: сборка узлов, рендер поддерева, снятие кнопок узла.
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import type { Node, Status } from '../api'
import { TreeCtx, emptyNode } from '../store'
import type { TreeApi } from '../store'
import { TreeNode } from '../TreeNode'

/** Все 11 статусов FSM (design §2) — источник для параметризованных тестов. */
export const STATUSES: Status[] = [
  'NEW',
  'LOADED',
  'FULLY_LOADED',
  'TRANSACTIONAL',
  'CATEGORY',
  'INFORMATIONAL',
  'NAVIGATIONAL',
  'SEARCHED',
  'SCORED',
  'LOW_SCORED',
  'ANALYZED',
]

/** Все возможные кнопки узла — чтобы проверять «и никаких лишних». */
export const ALL_BTNS = [
  'btn-load',
  'btn-full-load',
  'btn-drill',
  'btn-classify',
  'btn-search',
  'btn-score',
  'btn-analyze',
  'btn-fix-kind',
  'btn-search-view',
]

export function node(phrase: string, over: Partial<Node> = {}): Node {
  return { ...emptyNode(phrase), freq: 1000, ...over }
}

/** Рендер поддерева с подменённым контекстом. kids — реальные дети по фразе. */
export function renderTree(opts: {
  root: string
  nodes: Node[]
  kids?: Record<string, Node[]>
}) {
  const nodes: Record<string, Node> = {}
  for (const n of opts.nodes) nodes[n.phrase] = n
  const api: TreeApi = {
    nodes,
    kids: opts.kids ?? {},
    expand: vi.fn(),
    run: vi.fn(),
    setKind: vi.fn(),
  }
  const r = render(
    <TreeCtx.Provider value={api}>
      <TreeNode phrase={opts.root} isRoot />
    </TreeCtx.Provider>,
  )
  return { ...r, api }
}

export function nodeEl(container: HTMLElement, phrase: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-testid="node-${phrase}"]`)
  if (!el) throw new Error('узел не отрендерен: ' + phrase)
  return el
}

/** testid-ы кнопок действий именно этого узла (поддерево не задевается). */
export function actionsOf(container: HTMLElement, phrase: string): string[] {
  const acts = nodeEl(container, phrase).firstElementChild!.querySelector('.acts')!
  return [...acts.querySelectorAll('[data-testid]')].map((e) => e.getAttribute('data-testid')!)
}

/** Кнопка раскрытия именно этого узла (у поддерева свои). */
export function toggleOf(container: HTMLElement, phrase: string): HTMLElement | null {
  return nodeEl(container, phrase).firstElementChild!.querySelector<HTMLElement>(
    '[data-testid="node-toggle"]',
  )
}

/** Элементы кнопок действий этого узла. */
export function actionEls(container: HTMLElement, phrase: string): HTMLElement[] {
  const acts = nodeEl(container, phrase).firstElementChild!.querySelector('.acts')!
  return [...acts.querySelectorAll<HTMLElement>('[data-testid]')]
}
