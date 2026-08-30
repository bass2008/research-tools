const secretName = /(password|secret|token|credential|private_?key|access_?key)/i;

function parseNumber(raw) {
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`настройка должна быть числом, получено: ${raw}`);
  return value;
}

function parseBoolean(raw) {
  return raw !== "0" && raw.toLowerCase() !== "false";
}

function display(value, sensitive) {
  const raw = String(value ?? "");
  if (!sensitive) return raw;
  if (!raw) return "не задано";
  return raw.length > 6 ? `${raw.slice(0, 6)}…` : "••••••";
}

export class SettingManager {
  constructor(definitions, input) {
    this.values = new Map();
    this.rows = [];
    for (const [name, definition] of Object.entries(definitions)) {
      const raw = input[name];
      const value = raw === undefined ? definition.fallback :
        definition.parse ? definition.parse(raw) : raw;
      const sensitive = definition.sensitive === true || secretName.test(name);
      this.values.set(name, value);
      this.rows.push({
        component: "browser",
        name,
        value: display(value, sensitive),
        source: raw === undefined ? "default" : "environment",
        sensitive,
        configured: String(value ?? "").length > 0,
      });
    }
  }

  get(name) {
    if (!this.values.has(name)) throw new Error(`Неизвестная browser-настройка: ${name}`);
    return this.values.get(name);
  }

  snapshot() {
    return this.rows.map((row) => ({ ...row }));
  }
}

const definitions = {
  NODE_ENV: { fallback: "production" },
  PORT: { fallback: 3001, parse: parseNumber },
  BROWSER_SECRET: { fallback: "", sensitive: true },
  CHROME_PATH: { fallback: "/usr/bin/chromium-browser" },
  MAX_JOBS: { fallback: 50, parse: parseNumber },
  MAX_RSS_MB: { fallback: 400, parse: parseNumber },
  PAGE_TIMEOUT_MS: { fallback: 150_000, parse: parseNumber },
  WAIT_ASSETS_MS: { fallback: 2_500, parse: parseNumber },
  WAIT_IDLE_MS: { fallback: 6_000, parse: parseNumber },
  DEVICE_SCALE: { fallback: 1, parse: parseNumber },
  SINGLE_PAGE: { fallback: true, parse: parseBoolean },
  PRINT_SLOTS: { fallback: 3, parse: parseNumber },
};

// Единственное место browser-сервиса, которое читает окружение при старте.
const startupEnvironment = Object.fromEntries(
  Object.keys(definitions).map((name) => [name, process.env[name]]),
);

export const browserSettings = new SettingManager(definitions, startupEnvironment);
