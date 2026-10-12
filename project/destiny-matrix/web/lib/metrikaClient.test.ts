import { afterEach, expect, it, vi } from "vitest";
import { linkMetrikaClient } from "./metrikaClient";

afterEach(() => vi.unstubAllGlobals());

it("saves the counter and exact string ClientID returned asynchronously", () => {
  let callback: (value: unknown) => void = () => {};
  const ym = vi.fn((_id, _action, cb) => { callback = cb; });
  const fetch = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("window", { ym }); vi.stubGlobal("fetch", fetch);
  linkMetrikaClient(111856670);
  expect(ym).toHaveBeenCalledWith(111856670, "getClientID", expect.any(Function));
  expect(fetch).not.toHaveBeenCalled();
  callback("1791351251663069918");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    counter_id: 111856670, client_id: "1791351251663069918",
  });
});

it("ignores a late callback after logout or account change", () => {
  let callback: (value: unknown) => void = () => {};
  const fetch = vi.fn();
  vi.stubGlobal("window", { ym: (_id: number, _action: string, cb: typeof callback) => { callback = cb; } });
  vi.stubGlobal("fetch", fetch);
  const stop = linkMetrikaClient(111856670);
  stop(); callback("1791351251663069918");
  expect(fetch).not.toHaveBeenCalled();
});

it("does not fabricate an ID when the counter is blocked or returns invalid data", () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("window", {});
  expect(() => linkMetrikaClient(111856670)).not.toThrow();
  vi.stubGlobal("window", { ym: (_id: number, _action: string, cb: (value: unknown) => void) => cb(undefined) });
  linkMetrikaClient(111856670);
  expect(fetch).not.toHaveBeenCalled();
});
