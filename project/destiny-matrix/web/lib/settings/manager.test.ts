import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { SettingManager, parseBoolean, type SettingDefinitions } from "./manager";

interface TestSettings extends Record<string, string | number | boolean> {
  title: string;
  enabled: boolean;
  secret: string;
  shortSecret: string;
}

const definitions: SettingDefinitions<TestSettings> = {
  title: { env: "TITLE", fallback: "default title" },
  enabled: { env: "ENABLED", fallback: false, parse: parseBoolean },
  secret: { env: "SECRET", fallback: "", sensitive: true },
  shortSecret: { env: "SHORT_SECRET", fallback: "", sensitive: true },
};

describe("SettingManager", () => {
  it("загружает и типизирует окружение один раз", () => {
    const manager = new SettingManager(definitions, { TITLE: "startup", ENABLED: "true" });
    expect(manager.get("title")).toBe("startup");
    expect(manager.get("enabled")).toBe(true);
    expect(() => manager.get("missing" as keyof TestSettings)).toThrow("Неизвестная");
  });

  it("не отдаёт секрет целиком в снимке для админки", () => {
    const manager = new SettingManager(definitions, {
      SECRET: "abcdef-sensitive-tail",
      SHORT_SECRET: "123",
    });
    const rows = Object.fromEntries(manager.snapshot().map((row) => [row.name, row]));
    expect(rows.SECRET.value).toBe("abcdef…");
    expect(rows.SHORT_SECRET.value).toBe("••••••");
    expect(JSON.stringify(rows)).not.toContain("sensitive-tail");
    expect(rows.SECRET.source).toBe("environment");
    expect(rows.TITLE.source).toBe("default");
  });

  it("не допускает чтение process.env в обход startup-модулей", () => {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    const allowed = new Set([
      path.join(root, "lib/settings/public.ts"),
      path.join(root, "lib/settings/server.ts"),
    ]);
    const directExceptions = new Map([
      [path.join(root, "lib/analytics.ts"), new Set(["NEXT_PUBLIC_METRIKA_ID"])],
    ]);
    const violations: string[] = [];
    const visit = (target: string) => {
      if (statSync(target).isDirectory()) {
        for (const child of readdirSync(target)) visit(path.join(target, child));
        return;
      }
      if (!/\.(ts|tsx)$/.test(target) || target.includes(".test.")) return;
      if (allowed.has(target)) return;
      const source = readFileSync(target, "utf8");
      const names = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1]);
      const exceptions = directExceptions.get(target);
      const forbidden = names.filter((name) => !exceptions?.has(name));
      if (forbidden.length || (source.includes("process.env") && names.length === 0)) {
        violations.push(path.relative(root, target));
      }
    };
    for (const target of ["app", "components", "lib", "next.config.ts"]) {
      visit(path.join(root, target));
    }
    expect(violations).toEqual([]);
  });
});
