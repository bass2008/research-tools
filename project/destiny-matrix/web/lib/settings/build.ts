import { SettingManager, type SettingDefinitions } from "./manager";

interface BuildSettings extends Record<string, string> {
  buildCommit: string;
  buildTime: string;
  buildIso: string;
  buildBranch: string;
}

const definitions: SettingDefinitions<BuildSettings> = {
  buildCommit: { env: "NEXT_PUBLIC_BUILD_COMMIT", fallback: "—" },
  buildTime: { env: "NEXT_PUBLIC_BUILD_TIME", fallback: "—" },
  buildIso: { env: "NEXT_PUBLIC_BUILD_ISO", fallback: "" },
  buildBranch: { env: "NEXT_PUBLIC_BUILD_BRANCH", fallback: "—" },
};

// Отдельно от `settings/public` намеренно. Next вшивает весь объект настроек в тот чанк, который
// его импортирует, а `settings/public` тянут клиентские компоненты через `lib/site`. Пока метки
// релиза лежали там, номер коммита попадал в семь общих чанков; имя чанка — хеш содержимого, и
// оно стоит в разметке, поэтому каждый релиз менял разметку всех страниц и сбрасывал `ETag`
// (замер 10.09: 439 страниц из 442). Читают их только админка и `/version/current.txt`.
export const buildSettings = new SettingManager(definitions, {
  NEXT_PUBLIC_BUILD_COMMIT: process.env.NEXT_PUBLIC_BUILD_COMMIT,
  NEXT_PUBLIC_BUILD_TIME: process.env.NEXT_PUBLIC_BUILD_TIME,
  NEXT_PUBLIC_BUILD_ISO: process.env.NEXT_PUBLIC_BUILD_ISO,
  NEXT_PUBLIC_BUILD_BRANCH: process.env.NEXT_PUBLIC_BUILD_BRANCH,
});
