import { useEffect, useState } from 'react'
import * as api from './api'
import { fmt, fmtWhen } from './api'
import type { NeedsPhrase, NeedsRow, NeedsTree, NeedsWork } from './api'

// Второй слой — толкование: работы и сегменты, а не фразы. Дерево здесь только смотрят:
// оно собрано вне приложения и лежит файлом в папке, поэтому ни команд, ни статусов тут нет.

const WHY: Record<string, string> = {
  brand: 'бренд — ищут вход в конкретный продукт',
  catalog: 'каталог — «покажи список»',
  consumption: 'потребление — хотят готовое, а не сделать',
  broken: 'сломанный запрос — опечатка или обрывок',
  condition: 'условие — работы не называет',
  unclear: 'результат из фразы не ясен',
  other: 'прочее',
}

function errText(e: unknown): string {
  if (e instanceof api.ApiError) return `${e.status} · ${e.message}${e.detail ? ' — ' + e.detail : ''}`
  return e instanceof Error ? e.message : String(e)
}

export function NeedsPane({ active }: { active: boolean }) {
  const [rows, setRows] = useState<NeedsRow[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [tree, setTree] = useState<NeedsTree | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!active || rows) return
    api
      .needsTrees()
      .then((r) => setRows(r.trees))
      .catch((e) => setErr(errText(e)))
  }, [active, rows])

  useEffect(() => {
    if (!open) return
    setTree(null)
    api
      .needsTree(open)
      .then(setTree)
      .catch((e) => setErr(errText(e)))
  }, [open])

  if (err) {
    return (
      <div className="cerr" data-testid="needs-error">
        {err}
        <button
          className="x"
          onClick={() => {
            setErr('')
            setRows(null)
          }}
          title="повторить"
        >
          ↻
        </button>
      </div>
    )
  }

  if (open) {
    return (
      <>
        <div className="bar-row">
          <button className="act" data-testid="needs-back" onClick={() => setOpen(null)}>
            ← Назад к списку
          </button>
          {/* по какому узлу дерева запросов собрано — иначе по одному id не понять */}
          <span className="ph" data-testid="needs-branch">
            {tree?.root ?? '…'}
          </span>
          <span className="mut">{open}</span>
        </div>
        {tree ? <TreeView tree={tree} /> : <div className="mut">загружаем дерево…</div>}
      </>
    )
  }

  return <TreeTable rows={rows} onOpen={setOpen} />
}

function TreeTable({ rows, onOpen }: { rows: NeedsRow[] | null; onOpen: (id: string) => void }) {
  if (rows === null) return <div className="mut">загружаем список…</div>
  return (
    <>
      <div className="hint">
        Второй слой — <b>толкование</b>: работы, которые люди хотят сделать, собранные из фраз
        первого дерева. Складывается файлами в <code>logs/needs-lab</code>, приложение их только
        показывает. Клик по строке открывает дерево.
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>узел дерева запросов</th>
            <th className="num">частота</th>
            <th className="num">работ</th>
            <th className="num">сегм.</th>
            <th className="num">фраз</th>
            <th className="num">исключ.</th>
            <th className="num">щели</th>
            <th className="num">занято</th>
            <th>собрано</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="mut">
                деревьев пока нет — положите json в logs/needs-lab
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.id}
              className={'clickable' + (r.error ? ' bad' : '')}
              data-testid="needs-row"
              onClick={() => onOpen(r.id)}
            >
              {/* название — сам узел; id сборки мелким под ним, иначе по нему ничего не понять */}
              <td>
                <div className="ph">{r.root ?? r.condition ?? '—'}</div>
                <div className="mut small">{r.id}</div>
              </td>
              <td className="num">{fmt(r.root_freq)}</td>
              <td className="num">{r.works}</td>
              <td className="num">{r.segments}</td>
              <td className="num">{r.phrases}</td>
              <td className="num">{r.excluded}</td>
              <td className="num">{r.gaps ? <span className="gap">{r.gaps}</span> : '—'}</td>
              <td className="num">{r.occupied || '—'}</td>
              <td>{r.error ? <span className="err">{r.error}</span> : fmtWhen(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function Phrases({ items }: { items: NeedsPhrase[] }) {
  if (!items.length) return null
  return (
    <div className="nphrases">
      {items.map((p) => (
        <div className="nphrase" data-testid="needs-phrase" key={p.phrase}>
          <span className="ph">{p.phrase}</span>
          <span className="fr">{fmt(p.freq)}</span>
        </div>
      ))}
    </div>
  )
}

function Work({ w }: { w: NeedsWork }) {
  const [open, setOpen] = useState(false)
  const segs = w.segments ?? []
  return (
    <div className="nwork" data-testid="needs-work">
      <div className="row">
        <button
          className="tg tg-real"
          data-testid="needs-toggle"
          title={open ? 'свернуть' : 'показать фразы и сегменты'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '−' : '+'}
        </button>
        <span className="ph">{w.name ?? '—'}</span>
        <span className="fr" title="наибольшая частота в работе">
          {fmt(w.top_freq)}
        </span>
        <span className="ct" title="фраз в работе">
          {w.phrase_count ?? w.phrases.length} фраз
        </span>
        {w.unclear && (
          <span
            className="occ"
            data-testid="needs-unclear"
            title="объект понятен, результат из фраз не ясен — спрос есть, отнести не к чему"
          >
            НЕ ЯСНО
          </span>
        )}
        {w.gap_candidate && (
          <span className="gap" data-testid="needs-gap" title={w.why ?? 'кандидат в щель'}>
            ЩЕЛЬ
          </span>
        )}
        {w.occupied_by && (
          <span className="occ" data-testid="needs-occupied" title="работа похоже занята">
            занято: {w.occupied_by}
          </span>
        )}
        {w.needs_serp && (
          <span className="serp" title={w.serp_question ?? 'нужна проверка выдачей'}>
            ?выдача
          </span>
        )}
      </div>
      {open && (
        <div className="nbody">
          {w.why && <div className="nwhy">{w.why}</div>}
          {w.serp_question && (
            <div className="nwhy">
              <b>к выдаче:</b> {w.serp_question}
            </div>
          )}
          <Phrases items={w.phrases} />
          {segs.map((s) => (
            <div className="nseg" data-testid="needs-segment" key={s.name ?? Math.random()}>
              <div className="row">
                <span className="ph">└ {s.name ?? '—'}</span>
                <span className="ct">{s.phrases.length} фраз</span>
                {s.gap_candidate && (
                  <span className="gap" title={s.why ?? 'кандидат в щель'}>
                    ЩЕЛЬ
                  </span>
                )}
              </div>
              {s.why && <div className="nwhy">{s.why}</div>}
              <Phrases items={s.phrases} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TreeView({ tree }: { tree: NeedsTree }) {
  const [showEx, setShowEx] = useState(false)
  const byWhy = new Map<string, typeof tree.excluded>()
  for (const e of tree.excluded) {
    const k = e.why ?? 'other'
    byWhy.set(k, [...(byWhy.get(k) ?? []), e])
  }
  return (
    <div className="ntree" data-testid="needs-tree">
      <div className="nhead">
        <div className="nroot">
          <span className="mut">собрано по узлу дерева запросов</span>
          <b className="ph" data-testid="needs-root">
            {tree.root ?? '— (вход не сохранён)'}
          </b>
          <span className="fr">{fmt(tree.root_freq)}</span>
        </div>
        <div className="ncond" data-testid="needs-condition">
          <span className="mut">условие ветки · не ниша</span>
          <b>{tree.condition ?? '—'}</b>
          <span className="mut">
            {tree.counts.works} работ · {tree.counts.segments} сегментов · {tree.counts.phrases} фраз
            · {tree.counts.excluded} исключено
          </span>
        </div>
      </div>
      {tree.works.map((w) => (
        <Work key={w.name ?? Math.random()} w={w} />
      ))}
      {tree.excluded.length > 0 && (
        <div className="nex">
          <button className="act" data-testid="needs-excluded-toggle" onClick={() => setShowEx((v) => !v)}>
            {showEx ? '−' : '+'} вне дерева: {tree.excluded.length} фраз
          </button>
          {showEx && (
            <div className="nbody" data-testid="needs-excluded">
              {[...byWhy.entries()].map(([why, list]) => (
                <div className="nseg" key={why}>
                  <div className="row">
                    <span className="ph">{WHY[why] ?? why}</span>
                    <span className="ct">{list.length} фраз</span>
                  </div>
                  <Phrases items={list} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
