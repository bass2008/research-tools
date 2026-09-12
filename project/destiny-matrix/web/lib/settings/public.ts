import { SettingManager, type SettingDefinitions } from "./manager";

interface PublicSettings extends Record<string, string | number | boolean> {
  siteUrl: string;
  yandexVerification: string;
  googleVerification: string;
}

const definitions: SettingDefinitions<PublicSettings> = {
  siteUrl: { env: "NEXT_PUBLIC_SITE_URL", fallback: "https://arcana-sense.ru" },
  yandexVerification: { env: "NEXT_PUBLIC_YANDEX_VERIFICATION", fallback: "" },
  googleVerification: { env: "NEXT_PUBLIC_GOOGLE_VERIFICATION", fallback: "" },
};

export interface PublicSettingInput {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_YANDEX_VERIFICATION?: string;
  NEXT_PUBLIC_GOOGLE_VERIFICATION?: string;
}

export function createPublicSettings(input: PublicSettingInput): SettingManager<PublicSettings> {
  return new SettingManager(definitions, input as Record<string, string | undefined>);
}

// Имена перечислены явно: только такой доступ Next.js корректно вшивает в browser bundle.
// Метки релиза живут отдельно, в `settings/build`: они меняются каждым релизом, а этот модуль
// тянут клиентские компоненты. Здесь загружаются остальные публичные настройки. NEXT_PUBLIC_METRIKA_ID — осознанное
// исключение: счётчик читается напрямую в analytics.ts и в SettingManager не регистрируется.
export const publicSettings = createPublicSettings({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_YANDEX_VERIFICATION: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
  NEXT_PUBLIC_GOOGLE_VERIFICATION: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
});
