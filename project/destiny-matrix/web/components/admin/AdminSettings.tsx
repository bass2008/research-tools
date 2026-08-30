"use client";

import { useEffect, useState } from "react";

import { ApiError, api, type ApplicationSetting, type ApplicationSettings } from "@/lib/api";

const sourceLabel: Record<ApplicationSetting["source"], string> = {
  environment: "окружение",
  default: "по умолчанию",
  generated: "сгенерировано",
};

function SettingGroup({ title, rows }: { title: string; rows: ApplicationSetting[] }) {
  return (
    <section className="section-gap" aria-label={`Настройки ${title}`}>
      <h4>{title}</h4>
      <div className="tablewrap">
        <table className="admtable" data-testid={`admin-settings-${title.toLowerCase()}`}>
          <thead>
            <tr>
              <th>Переменная</th>
              <th>Эффективное значение</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.component}:${row.name}`}>
                <td><span className="badge sub">{row.component}</span> <code>{row.name}</code></td>
                <td>
                  <code>{row.value || "не задано"}</code>
                  {row.sensitive ? <span className="badge sub">секрет обрезан</span> : null}
                </td>
                <td>{sourceLabel[row.source]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<ApplicationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.admin.settings()
      .then((answer) => { if (active) setSettings(answer); })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : "Настройки не загрузились.");
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="panel section-gap" data-testid="admin-settings">
      <h3>Настройки приложения</h3>
      <div className="cap">
        Startup-снимок из памяти процессов. Для изменения значения нужен перезапуск приложения.
      </div>
      {error ? <p className="err" role="status">{error}</p> : null}
      {!settings && !error ? <p className="skeleton">Загружаем…</p> : null}
      {settings ? (
        <>
          <SettingGroup title="Frontend" rows={settings.frontend.items} />
          {settings.backend.warnings?.map((warning) => (
            <p className="err" role="status" key={warning}>{warning}</p>
          ))}
          <SettingGroup title="Backend" rows={settings.backend.items} />
        </>
      ) : null}
    </div>
  );
}
