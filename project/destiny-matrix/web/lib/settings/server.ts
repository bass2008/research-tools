import { SettingManager, parseBoolean, parseNumber, type SettingDefinitions } from "./manager";

interface ServerSettings extends Record<string, string | number | boolean> {
  apiInternalUrl: string;
  apiOrigin: string;
  sessionCookieSecure: boolean;
  sessionCookieName: string;
  nodeEnv: string;
  assetPrefix: string;
  port: number;
  hostname: string;
  telemetryDisabled: boolean;
}

// Эта структура не импортируется клиентскими компонентами. next.config и server-only BFF
// используют один и тот же manager; отдельного чтения process.env в приложении больше нет.
const startupEnvironment = {
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  API_ORIGIN: process.env.API_ORIGIN,
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_ASSET_PREFIX: process.env.NEXT_ASSET_PREFIX,
  PORT: process.env.PORT,
  HOSTNAME: process.env.HOSTNAME,
  NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED,
};

const definitions: SettingDefinitions<ServerSettings> = {
  apiInternalUrl: { env: "API_INTERNAL_URL", fallback: "" },
  apiOrigin: { env: "API_ORIGIN", fallback: "" },
  // Имя куки — параметр развёртки. На боевых доменах оно общее и менять его нельзя: смена
  // разлогинивает всех. На общем стенде оба языка живут на `127.0.0.1` и различаются
  // только портом, а порт браузер в куках не учитывает — вход в один контур выбрасывал
  // из другого.
  sessionCookieName: { env: "SESSION_COOKIE_NAME", fallback: "destiny_session" },
  sessionCookieSecure: {
    env: "SESSION_COOKIE_SECURE",
    fallback: startupEnvironment.NODE_ENV === "production",
    parse: parseBoolean,
  },
  nodeEnv: { env: "NODE_ENV", fallback: "development" },
  assetPrefix: { env: "NEXT_ASSET_PREFIX", fallback: "" },
  port: { env: "PORT", fallback: 3000, parse: parseNumber },
  hostname: { env: "HOSTNAME", fallback: "0.0.0.0" },
  telemetryDisabled: { env: "NEXT_TELEMETRY_DISABLED", fallback: false, parse: parseBoolean },
};

export const serverSettings = new SettingManager(definitions, startupEnvironment);

export function apiUpstream(defaultUrl = "http://127.0.0.1:8010"): string {
  return serverSettings.get("apiInternalUrl") || serverSettings.get("apiOrigin") || defaultUrl;
}
