export type SettingValue = string | number | boolean;
export type SettingSource = "environment" | "default";

export interface SettingView {
  name: string;
  value: string;
  source: SettingSource;
  sensitive: boolean;
  configured: boolean;
}

interface SettingDefinition<T extends SettingValue> {
  env: string;
  fallback: T;
  parse?: (raw: string) => T;
  sensitive?: boolean;
}

export type SettingDefinitions<T extends Record<string, SettingValue>> = {
  [K in keyof T]: SettingDefinition<T[K]>;
};

function text(value: SettingValue): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function masked(value: SettingValue): string {
  const raw = text(value);
  if (!raw) return "не задано";
  return raw.length > 6 ? `${raw.slice(0, 6)}…` : "••••••";
}

/**
 * Startup-снимок конфигурации процесса. После создания приложение не читает окружение снова:
 * все значения, их источник и безопасное представление для админки находятся здесь в памяти.
 */
export class SettingManager<T extends Record<string, SettingValue>> {
  private readonly values: T;
  private readonly rows: SettingView[];

  constructor(definitions: SettingDefinitions<T>, input: Record<string, string | undefined>) {
    const values = {} as T;
    const rows: SettingView[] = [];

    for (const key of Object.keys(definitions) as Array<keyof T>) {
      const definition = definitions[key];
      const raw = input[definition.env];
      const value = raw === undefined
        ? definition.fallback
        : definition.parse
          ? definition.parse(raw)
          : (raw as T[typeof key]);
      values[key] = value;
      // Новая переменная с очевидным именем секрета безопасна по умолчанию, даже если автор
      // забыл явно поставить sensitive. Verification-коды публичны и печатаются в HTML.
      const sensitive = definition.sensitive === true ||
        /(password|secret|credential|private_?key|access_?key|(^|_)token$)/i.test(definition.env);
      rows.push({
        name: definition.env,
        value: sensitive ? masked(value) : text(value),
        source: raw === undefined ? "default" : "environment",
        sensitive,
        configured: text(value).length > 0,
      });
    }

    this.values = Object.freeze(values);
    this.rows = Object.freeze(rows.map((row) => Object.freeze(row))) as SettingView[];
  }

  get<K extends keyof T>(name: K): T[K] {
    if (!(name in this.values)) throw new Error(`Неизвестная настройка: ${String(name)}`);
    return this.values[name];
  }

  snapshot(): SettingView[] {
    return this.rows.map((row) => ({ ...row }));
  }
}

export const parseBoolean = (raw: string): boolean => ["1", "true", "yes", "on"].includes(raw.toLowerCase());

export const parseNumber = (raw: string): number => {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
};
