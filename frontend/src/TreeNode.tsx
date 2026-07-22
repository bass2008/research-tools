import { useEffect, useRef, useState } from 'react'
import { expand, fmt } from './api'
import type { Child } from './api'

interface Props {
  phrase: string
  freq: number | null
  isRoot?: boolean
  cached?: boolean // отдельно запрошена -> есть свой (глубже) пул
  childCount?: number // реальные уточнения в кэше (если cached)
  localChildren?: Child[] // локальные дети из пула родителя
}

// Два типа раскрытия:
//   СИНИЙ +  — реальные уточнения (из Вордстата/кэша, ⚡). Точнее и глубже.
//   СЕРЫЙ +  — локальные из пула top-2000 родителя (приблизительно, бесплатно, сразу).
//   Load     — добурить по-настоящему узел с фронтира (сеть). После — станет синим.
export function TreeNode({ phrase, freq, isRoot, cached, childCount, localChildren }: Props) {
  const [realLoaded, setRealLoaded] = useState(false)
  const [realChildren, setRealChildren] = useState<Child[]>([])
  const [realTotal, setRealTotal] = useState(0)
  const [ownFreq, setOwnFreq] = useState<number | null>(freq)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [visible, setVisible] = useState(120) // пагинация детей (дозагрузка вширь)
  const autoLoaded = useRef(false)

  const localKids = localChildren ?? []
  const hasLocal = localKids.length > 0
  const hasRealCached = !!cached && (childCount ?? 0) > 0
  const isReal = realLoaded || hasRealCached
  const displayKids = realLoaded ? realChildren : localKids
  const expandable = realLoaded ? realChildren.length > 0 : hasLocal || hasRealCached
  const showLoad = !cached && !realLoaded && !isRoot // фронтир: можно добурить

  async function drillReal(openAfter: boolean) {
    if (loading || realLoaded) return
    setLoading(true)
    setError(false)
    try {
      const d = await expand(phrase)
      setRealChildren(d.children)
      setRealTotal(d.total)
      if (ownFreq == null && d.freq != null) setOwnFreq(d.freq)
      setRealLoaded(true)
      setOpen(openAfter && d.children.length > 0)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isRoot && !autoLoaded.current) {
      autoLoaded.current = true
      void drillReal(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onToggle() {
    if (realLoaded) {
      setOpen((o) => !o)
      return
    }
    if (hasRealCached) {
      void drillReal(true) // синий: реальные из кэша мгновенно
      return
    }
    if (hasLocal) setOpen((o) => !o) // серый: локальные из пула
  }

  let badge = ''
  if (realLoaded) {
    const s = Math.min(realTotal, realChildren.length)
    badge = realTotal === 0 ? '∅' : `${s}${s < realTotal ? '/' + realTotal : ''} ↓`
  } else if (hasRealCached) {
    badge = `${childCount} ⚡ ↓`
  } else if (hasLocal) {
    badge = `${localKids.length} ↓`
  }
  const showBadge = realLoaded || hasRealCached || hasLocal

  return (
    <div className="node">
      <div className="row">
        {expandable ? (
          <button
            className={'tg ' + (isReal ? 'tg-real' : 'tg-local')}
            title={
              isReal
                ? 'реальные уточнения (Вордстат/кэш)'
                : 'локальные из пула top-2000 (приблизительно, бесплатно)'
            }
            onClick={onToggle}
          >
            {open ? '−' : '+'}
          </button>
        ) : (
          <span className="tg-spacer" />
        )}
        <span className="ph">{phrase}</span>
        <span className="fr">{fmt(ownFreq)}</span>
        {showBadge && (
          <span
            className={'ct' + (isReal ? '' : ' ct-local')}
            title="реальные (⚡) / локальные из пула"
          >
            {badge}
          </span>
        )}
        {showLoad && (
          <button
            className={'load' + (error ? ' err' : '')}
            onClick={() => drillReal(false)}
            disabled={loading}
            title="добурить по-настоящему (сеть)"
          >
            {loading ? '…' : error ? '⟳ ещё' : 'Load'}
          </button>
        )}
      </div>
      {expandable && (
        <div className="kids" style={{ display: open ? '' : 'none' }}>
          {displayKids.slice(0, visible).map((c, i) => (
            <TreeNode
              key={c.phrase + '#' + i}
              phrase={c.phrase}
              freq={c.freq}
              cached={c.cached}
              childCount={c.childCount}
              localChildren={c.children}
            />
          ))}
          {displayKids.length > visible && (
            <button className="more" onClick={() => setVisible((v) => v + 200)}>
              показать ещё {displayKids.length - visible} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
