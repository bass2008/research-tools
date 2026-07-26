import { useContext, useState } from 'react'
import { fmt, reportHref } from './api'
import type { Kind, Node as TreeNodeObj, Status } from './api'
import { TreeCtx, emptyNode } from './store'
import type { Cmd } from './store'

interface Props {
  phrase: string
  local?: TreeNodeObj[] // локальные дети из пула родителя (серый +)
  parentBusy?: boolean // занят предок -> кнопки этого узла тоже disabled
  isRoot?: boolean
}

type Btn = Cmd | 'fix_kind' | 'search_view'

// Кнопки по статусу — таблица design §2. Рендерятся ТОЛЬКО перечисленные.
// Link — вне таблицы: показывается при наличии отчёта, при ЛЮБОМ статусе.
const BTNS: Record<Status, Btn[]> = {
  NEW: ['load', 'full_load', 'drill'],
  LOADED: ['full_load', 'drill'],
  FULLY_LOADED: ['classify', 'drill'],
  TRANSACTIONAL: ['search', 'drill', 'fix_kind'],
  SEARCHED: ['score', 'drill'],
  SCORED: ['analyze', 'drill', 'search_view'],
  CATEGORY: ['fix_kind'],
  INFORMATIONAL: ['fix_kind'],
  NAVIGATIONAL: ['fix_kind'],
  LOW_SCORED: ['search_view'],
  ANALYZED: [],
}

const LABEL: Record<Btn, string> = {
  load: 'Load',
  full_load: 'Full load',
  drill: 'Drill',
  classify: 'Classify',
  search: 'Search',
  score: 'Score',
  analyze: 'Analyze',
  fix_kind: 'Fix kind',
  search_view: 'Search view',
}

const TID: Record<Btn, string> = {
  load: 'btn-load',
  full_load: 'btn-full-load',
  drill: 'btn-drill',
  classify: 'btn-classify',
  search: 'btn-search',
  score: 'btn-score',
  analyze: 'btn-analyze',
  fix_kind: 'btn-fix-kind',
  search_view: 'btn-search-view',
}

const HINT: Record<Btn, string> = {
  load: 'загрузить пул фразы — один уровень вниз',
  full_load: 'краул поддерева до конца (FLOOR=50)',
  drill: 'довести узел и поддерево до терминалов',
  classify: 'разметить поддерево по интенту (LLM)',
  search: 'выдача Яндекс+Google, топ-10',
  score: 'оценка по выдаче (LLM)',
  analyze: 'разбор ниши и HTML-отчёт (LLM)',
  fix_kind: 'ручной оверрайд интента (меняет и статус)',
  search_view: 'просмотр выдачи по фразе',
}

const KINDS: Kind[] = ['transactional', 'category', 'informational', 'navigational']

// Два типа раскрытия (сохраняем двухцветность):
//   СИНИЙ +  — реальные уточнения (свой пул, ⚡): точнее и глубже, приходят по WS.
//   СЕРЫЙ +  — локальные из пула top-2000 родителя (приблизительно, бесплатно, сразу).
// Раскрытие НЕ грузит данные (CQRS): догрузка — только команды Load / Full load / Drill.
export function TreeNode({ phrase, local, parentBusy, isRoot }: Props) {
  const t = useContext(TreeCtx)
  const [open, setOpen] = useState(!!isRoot)
  const [visible, setVisible] = useState(120) // пагинация детей вширь
  const [pick, setPick] = useState(false) // открыт выбор kind
  const [serp, setSerp] = useState(false) // открыт Search view

  const n = t.nodes[phrase] ?? emptyNode(phrase)
  const real = t.kids[phrase] // реальные дети (пришли событием children/snapshot)
  const localKids = local ?? []
  const hasOwnKids = !!n.cached && n.childCount > 0 // свой пул запрошен И в нём есть уточнения
  // Цвет = состояние САМОГО узла (запрошен ли его пул), иначе он противоречил бы статусу:
  // узел с queried=1 и нулём своих уточнений — полностью загружен, но детей даёт пул родителя.
  const isReal = !!real || !!n.cached
  const kids = real ?? localKids
  const expandable = real ? real.length > 0 : localKids.length > 0 || hasOwnKids
  const busy = !!parentBusy || !!n.task_id

  function onToggle() {
    if (real) {
      setOpen((o) => !o)
      return
    }
    if (hasOwnKids) {
      t.expand(phrase) // свой пул есть — просим его проекцию (реальные уточнения)
      setOpen(true)
      return
    }
    if (localKids.length) setOpen((o) => !o) // серый: локальные из пула родителя
  }

  function onBtn(b: Btn) {
    if (b === 'fix_kind') {
      setPick((v) => !v)
      return
    }
    if (b === 'search_view') {
      setSerp((v) => !v)
      return
    }
    t.run(phrase, b)
  }

  let badge = ''
  if (real) badge = real.length === 0 ? '∅' : `${real.length} ↓`
  else if (hasOwnKids) badge = `${n.childCount} ⚡ ↓`
  else if (localKids.length) badge = `${localKids.length} ↓`

  return (
    <div className={'node' + (busy ? ' busy' : '')} data-testid={'node-' + phrase}>
      <div className="row">
        {expandable ? (
          <button
            className={'tg ' + (isReal ? 'tg-real' : 'tg-local')}
            data-testid="node-toggle"
            title={
              hasOwnKids
                ? 'свой пул запрошен: реальные уточнения (⚡)'
                : n.cached
                  ? 'свой пул запрошен, своих уточнений нет — показаны локальные из пула родителя'
                  : 'локальные из пула родителя (приблизительно); свой пул не запрашивался'
            }
            onClick={onToggle}
          >
            {open ? '−' : '+'}
          </button>
        ) : (
          <span className="tg-spacer" />
        )}
        <span className="ph">{phrase}</span>
        <span className={'st st-' + n.status} data-testid="node-status" title={'kind: ' + (n.kind ?? '—')}>
          {n.status}
        </span>
        <span className="fr" data-testid="node-freq">
          {fmt(n.freq)}
        </span>
        {n.score != null && (
          <span className="sc" data-testid="node-score" title="score (0–100)">
            {n.score}
          </span>
        )}
        {n.verdict && (
          <span className={'vd vd-' + n.verdict} data-testid="node-verdict" title="вердикт анализа">
            {n.verdict}
            {n.verdict_score != null ? ' ' + n.verdict_score : ''}
          </span>
        )}
        {badge && (
          <span className={'ct' + (isReal ? '' : ' ct-local')} title="реальные (⚡) / локальные из пула">
            {badge}
          </span>
        )}
        {busy && <span className="spin" title="идёт операция" />}
        <span className="acts">
          {(BTNS[n.status] ?? []).map((b) => (
            <button
              key={b}
              className={'act act-' + b}
              data-testid={TID[b]}
              title={HINT[b]}
              disabled={busy}
              onClick={() => onBtn(b)}
            >
              {LABEL[b]}
            </button>
          ))}
          {n.report_link && (
            <a
              className="act act-link"
              data-testid="btn-link"
              href={reportHref(n.report_link)}
              target="_blank"
              rel="noreferrer"
              title="открыть готовый отчёт в новой вкладке"
            >
              Link
            </a>
          )}
        </span>
      </div>
      {pick && (
        <div className="kindpick">
          <span className="mut">kind → </span>
          {KINDS.filter((k) => k !== n.kind).map((k) => (
            <button
              key={k}
              className="act"
              data-testid={'btn-kind-' + k}
              disabled={busy}
              onClick={() => {
                setPick(false)
                t.setKind(phrase, k)
              }}
            >
              {k}
            </button>
          ))}
        </div>
      )}
      {serp && (
        // сохранённая выдача (serp) живёт на сервере и попадает в отчёт; здесь — что известно
        // узлу плюс быстрый переход к живой выдаче по фразе
        <div className="serp" data-testid="node-serp">
          <span className="mut">
            score: {n.score ?? '—'} · competition — в отчёте · verdict: {n.verdict ?? '—'}
          </span>
          <a href={'https://yandex.ru/search/?text=' + encodeURIComponent(phrase)} target="_blank" rel="noreferrer">
            Яндекс ↗
          </a>
          <a href={'https://www.google.com/search?q=' + encodeURIComponent(phrase)} target="_blank" rel="noreferrer">
            Google ↗
          </a>
        </div>
      )}
      {n.error && (
        <div className="nerr" data-testid="node-error">
          {n.error}
        </div>
      )}
      {expandable && (
        <div className="kids" style={{ display: open ? '' : 'none' }}>
          {kids.slice(0, visible).map((c, i) => (
            <TreeNode
              key={c.phrase + '#' + i}
              phrase={c.phrase}
              local={c.children}
              parentBusy={busy}
            />
          ))}
          {kids.length > visible && (
            <button className="more" onClick={() => setVisible((v) => v + 200)}>
              показать ещё {kids.length - visible} →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
