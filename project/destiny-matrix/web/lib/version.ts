/**
 * Версия сборки. Значения вшиваются на этапе `next build` из аргументов образа: коммит, время
 * сборки и ветка. Пусто — значит собрано вручную, вне релизного скрипта.
 */
export interface BuildInfo {
  commit: string;
  builtAt: string;
  branch: string;
}

export function buildInfo(): BuildInfo {
  return {
    commit: process.env.NEXT_PUBLIC_BUILD_COMMIT || "—",
    builtAt: process.env.NEXT_PUBLIC_BUILD_TIME || "—",
    branch: process.env.NEXT_PUBLIC_BUILD_BRANCH || "—",
  };
}

export function versionText(info: BuildInfo): string {
  return [
    `commit: ${info.commit}`,
    `branch: ${info.branch}`,
    `built:  ${info.builtAt}`,
  ].join("\n") + "\n";
}
