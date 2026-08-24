"use client";

// Что происходит сейчас: машина, люди на сайте, печать, платежи, ошибки. Живёт рядом с облачным
// мониторингом намеренно — когда до консоли облака не добраться, это единственное место, где
// видно состояние.
import { useEffect, useState } from "react";

import { ApiError, api, type ErrorRow, type Pulse } from "@/lib/api";
import { level, troubles, worst } from "@/lib/pulse";
import { counted } from "@/lib/plural";

const EVERY = 10_000;

function Bar({ label, percent, note }: { label: string; percent: number; note: string }) {
  return (
    <div className={`pcard lv-${level(percent)}`}>
      <div className="pcap">
        <span>{label}</span>
        <b>{percent}%</b>
      </div>
      <div className="pbar">
        <span style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <div className="small dim">{note}</div>
    </div>
  );
}

function time(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AdminPulse() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void api.admin
        .pulse()
        .then((p) => alive && setPulse(p))
        .catch((err) => alive && setFailed(err instanceof ApiError ? err.message : "нет связи"));
      void api.admin
        .errors()
        .then((e) => alive && setErrors(e.items))
        .catch(() => {
          /* журнал ошибок — дополнение, без него панель работает */
        });
    };
    load();
    const timer = setInterval(load, EVERY);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (failed && !pulse) return <div className="panel"><h3>Состояние</h3><p className="dim">{failed}</p></div>;
  if (!pulse) return <div className="panel"><h3>Состояние</h3><p className="dim">Смотрим…</p></div>;

  const bad = troubles(pulse);

  return (
    <div className="panel" data-testid="admin-pulse">
      <h3>
        Состояние <span className={`pdot lv-${worst(pulse)}`} aria-hidden="true" />
        <span className="small dim"> обновлено {time(pulse.at)}</span>
      </h3>

      {bad.length ? (
        <ul className="ptrouble" data-testid="pulse-troubles">
          {bad.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="small dim" data-testid="pulse-calm">Всё в пределах порогов.</p>
      )}

      <div className="pgrid">
        <Bar label="Память" percent={pulse.memory.percent}
             note={`${pulse.memory.used_mb} из ${pulse.memory.total_mb} МБ`} />
        <Bar label="Процессор" percent={pulse.cpu.percent}
             note={`load ${pulse.cpu.load1} на ${pulse.cpu.cores} ядра`} />
        <Bar label="Диск" percent={pulse.disk.percent}
             note={`свободно ${pulse.disk.free_gb} ГБ из ${pulse.disk.total_gb}`} />
        <Bar label="Том с базой" percent={pulse.data_disk.percent}
             note={`свободно ${pulse.data_disk.free_gb} ГБ · ${pulse.data_disk.path}`} />
      </div>

      <div className="pnums">
        <span data-testid="pulse-online">
          {counted(pulse.online.people, "человек", "человека", "человек")} сейчас
        </span>
        <span><b>{pulse.online.robots}</b> роботов</span>
        <span><b>{pulse.print.active}</b> печатается, {pulse.print.waiting} в очереди</span>
        <span><b>{pulse.payments.stuck}</b> платежей застряло</span>
        <span><b>{pulse.errors.hour}</b> ошибок за час</span>
        <span className="dim">сборка {pulse.version}</span>
      </div>

      {pulse.online.pages.length ? (
        <p className="small dim">
          Смотрят: {pulse.online.pages.map((p) => `${p.path} (${p.people})`).join(" · ")}
        </p>
      ) : null}

      {pulse.crawlers && pulse.crawlers.length ? (
        <p className="small dim" data-testid="pulse-crawlers">
          Роботы за час: {pulse.crawlers.map((c) => `${c.bot} — ${c.requests}`).join(" · ")}
        </p>
      ) : null}

      {errors.length ? (
        <table className="postab" data-testid="pulse-errors">
          <thead>
            <tr>
              <th>Когда</th>
              <th>Что</th>
              <th>Код</th>
            </tr>
          </thead>
          <tbody>
            {errors.slice(0, 20).map((row) => (
              <tr key={row.id} onClick={() => setOpen(open === row.id ? null : row.id)}>
                <td className="pn">{time(row.at)}</td>
                <td className="vl">
                  <span className="small">{row.method} {row.path}</span>
                  <br />
                  {row.message}
                  {open === row.id && row.trace ? <pre className="small">{row.trace}</pre> : null}
                </td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
