"use client";

import { useAdminLocale, useAdminMessage } from "./useAdminLocale";

// Что происходит сейчас: машина, люди на сайте, печать, платежи, ошибки. Живёт рядом с облачным
// мониторингом намеренно — когда до консоли облака не добраться, это единственное место, где
// видно состояние.
import { useEffect, useState } from "react";

import { ApiError, type ErrorRow, type Pulse } from "@/lib/api";
import { level, troubles, worst } from "@/lib/pulse";

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

export default function AdminPulse() {
  const { L, t, api, time, counted } = useAdminLocale();
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [failed, setFailed] = useAdminMessage();
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      void api.admin
        .pulse()
        .then((p) => {
          if (!alive) return;
          setFailed(null);
          setPulse(p);
        })
        .catch((err) => alive && setFailed(err instanceof ApiError ? err : "нет связи"));
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
  }, [api]);

  if (failed && !pulse) return <div className="panel"><h3>{t("Состояние")}</h3><p className="dim">{failed}</p></div>;
  if (!pulse) return <div className="panel"><h3>{t("Состояние")}</h3><p className="dim">{t("Смотрим…")}</p></div>;

  const bad = troubles(pulse, L);

  return (
    <div className="panel" data-testid="admin-pulse">
      <h3>
        {t("Состояние ")}<span className={`pdot lv-${worst(pulse)}`} aria-hidden="true" />
        <span className="small dim"> {t(" обновлено ")}{time(pulse.at)}</span>
      </h3>

      {/* опрос идёт каждые 10 с; когда он перестаёт отвечать, панель раньше молча показывала
          старые числа — по ней нельзя было понять, что сервер уже не отвечает */}
      {failed ? (
        <p className="err" role="status" data-testid="pulse-stale">
          {t("Сервер не отвечает (")}{failed}{t("): числа ниже — с последнего удачного опроса в ")}{time(pulse.at)}.
        </p>
      ) : null}

      {bad.length ? (
        <ul className="ptrouble" data-testid="pulse-troubles">
          {bad.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="small dim" data-testid="pulse-calm">{t("Всё в пределах порогов.")}</p>
      )}

      <div className="pgrid">
        {/* Все четыре плитки говорят об одном: сколько занято. Раньше у дисков процент был про
            занятое, а подпись — про свободное, и цифры читались как «остаток». */}
        <Bar label={t("Память")} percent={pulse.memory.percent}
             note={t("занято {0} из {1} МБ", pulse.memory.used_mb, pulse.memory.total_mb)} />
        <Bar label={t("Подкачка")} percent={pulse.memory.swap_percent}
             note={pulse.memory.swap_total_mb
               ? t("занято {0} из {1} МБ", pulse.memory.swap_used_mb, pulse.memory.swap_total_mb)
               : t("файла подкачки нет")} />
        <Bar label={t("Процессор")} percent={pulse.cpu.percent}
             note={t("в среднем за {0} с · load {1} на {2} ядра", Math.round(pulse.cpu.window_seconds), pulse.cpu.load1, pulse.cpu.cores)} />
        <Bar label={t("Диск")} percent={pulse.disk.percent}
             note={t("занято {0} из {1} ГБ · свободно {2} ГБ", pulse.disk.used_gb, pulse.disk.total_gb, pulse.disk.free_gb)} />
        <Bar label={t("Том с базой")} percent={pulse.data_disk.percent}
             note={t("занято {0} из {1} ГБ · {2}", pulse.data_disk.used_gb, pulse.data_disk.total_gb, pulse.data_disk.path)} />
      </div>

      {pulse.contours.length ? (
        <div className="pcontours" data-testid="pulse-contours">
          {pulse.contours.map((group) => (
            <div className="pcontour" key={t(group.title)}>
              <div className="pcap">
                <span>{t(group.title)}</span>
                <b>{group.percent}% · {group.memory_mb} {t(" МБ")}</b>
              </div>
              <ul className="small dim">
                {group.items.map((row) => (
                  <li key={row.name}>
                    {row.name.replace(/^arcana-|-1$/g, "")} — {row.percent}% · {row.memory_mb} {t(" МБ")}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      <div className="pnums">
        <span data-testid="pulse-online">
          {counted(pulse.online.people, "человек", "человека", "человек")} ·{" "}
          {counted(pulse.online.tabs, "вкладка", "вкладки", "вкладок")} {t(" сейчас")}</span>
        <span><b>{pulse.online.robots}</b> {t(" роботов")}</span>
        <span><b>{pulse.print.active}</b> {t(" печатается, ")}{pulse.print.waiting} {t(" в очереди")}</span>
        <span><b>{pulse.payments.stuck}</b> {t(" платежей застряло")}</span>
        <span><b>{pulse.errors.hour}</b> {t(" ошибок за час")}</span>
        <span className="dim">{t("сборка ")}{pulse.version}</span>
      </div>

      {pulse.online.pages.length ? (
        <p className="small dim">
          {t("Смотрят:")}{" "}
          {pulse.online.pages
            .map(
              (p) =>
                `${p.path} (${counted(p.people, "человек", "человека", "человек")} · ` +
                `${counted(p.tabs, "вкладка", "вкладки", "вкладок")})`,
            )
            .join(" · ")}
        </p>
      ) : null}

      {pulse.crawlers && pulse.crawlers.length ? (
        <p className="small dim" data-testid="pulse-crawlers">
          {t("Роботы за час: ")}{pulse.crawlers.map((c) => `${c.bot} — ${c.requests}`).join(" · ")}
        </p>
      ) : null}

      {errors.length ? (
        <table className="postab" data-testid="pulse-errors">
          <thead>
            <tr>
              <th>{t("Когда")}</th>
              <th>{t("Что")}</th>
              <th>{t("Код")}</th>
            </tr>
          </thead>
          <tbody>
            {errors.slice(0, 20).map((row) => (
              <tr key={row.id}>
                <td className="pn">{time(row.at)}</td>
                <td className="vl">
                  <span className="small">{row.method} {row.path}</span>
                  <br />
                  {/* трассировка раскрывалась кликом по строке — с клавиатуры её было не достать */}
                  {row.trace ? (
                    <button
                      type="button"
                      className="linkbtn"
                      aria-expanded={open === row.id}
                      onClick={() => setOpen(open === row.id ? null : row.id)}
                    >
                      {row.message}
                    </button>
                  ) : (
                    row.message
                  )}
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
