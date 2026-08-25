import { describe, expect, it } from "vitest";

import { level, troubles, worst } from "./pulse";
import type { Pulse } from "./api";

const calm: Pulse = {
  at: "2026-08-25T10:00:00Z",
  memory: { total_mb: 1967, used_mb: 900, percent: 45 },
  cpu: { load1: 0.2, load5: 0.2, load15: 0.2, cores: 2, percent: 10 },
  disk: { path: "/", total_gb: 19, free_gb: 11, used_gb: 8, percent: 44 },
  data_disk: { path: "/srv/api/var", total_gb: 19, free_gb: 11, used_gb: 8, percent: 44 },
  online: { people: 3, robots: 12, pages: [{ path: "/", people: 2 }] },
  print: { active: 0, waiting: 0, failures_hour: 0 },
  payments: { stuck: 0 },
  errors: { last10min: 0, hour: 0 },
  crawlers: null,
  version: "abc123",
};

describe("оценка состояния", () => {
  it.each([
    [10, "ok"],
    [69.9, "ok"],
    [70, "warn"],
    [84.9, "warn"],
    [85, "bad"],
    [99, "bad"],
  ])("%s%% → %s", (percent, expected) => {
    expect(level(percent as number)).toBe(expected);
  });

  it("на спокойной машине жалоб нет", () => {
    expect(troubles(calm)).toEqual([]);
    expect(worst(calm)).toBe("ok");
  });

  it("называет переполненный диск и говорит, какой именно", () => {
    const full = { ...calm, disk: { ...calm.disk, percent: 91 } };
    expect(troubles(full)).toEqual(["диск занят на 91%"]);
    expect(worst(full)).toBe("bad");
  });

  it("том с базой считается отдельно от корня", () => {
    const full = { ...calm, data_disk: { ...calm.data_disk, percent: 88 } };
    expect(troubles(full)).toEqual(["том с базой занят на 88%"]);
  });

  it("не жалуется на том с базой дважды, если это тот же диск", () => {
    const same = {
      ...calm,
      disk: { ...calm.disk, percent: 90 },
      data_disk: { ...calm.data_disk, path: "/", percent: 90 },
    };
    expect(troubles(same)).toEqual(["диск занят на 90%"]);
  });

  it("видит упавшую печать и застрявшие платежи при здоровой машине", () => {
    const bad = {
      ...calm,
      print: { active: 0, waiting: 0, failures_hour: 2 },
      payments: { stuck: 3 },
    };
    expect(troubles(bad)).toEqual(["печать падала 2 раз за час", "платежей застряло: 3"]);
    expect(worst(bad)).toBe("warn");
  });

  it("молчит про единичные ошибки и говорит про поток", () => {
    expect(troubles({ ...calm, errors: { last10min: 5, hour: 9 } })).toEqual([]);
    expect(troubles({ ...calm, errors: { last10min: 6, hour: 9 } })).toEqual([
      "ошибок за 10 минут: 6",
    ]);
  });
});
