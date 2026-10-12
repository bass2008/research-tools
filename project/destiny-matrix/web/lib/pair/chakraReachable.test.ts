import { afterEach, expect, it, vi } from "vitest";
import { reachablePairChakraKeys } from "./chakraReachable";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it.each([
  ["America/Los_Angeles", "1900-01-11T01:00:00Z", "1900-01-10"],
  ["Europe/Moscow", "1900-01-10T22:00:00Z", "1900-01-11"],
  ["UTC", "1900-01-11T01:00:00Z", "1900-01-11"],
])("%s: перебор заканчивается местным сегодняшним днём", (timezone, now, today) => {
  vi.stubEnv("TZ", timezone);
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  expect(reachablePairChakraKeys()).toEqual(reachablePairChakraKeys(today));
});
