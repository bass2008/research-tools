import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SettingManager } from "./settings.mjs";

test("browser SettingManager хранит startup-снимок и обрезает секрет", () => {
  const manager = new SettingManager({
    PORT: { fallback: 3001, parse: Number },
    BROWSER_SECRET: { fallback: "", sensitive: true },
  }, { PORT: "3100", BROWSER_SECRET: "abcdef-sensitive-tail" });

  assert.equal(manager.get("PORT"), 3100);
  const secret = manager.snapshot().find((row) => row.name === "BROWSER_SECRET");
  assert.equal(secret.value, "abcdef…");
  assert.equal(JSON.stringify(manager.snapshot()).includes("sensitive-tail"), false);
});

test("browser server читает значения только через manager", () => {
  assert.equal(readFileSync(new URL("./server.mjs", import.meta.url), "utf8").includes("process.env"), false);
});
