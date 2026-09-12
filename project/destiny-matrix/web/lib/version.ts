/**
 * Версия сборки. Значения вшиваются на этапе `next build` из аргументов образа: коммит, время
 * сборки и ветка. Пусто — значит собрано вручную, вне релизного скрипта.
 */
import { buildSettings } from "./settings/build";

export interface BuildInfo {
  commit: string;
  builtAt: string;
  branch: string;
}

export function buildInfo(): BuildInfo {
  return {
    commit: buildSettings.get("buildCommit"),
    builtAt: buildSettings.get("buildTime"),
    branch: buildSettings.get("buildBranch"),
  };
}

export function versionText(info: BuildInfo): string {
  return [
    `commit: ${info.commit}`,
    `branch: ${info.branch}`,
    `built:  ${info.builtAt}`,
  ].join("\n") + "\n";
}
