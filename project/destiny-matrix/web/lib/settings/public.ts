import { SITE_HOSTS, isLang } from "../i18n/hosts";
import { SettingManager, parseBoolean, type SettingDefinitions } from "./manager";

interface PublicSettings extends Record<string, string | number | boolean> {
  siteUrl: string;
  yandexVerification: string;
  googleVerification: string;
  allFree: boolean;
  siteLang: string;
}

const DEFAULT_LANG = "ru";

// Адрес по умолчанию считается от языка развёртки. Прибитый `.ru` означал бы, что английская
// сборка без явного `NEXT_PUBLIC_SITE_URL` считает себя русским доменом, а `robots.ts` сверяет
// адрес с боевым и на несовпадении закрывает от обхода весь сайт.
const defaultSiteUrl = (lang: string | undefined): string =>
  SITE_HOSTS[isLang(lang ?? "") ? (lang as keyof typeof SITE_HOSTS) : DEFAULT_LANG];

const buildDefinitions = (lang?: string): SettingDefinitions<PublicSettings> => ({
  siteUrl: { env: "NEXT_PUBLIC_SITE_URL", fallback: defaultSiteUrl(lang) },
  yandexVerification: { env: "NEXT_PUBLIC_YANDEX_VERIFICATION", fallback: "" },
  googleVerification: { env: "NEXT_PUBLIC_GOOGLE_VERIFICATION", fallback: "" },
  // Витрина без оплаты. Переменная сборки, а не настройка на запрос: страницы матриц и
  // энциклопедии печатаются заранее, и решать это в рантайме им негде. Парная переменная
  // `ALL_FREE_WITHOUT_PAYMENT` у api задаётся тем же значением — их ставит развёртка.
  allFree: { env: "NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT", fallback: false, parse: parseBoolean },
  // Язык развёртки. Значения по умолчанию нет намеренно: язык выбирает раскладка, а тихий
  // русский на английском домене заметили бы уже посетители.
  siteLang: { env: "NEXT_PUBLIC_SITE_LANG", fallback: DEFAULT_LANG },
});

export interface PublicSettingInput {
  NEXT_PUBLIC_SITE_URL?: string;
  NEXT_PUBLIC_YANDEX_VERIFICATION?: string;
  NEXT_PUBLIC_GOOGLE_VERIFICATION?: string;
  NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT?: string;
  NEXT_PUBLIC_SITE_LANG?: string;
}

export function createPublicSettings(input: PublicSettingInput): SettingManager<PublicSettings> {
  return new SettingManager(
    buildDefinitions(input.NEXT_PUBLIC_SITE_LANG),
    input as Record<string, string | undefined>,
  );
}

// Имена перечислены явно: только такой доступ Next.js корректно вшивает в browser bundle.
// Метки релиза живут отдельно, в `settings/build`: они меняются каждым релизом, а этот модуль
// тянут клиентские компоненты. Здесь загружаются остальные публичные настройки. NEXT_PUBLIC_METRIKA_ID — осознанное
// исключение: счётчик читается напрямую в analytics.ts и в SettingManager не регистрируется.
export const publicSettings = createPublicSettings({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_YANDEX_VERIFICATION: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
  NEXT_PUBLIC_GOOGLE_VERIFICATION: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
  NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT: process.env.NEXT_PUBLIC_ALL_FREE_WITHOUT_PAYMENT,
  NEXT_PUBLIC_SITE_LANG: process.env.NEXT_PUBLIC_SITE_LANG,
});
