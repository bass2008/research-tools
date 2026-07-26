// Раскрытие дерева: двухцветный «+», чистое чтение (раскрытие ничего не догружает),
// пагинация вширь. design §8, tech §6.2.
import { describe, expect, it } from 'vitest'
import { fireEvent } from '@testing-library/react'
import { node, nodeEl, renderTree, toggleOf } from './helpers'

const kidNodes = (container: HTMLElement, phrase: string): HTMLElement[] => {
  const box = nodeEl(container, phrase).querySelector('.kids')
  if (!box) return []
  return [...box.children].filter((e) => e.classList.contains('node')) as HTMLElement[]
}

describe('двухцветный «+»', () => {
  // 'c' — свой пул в кэше (синий ⚡), 'k' — только локальные из пула родителя (серый)
  const tree = () =>
    renderTree({
      root: 'r',
      nodes: [
        node('r', { cached: true, childCount: 2 }),
        node('c', { cached: true, childCount: 5 }),
        node('k'),
        node('k-loc'),
      ],
      kids: { r: [node('c'), { ...node('k'), children: [node('k-loc')] }] },
    })

  it('узел со своим пулом: синий «+», раскрытие просит проекцию у сервера', () => {
    const { container, api } = tree()
    const tg = toggleOf(container, 'c')!
    expect(tg.className).toContain('tg-real')
    expect(tg).toHaveTextContent('+')
    expect(nodeEl(container, 'c')).toHaveTextContent('5 ⚡')

    fireEvent.click(tg)
    expect(api.expand).toHaveBeenCalledExactlyOnceWith('c')
  })

  it('узел с локальными детьми: серый «+», раскрытие ничего не догружает', () => {
    const { container, api } = tree()
    const tg = toggleOf(container, 'k')!
    expect(tg.className).toContain('tg-local')

    fireEvent.click(tg)
    expect(api.expand).not.toHaveBeenCalled()
    expect(nodeEl(container, 'k-loc')).toBeInTheDocument()
  })

  it('уже раскрытый узел сворачивается/разворачивается без запросов', () => {
    const { container, api } = tree()
    const box = nodeEl(container, 'r').querySelector('.kids') as HTMLElement
    expect(box.style.display).toBe('') // корень раскрыт сразу
    fireEvent.click(toggleOf(container, 'r')!)
    expect(box.style.display).toBe('none')
    expect(api.expand).not.toHaveBeenCalled()
  })

  it('узел без детей — без кнопки раскрытия', () => {
    const { container } = renderTree({
      root: 'r',
      nodes: [node('r', { cached: true, childCount: 1 }), node('leaf', { cached: true, childCount: 0 })],
      kids: { r: [node('leaf', { cached: true, childCount: 0 })] },
    })
    expect(toggleOf(container, 'leaf')).toBeNull()
  })

  it('пустой реальный пул помечается ∅', () => {
    const { container } = renderTree({
      root: 'r',
      nodes: [node('r')],
      kids: { r: [] },
    })
    expect(nodeEl(container, 'r')).toHaveTextContent('∅')
  })
})

describe('пагинация вширь', () => {
  const many = Array.from({ length: 130 }, (_, i) => node('k' + i))

  it('показывает первые 120 детей и досыпает по кнопке', () => {
    const { container, getByText } = renderTree({
      root: 'r',
      nodes: [node('r'), ...many],
      kids: { r: many },
    })
    expect(kidNodes(container, 'r')).toHaveLength(120)

    fireEvent.click(getByText(/показать ещё 10/))
    expect(kidNodes(container, 'r')).toHaveLength(130)
    expect(container.querySelector('.more')).toBeNull()
  })
})
