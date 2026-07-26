import { useContext, useState } from 'react'
import { fmt } from './api'
import type { Node as TreeNodeObj, Status } from './api'
import { TreeCtx, emptyNode } from './store'
import type { Cmd } from './store'

interface Props {
  phrase: string
  local?: TreeNodeObj[] // локальные дети из пула родителя (серый +)
  parentBusy?: boolean // занят предок -> кнопки этого узла тоже disabled
  isRoot?: boolean
}

type Btn = Cmd

// Кнопки по статусу. Дерево запросов отвечает только за ЗАГРУЗКУ: выводы (интент, конкуренция,
// разбор ниши) живут во втором слое, где единица — работа, а не фраза. Поэтому здесь три
// статуса и три команды, а не одиннадцать.
const BTNS: Record<Status, Btn[]> = {
  NEW: ['load', 'full_load'],
  LOADED: ['full_load'],
  FULLY_LOADED: ['needs_build'],
}

const LABEL: Record<Btn, string> = {
  load: 'Load',
  full_load: 'Full load',
  needs_build: 'Собрать потребности',
}

const TID: Record<Btn, string> = {
  load: 'btn-load',
  full_load: 'btn-full-load',
  needs_build: 'btn-needs-build',
}

const HINT: Record<Btn, string> = {
  load: 'загрузить пул фразы — один уровень вниз',
  full_load: 'краул поддерева до конца (FLOOR=50)',
  needs_build: 'собрать по этой ветке дерево потребностей (LLM): работы, а не фразы',
}

// Два типа раскрытия (сохраняем двухцветность):
//   СИНИЙ +  — реальные уточнения (свой пул, ⚡): точнее и глубже, приходят по WS.
//   СЕРЫЙ +  — локальные из пула top-2000 родителя (приблизительно, бесплатно, сразу).
// Раскрытие НЕ грузит данные (CQRS): догрузка — только команды Load / Full load.
export function TreeNode({ phrase, local, parentBusy, isRoot }: Props) {
  const t = useContext(TreeCtx)
  const [open, setOpen] = useState(!!isRoot)
  const [visible, setVisible] = useState(120) // пагинация детей вширь

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
        <span className={'st st-' + n.status} data-testid="node-status" title="состояние загрузки">
          {n.status}
        </span>
        <span className="fr" data-testid="node-freq">
          {fmt(n.freq)}
        </span>
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
        </span>
      </div>
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
