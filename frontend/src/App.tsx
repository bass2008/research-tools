import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import './App.css'
import * as api from './api'
import { fmt, fmtTime, fmtWhen, reportHref } from './api'
import type { ReportRow, TaskRow } from './api'
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
      else await api.needsBuild(p)
      setErr('')
    } catch (e) {
      setErr(errText(e))
    }
  }

  // Full load — только через подтверждение с оценкой объёма (design §8)
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
        if (cmd === 'full_load') void confirmVolume(p, cmd)
        else void post(p, cmd)
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
            {/* образцы настоящие, теми же классами — чтобы не сверять названия цветов глазами */}
            <div className="legend">
              <div>
                <span className="tg tg-local">+</span>
                <span>
                  дети взяты <b>из пула родителя</b> — приблизительно и бесплатно: сама фраза ещё
                  не запрашивалась. Нужны её настоящие уточнения — <b>Load</b>.
                </span>
              </div>
              <div>
                <span className="tg tg-real">+</span>
                <span>
                  фраза <b>запрашивалась</b>: показаны её собственные уточнения, они точнее и
                  глубже. Счётчик со значком <b>⚡</b> — сколько их в её пуле.
                </span>
              </div>
              <div>
                <span className="ct">7 ↓</span>
                <span>
                  столько детей раскроется, <span className="ct">∅</span> — запрашивали, а
                  уточнений нет: это лист.
                </span>
              </div>
            </div>
            Раскрытие <b>ничего не догружает</b> — только показывает уже известное. Догрузка —
            команды <b>Load</b> и <b>Full load</b>. По загруженной ветке (<b>FULLY_LOADED</b>)
            собирается <b>дерево потребностей</b> — работы, а не фразы; выводы и отчёты живут там.
          </div>

          {tree}
        </section>

        <section className="pane" style={{ display: tab === 'needs' ? '' : 'none' }}>
          <NeedsPane active={tab === 'needs'} tasks={st.tasks} />
        </section>

        <section className="pane" style={{ display: tab === 'log' ? '' : 'none' }}>
          <LogPane lines={st.logs} onClear={() => void api.clearLogs().catch((e) => setErr(errText(e)))} />
        </section>

        <section className="pane" style={{ display: tab === 'tasks' ? '' : 'none' }}>
          <TaskPane rows={st.tasks} />
        </section>

        <section className="pane" style={{ display: tab === 'reports' ? '' : 'none' }}>
          <ReportPane active={tab === 'reports'} tasks={st.tasks} />
        </section>
      </main>

      {ask && (
        <div className="modal">
          <div className="dlg" data-testid="confirm-dialog">
            <b>Full load: {ask.phrase}</b>
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
              <span
                className={'ts ts-' + t.status}
                title={
                  t.status === 'WAITING'
                    ? 'джоб отдан в очередь LLM, исполнитель его пока не взял'
                    : t.status === 'RUNNING'
                      ? 'работа реально идёт'
                      : ''
                }
              >
                {t.status}
              </span>
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

function ReportPane({ active, tasks }: { active: boolean; tasks: TaskRow[] }) {
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const done = tasks.filter((t) => t.type === 'needs_analyze' && t.status === 'DONE').length

  useEffect(() => {
    if (!active) return
    api
      .needsReports()
      .then((r) => setRows(r.reports))
      .catch(() => setRows([]))
  }, [active, done])

  if (rows === null) return <div className="mut">загружаем…</div>
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>работа</th>
          <th>ветка</th>
          <th className="num">частота</th>
          <th className="num">фраз</th>
          <th>вердикт</th>
          <th className="num">score</th>
          <th className="num">увер.</th>
          <th>дата</th>
          <th>отчёт</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={9} className="mut">
              отчётов пока нет — разбор запускается кнопкой Analyze на работе
            </td>
          </tr>
        )}
        {rows.map((r) => (
          <tr key={r.tree_id + '/' + r.work} data-testid="report-row">
            <td className="ph">
              <div>{r.work}</div>
              {r.gap_candidate && <span className="gap">ЩЕЛЬ</span>}
            </td>
            <td className="ph">{r.root ?? '—'}</td>
            <td className="num">{fmt(r.top_freq)}</td>
            <td className="num">{r.phrases ?? '—'}</td>
            <td>
              <span className={'vd vd-' + r.verdict}>{r.verdict ?? '—'}</span>
            </td>
            <td className="num">{r.verdict_score ?? '—'}</td>
            <td className="num">{r.confidence ?? '—'}</td>
            <td>{fmtWhen(r.created_at)}</td>
            <td>
              {r.report_link && (
                <a
                  className="act act-link"
                  data-testid="report-link"
                  href={reportHref(r.report_link)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Link
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
