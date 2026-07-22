import { useState } from 'react'
import { TreeNode } from './TreeNode'

export default function App() {
  const [marker, setMarker] = useState('нейросеть')
  const [current, setCurrent] = useState('нейросеть')
  const [rootKey, setRootKey] = useState(0)

  function loadRoot() {
    setCurrent(marker.trim() || 'нейросеть')
    setRootKey((k) => k + 1) // ремонтируем дерево -> корень автозагружается
  }

  return (
    <>
      <header>
        <h1>Wordstat — дерево с до-загрузкой</h1>
        <div className="tools">
          <input
            value={marker}
            onChange={(e) => setMarker(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadRoot()
            }}
            placeholder="корневой запрос…"
          />
          <button className="go" onClick={loadRoot}>
            Загрузить корень
          </button>
        </div>
        <div className="hint">
          <b>Load</b> (справа) — подгрузить уточнения из Вордстата; после этого слева
          появляется <b>+</b> — раскрыть/свернуть загруженное (сам не грузит). Числа:
          серое — частота/мес, синее — показано/всего детей.
        </div>
      </header>
      <div id="tree">
        <TreeNode key={rootKey} phrase={current} freq={null} isRoot />
      </div>
    </>
  )
}
