import { useEffect, useRef, useState } from 'react'
import * as api from './api'
import type { StopKind, StopState, StopWord, TaskRow } from './api'

// Стоп-слова — то, что мы сознательно НЕ покупаем. Модель только предлагает; список
// исключений наполняет человек, поэтому предложенное и принятое стоят рядом двумя списками.

const TITLE: Record<StopKind, string> = {
  stop: 'Стоп-слова',
  brand: 'Бренды',
  unwanted: 'Нежелательное',
}

const HINT: Record<StopKind, string> = {
  stop: 'то, что не покупаем никогда: порно, наркотики, оружие, взлом, мошенничество',
  brand: 'имя чужого продукта или человека — вход в чужой сервис, а не работа',
  unwanted: 'не запрещено, но продуктовой работы нет: новости и СМИ, вакансии, гадания',
}

const KINDS: StopKind[] = ['stop', 'brand', 'unwanted']

function errText(e: unknown): string {
  if (e instanceof api.ApiError) return `${e.status} · ${e.message}${e.detail ? ' — ' + e.detail : ''}`
  return e instanceof Error ? e.message : String(e)
}

export function StopPane({ active, tasks = [] }: { active: boolean; tasks?: TaskRow[] }) {
  const [st, setSt] = useState<StopState | null>(null)
  const [phrase, setPhrase] = useState('')
  const [err, setErr] = useState('')
  const statuses = useRef(new Map<string, string>())

  const load = () =>
    api
      .stopwords()
      .then(setSt)
      .catch((e) => setErr(errText(e)))

  useEffect(() => {
    if (active && !st) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, st])

  // разбор — фоновая задача; её финал ловим по журналу задач и перечитываем списки
  useEffect(() => {
    const seen = statuses.current
    const first = !seen.size
    let done = false
    for (const t of tasks) {
      const prev = seen.get(t.id)
      seen.set(t.id, t.status)
      if (!first && prev !== t.status && t.type === 'stopwords_scan' && t.status === 'DONE') done = true
    }
    if (done) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks])

  const scanning = tasks.some(
    (t) => t.type === 'stopwords_scan' && ['QUEUED', 'WAITING', 'RUNNING'].includes(t.status),
  )

  async function scan() {
    const q = phrase.trim()
    if (!q) return
    try {
      await api.stopScan(q)
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  async function accept(words: string[], kind: StopKind) {
    if (!words.length) return
    try {
      const r = await api.stopAdd(words.map((word) => ({ word, kind })))
      setSt((s) => (s ? { ...s, saved: r.saved } : s))
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  async function drop(words: string[]) {
    if (!words.length) return
    try {
      const r = await api.stopRemove(words)
      setSt((s) => (s ? { ...s, saved: r.saved } : s))
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  if (!st) return <div className="mut">загружаем список…</div>

  const sug = st.suggestion

  return (
    <>
      {err && (
        <div className="cerr" data-testid="stop-error">
          {err}
          <button className="x" onClick={() => setErr('')} title="скрыть">
            ✕
          </button>
        </div>
      )}

      <div className="hint">
        Слова из этого списка <b>не покупаются</b>: узел с таким словом краул пропускает, и его
        уточнения тоже. Модель только <b>предлагает</b> — что попадёт в список, решаете вы. Слово,
        которое вы не приняли, она предложит снова: «отклонённого» система не помнит.
      </div>

      <div className="bar-row">
        <input
          value={phrase}
          data-testid="stop-input"
          onChange={(e) => setPhrase(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void scan()
          }}
          placeholder="узел дерева — например «телеграм»"
        />
        <button className="go" data-testid="stop-scan" disabled={scanning} onClick={() => void scan()}>
          {scanning ? 'разбираем…' : 'Анализ стоп-слов'}
        </button>
        {sug && (
          <span className="mut" data-testid="stop-scanned">
            последний разбор: «{sug.root}» — слов {sug.words_seen}
            {sug.words_total && sug.words_total > (sug.words_seen ?? 0)
              ? ` из ${sug.words_total}`
              : ''}
          </span>
        )}
      </div>

      {KINDS.map((kind) => (
        <Block
          key={kind}
          kind={kind}
          saved={st.saved.filter((w) => w.kind === kind)}
          offered={(sug?.[kind] ?? []).filter(
            (o) => !st.saved.some((w) => w.word === o.word),
          )}
          onAccept={(ws) => void accept(ws, kind)}
          onDrop={(ws) => void drop(ws)}
        />
      ))}
    </>
  )
}

function Block({
  kind,
  saved,
  offered,
  onAccept,
  onDrop,
}: {
  kind: StopKind
  saved: StopWord[]
  offered: { word: string; why: string }[]
  onAccept: (words: string[]) => void
  onDrop: (words: string[]) => void
}) {
  const [left, setLeft] = useState<string[]>([])
  const [right, setRight] = useState<string[]>([])
  const pick = (e: React.ChangeEvent<HTMLSelectElement>) =>
    [...e.target.selectedOptions].map((o) => o.value)

  return (
    <section className="stop-block" data-testid={'stop-block-' + kind}>
      <h3>
        {TITLE[kind]} <span className="mut">— {HINT[kind]}</span>
      </h3>
      <div className="stop-cols">
        <div className="stop-col">
          <div className="stop-cap">
            предложено моделью <b data-testid={'stop-offered-count-' + kind}>{offered.length}</b>
          </div>
          <select
            multiple
            size={10}
            data-testid={'stop-offered-' + kind}
            value={left}
            onChange={(e) => setLeft(pick(e))}
          >
            {offered.map((o) => (
              <option key={o.word} value={o.word} title={o.why}>
                {o.word}
              </option>
            ))}
          </select>
        </div>

        <div className="stop-btns">
          <button
            className="act"
            data-testid={'stop-add-all-' + kind}
            disabled={!offered.length}
            onClick={() => onAccept(offered.map((o) => o.word))}
            title="перенести все предложенные в список исключений"
          >
            ≫
          </button>
          <button
            className="act"
            data-testid={'stop-add-' + kind}
            disabled={!left.length}
            onClick={() => {
              onAccept(left)
              setLeft([])
            }}
            title="перенести выбранные"
          >
            ›
          </button>
          <button
            className="act"
            data-testid={'stop-del-' + kind}
            disabled={!right.length}
            onClick={() => {
              onDrop(right)
              setRight([])
            }}
            title="убрать выбранные из исключений"
          >
            ‹
          </button>
          <button
            className="act"
            data-testid={'stop-del-all-' + kind}
            disabled={!saved.length}
            onClick={() => onDrop(saved.map((w) => w.word))}
            title="убрать все из исключений"
          >
            ≪
          </button>
        </div>

        <div className="stop-col">
          <div className="stop-cap">
            в списке исключений <b data-testid={'stop-saved-count-' + kind}>{saved.length}</b>
          </div>
          <select
            multiple
            size={10}
            data-testid={'stop-saved-' + kind}
            value={right}
            onChange={(e) => setRight(pick(e))}
          >
            {saved.map((w) => (
              <option key={w.word} value={w.word}>
                {w.word}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  )
}
