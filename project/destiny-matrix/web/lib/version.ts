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

export function deployLabel(iso: string): string {
  const at = iso ? new Date(iso) : null;
  return at && !Number.isNaN(at.getTime()) ? `${at.toLocaleString("sv-SE", { timeZone: "Europe/Moscow" })} МСК` : "—";
}

export function versionText(info: BuildInfo, deployedAt: string): string {
  return [
    `commit: ${info.commit}`,
    `branch: ${info.branch}`,
    `built:  ${info.builtAt}`,
    `deployed: ${deployedAt}`,
  ].join("\n") + "\n";
}
