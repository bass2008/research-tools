import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import * as api from './api'
import { fmt, fmtTime, fmtWhen, reportHref } from './api'
import type { Kind, ReportRow, TaskRow } from './api'
import { NeedsPane } from './NeedsPane'
import { TreeNode } from './TreeNode'
import { TreeCtx, applyEvent, initialState } from './store'
import type { Cmd, LogRow, TreeApi } from './store'

type Tab = 'main' | 'needs' | 'log' | 'tasks' | 'reports'

const TABS: [Tab, string, string][] = [
  ['main', 'Главная', 'tab-main'],
  ['needs', 'Дерево потребностей', 'tab-needs'],
  ['log', 'Лог', 'tab-log'],
  ['tasks', 'Task', 'tab-tasks'],
  ['reports', 'Отчёты', 'tab-reports'],
]

function errText(e: unknown): string {
  if (e instanceof api.ApiError) {
    return `${e.status} · ${e.message}` + (e.detail ? ' — ' + e.detail : '')
  }
  return e instanceof Error ? e.message : String(e)
}

const DEFAULT_ROOT = 'нейросеть'   // как в этапе 1-2: дерево видно сразу при открытии

export default function App() {
  const [st, dispatch] = useReducer(applyEvent, initialState)
  const [tab, setTab] = useState<Tab>('main')
  const [phrase, setPhrase] = useState(DEFAULT_ROOT)
  const [conn, setConn] = useState<api.ConnState>('connecting')
  const [err, setErr] = useState('')
  const [ask, setAsk] = useState<{ phrase: string; cmd: Cmd; text: string } | null>(null)
  const sock = useRef<api.Conn | null>(null)
  const rootRef = useRef<string | null>(null) // чтобы восстановить дерево после реконнекта

  useEffect(() => {
    const c = api.connect(dispatch, setConn, () => {
      c.send({ action: 'subscribe' })
      // дерево на экране сразу: корень по умолчанию раскрывается сам, как было в этапе 1-2.
      // Это чистое чтение (проекция уже загруженного) — CQRS не нарушает.
      c.send({ action: 'root', phrase: rootRef.current ?? DEFAULT_ROOT })
    })
    sock.current = c
    return () => c.close()
  }, [])

  async function post(p: string, cmd: Cmd) {
    try {
      if (cmd === 'load') await api.loadNode(p)
      else if (cmd === 'full_load') await api.fullLoad(p)
      else if (cmd === 'drill') await api.drill(p)
      else await api.nodeOp(p, cmd)
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  // Drill / Full load — только через подтверждение с оценкой объёма (design §8)
  async function confirmVolume(p: string, cmd: Cmd) {
    let text: string
    try {
      const e = await api.estimate(p)
      text = `Загрузит не менее ~${fmt(e.nodes)} узлов / ~${fmt(e.requests)} запросов, может оказаться больше.`
    } catch {
      text = 'Оценка объёма недоступна — узлов и запросов может оказаться много.'
    }
    setAsk({ phrase: p, cmd, text })
  }

  function loadRoot(p: string) {
    const q = p.trim()
    if (!q) return
    rootRef.current = q
    sock.current?.send({ action: 'root', phrase: q })
    setTab('main')
  }

  // Замыкания стабильны (только ref-ы и сеттеры), поэтому контекст пересобираем
  // лишь при смене данных дерева — поток логов не перерисовывает тысячи узлов.
  const treeApi = useMemo<TreeApi>(
    () => ({
      nodes: st.nodes,
      kids: st.kids,
      expand: (p) => sock.current?.send({ action: 'expand', phrase: p }),
      run: (p, cmd) => {
        if (cmd === 'drill' || cmd === 'full_load') void confirmVolume(p, cmd)
        else void post(p, cmd)
      },
      setKind: async (p: string, kind: Kind) => {
        try {
          const r = await api.fixKind(p, kind)
          dispatch({ type: 'node', data: r }) // синхронный ответ: kind+status сразу на месте
          setErr('')
        } catch (e) {
          setErr(errText(e))
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [st.nodes, st.kids],
  )

  const tree = useMemo(
    () =>
      st.root ? (
        <TreeNode key={st.root} phrase={st.root} isRoot />
      ) : st.missing !== null ? (
        // Узел не сочиняем: иначе на опечатке появляется фальшивый узел с платными кнопками
        <div className="empty" data-testid="tree-missing">
          Фразы «{st.missing}» в дереве нет — проверьте написание. Дерево строится только по
          фразам, которые уже в нём есть.
        </div>
      ) : (
        <div className="empty">
          Дерево пусто. Впишите фразу, которая уже есть в дереве, и нажмите Enter.
        </div>
      ),
    [st.root, st.missing],
  )

  const pr = st.progress

  return (
    <TreeCtx.Provider value={treeApi}>
      <header>
        <h1>Wordstat — дерево с до-загрузкой</h1>
        <nav className="tabs">
          {TABS.map(([id, label, tid]) => (
            <button
              key={id}
              className={'tab' + (tab === id ? ' on' : '')}
              data-testid={tid}
              onClick={() => setTab(id)}
            >
              {label}
              {id === 'tasks' && st.tasks.length ? ` (${st.tasks.length})` : ''}
              {id === 'reports' && st.reports.length ? ` (${st.reports.length})` : ''}
            </button>
          ))}
        </nav>
        <div className="tools">
          {/* поле корня — контрол экрана дерева запросов; на прочих вкладках оно ни при чём */}
          {tab === 'main' && (
            <input
              value={phrase}
              data-testid="root-input"
              onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') loadRoot(phrase)
              }}
              placeholder="корневой запрос — Enter, чтобы построить дерево…"
            />
          )}
          <span
            className={'llm ' + (st.llm.online ? 'on' : 'off')}
            data-testid="llm-status"
            title={
              st.llm.last_seen_at
                ? 'петля приходила: ' + fmtWhen(st.llm.last_seen_at)
                : 'петля ещё не приходила за задачами'
            }
          >
            LLM: {st.llm.online ? 'онлайн' : 'офлайн'}
          </span>
          <span className={'ws ws-' + conn} data-testid="ws-status" title="состояние WebSocket">
            {conn === 'open' ? 'WS ✓' : conn === 'connecting' ? 'WS …' : 'WS ✕'}
          </span>
        </div>
        {pr && (
          <div className="prog" data-testid="progress">
            {pr.stage}
            {pr.node ? ' · ' + pr.node : ''} — {pr.done}/{pr.total}
            <span className="bar">
              <i style={{ width: (pr.total ? Math.min(100, (pr.done / pr.total) * 100) : 0) + '%' }} />
            </span>
          </div>
        )}
        {err && (
          <div className="cerr" data-testid="cmd-error">
            {err}
            <button className="x" onClick={() => setErr('')} title="скрыть">
              ✕
            </button>
          </div>
        )}
      </header>

      <main>
        <section id="tree" style={{ display: tab === 'main' ? '' : 'none' }}>
          <div className="hint">
            <b>+</b> раскрывает уже загруженное и ничего не догружает: бирюзовый — локальные из пула
            родителя, синий <b>⚡</b> — реальные уточнения. Загрузка — только команды{' '}
            <b>Load</b> / <b>Full load</b> / <b>Drill</b>. Кнопки узла зависят от статуса; занятый
            узел и всё его поддерево заблокированы.
          </div>
          {tree}
        </section>

        <section className="pane" style={{ display: tab === 'needs' ? '' : 'none' }}>
          <NeedsPane active={tab === 'needs'} />
        </section>

        <section className="pane" style={{ display: tab === 'log' ? '' : 'none' }}>
          <LogPane lines={st.logs} onClear={() => void api.clearLogs().catch((e) => setErr(errText(e)))} />
        </section>

        <section className="pane" style={{ display: tab === 'tasks' ? '' : 'none' }}>
          <TaskPane rows={st.tasks} />
        </section>

        <section className="pane" style={{ display: tab === 'reports' ? '' : 'none' }}>
          <ReportPane rows={st.reports} />
        </section>
      </main>

      {ask && (
        <div className="modal">
          <div className="dlg" data-testid="confirm-dialog">
            <b>
              {ask.cmd === 'drill' ? 'Drill' : 'Full load'}: {ask.phrase}
            </b>
            <p>Вы уверены? {ask.text}</p>
            <div className="dlg-btns">
              <button
                className="go"
                data-testid="confirm-yes"
                onClick={() => {
                  const a = ask
                  setAsk(null)
                  void post(a.phrase, a.cmd)
                }}
              >
                Да
              </button>
              <button className="act" data-testid="confirm-no" onClick={() => setAsk(null)}>
                Нет
              </button>
            </div>
          </div>
        </div>
      )}
    </TreeCtx.Provider>
  )
}

function LogPane({ lines, onClear }: { lines: LogRow[]; onClear: () => void }) {
  const box = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const b = box.current
    if (b) b.scrollTop = b.scrollHeight
  }, [lines])
  return (
    <>
      <div className="bar-row">
        <button className="act act-danger" data-testid="log-clear" onClick={onClear}>
          Удалить всё
        </button>
        <span className="mut">строк: {lines.length}</span>
      </div>
      <div className="logbox" ref={box}>
        {lines.length === 0 && <div className="mut">лог пуст</div>}
        {lines.map((l) => (
          <div className={'logline lvl-' + String(l.level).toLowerCase()} data-testid="log-line" key={l.seq}>
            <span className="mut">{fmtTime(l.ts)}</span>
            {' · '}
            <span className="lvl">{l.level}</span>
            {' · '}
            <span className="stg">{l.stage ?? '—'}</span>
            {' · '}
            <span className="ph">{l.node ?? '—'}</span>
            {' · '}
            <span>{l.msg}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function TaskPane({ rows }: { rows: TaskRow[] }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>тип</th>
          <th>узел</th>
          <th>статус</th>
          <th>создана</th>
          <th>старт</th>
          <th>финиш</th>
          <th>ошибка</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="mut">
              задач пока нет
            </td>
          </tr>
        )}
        {rows.map((t) => (
          <tr key={t.id} data-testid="task-row">
            <td>{t.type}</td>
            <td className="ph">{t.node ?? '—'}</td>
            <td>
              <span className={'ts ts-' + t.status}>{t.status}</span>
            </td>
            <td>{fmtWhen(t.created_at)}</td>
            <td>{fmtWhen(t.started_at)}</td>
            <td>{fmtWhen(t.finished_at)}</td>
            <td className="err">{t.error ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ReportPane({ rows }: { rows: ReportRow[] }) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>фраза</th>
          <th>вердикт</th>
          <th>verdict_score</th>
          <th>дата</th>
          <th>отчёт</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className="mut">
              отчётов пока нет
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.id} data-testid="report-row">
            <td className="ph">{r.title || r.node}</td>
            <td>
              <span className={'vd vd-' + r.verdict}>{r.verdict ?? '—'}</span>
            </td>
            <td>{r.verdict_score ?? '—'}</td>
            <td>{fmtWhen(r.created_at)}</td>
            <td>
              <a
                className="act act-link"
                data-testid="report-link"
                href={reportHref(r.link)}
                target="_blank"
                rel="noreferrer"
              >
                Link
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
