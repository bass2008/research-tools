"use client";

import { useAdminLocale, useAdminMessage } from "./useAdminLocale";

import { useEffect, useState } from "react";

import { ApiError, type ApplicationSetting, type ApplicationSettings } from "@/lib/api";

const sourceLabel: Record<ApplicationSetting["source"], string> = {
  environment: "окружение",
  default: "по умолчанию",
  generated: "сгенерировано",
};

function SettingGroup({ title, rows }: { title: string; rows: ApplicationSetting[] }) {
  const { t } = useAdminLocale();
  return (
    <section className="section-gap" aria-label={t("Настройки {0}", title)}>
      <h4>{title}</h4>
      <div className="tablewrap">
        <table className="admtable" data-testid={`admin-settings-${title.toLowerCase()}`}>
          <thead>
            <tr>
              <th>{t("Переменная")}</th>
              <th>{t("Эффективное значение")}</th>
              <th>{t("Источник")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.component}:${row.name}`}>
                <td><span className="badge sub">{row.component}</span> <code>{row.name}</code></td>
                <td>
                  <code>{row.value || t("не задано")}</code>
                  {row.sensitive ? <span className="badge sub">{t("секрет обрезан")}</span> : null}
                </td>
                <td>{t(sourceLabel[row.source])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function AdminSettings() {
  const { t, api } = useAdminLocale();
  const [settings, setSettings] = useState<ApplicationSettings | null>(null);
  const [error, setError] = useAdminMessage();
  // Простыня на полсотни строк открывается редко и только под конкретный вопрос, поэтому
  // запрос уходит вместе с раскрытием, а не при загрузке страницы.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void api.admin.settings()
      .then((answer) => { if (active) setSettings(answer); })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err : "Настройки не загрузились.");
      });
    return () => { active = false; };
  }, [open, api]);

  return (
    <div className="panel section-gap" data-testid="admin-settings">
      <h3>{t("Настройки приложения")}</h3>
      <div className="cap">
        {t("Startup-снимок из памяти процессов. Для изменения значения нужен перезапуск приложения.")}</div>
      <div style={{ margin: "8px 0" }}>
        <button type="button" className="btn sm ghost" data-testid="admin-settings-toggle"
                aria-expanded={open} onClick={() => setOpen((was) => !was)}>
          {open ? t("Скрыть") : t("Показать")}
        </button>
      </div>
      {!open ? null : (
        <>
      {error ? <p className="err" role="status">{error}</p> : null}
      {!settings && !error ? <p className="skeleton">{t("Загружаем…")}</p> : null}
      {settings ? (
        <>
          <SettingGroup title="Frontend" rows={settings.frontend.items} />
          {settings.backend.warnings?.map((warning) => (
            <p className="err" role="status" key={warning}>{warning}</p>
          ))}
          <SettingGroup title="Backend" rows={settings.backend.items} />
        </>
      ) : null}
        </>
      )}
    </div>
  );
}
