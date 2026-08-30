/**
 * Версия сборки. Значения вшиваются на этапе `next build` из аргументов образа: коммит, время
 * сборки и ветка. Пусто — значит собрано вручную, вне релизного скрипта.
 */
import { publicSettings } from "./settings/public";

export interface BuildInfo {
  commit: string;
  builtAt: string;
  branch: string;
}

export function buildInfo(): BuildInfo {
  return {
    commit: publicSettings.get("buildCommit"),
    builtAt: publicSettings.get("buildTime"),
    branch: publicSettings.get("buildBranch"),
  };
}

export function versionText(info: BuildInfo): string {
  return [
    `commit: ${info.commit}`,
    `branch: ${info.branch}`,
    `built:  ${info.builtAt}`,
  ].join("\n") + "\n";
}
