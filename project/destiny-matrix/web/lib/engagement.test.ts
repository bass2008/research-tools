import { describe, expect, it } from "vitest";

import { ENGAGEMENT_MARKS, trackEngagement } from "./engagement";

/** Часы и очередь таймеров под рукой: тест двигает время сам, ничего не ждёт. */
function stand(startHidden = false) {
  let clock = 1_000_000;
  let hidden = startHidden;
  let seq = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const sent: number[] = [];

  const ports = {
    now: () => clock,
    schedule: (run: () => void, ms: number) => {
      seq += 1;
      timers.set(seq, { at: clock + ms, run });
      return seq;
    },
    cancel: (handle: number) => void timers.delete(handle),
    hidden: () => hidden,
    send: (seconds: number) => void sent.push(seconds),
  };

  const tick = (seconds: number) => {
    const until = clock + seconds * 1000;
    for (;;) {
      const due = [...timers.entries()]
        .filter(([, t]) => t.at <= until)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      clock = due[1].at;
      due[1].run();
    }
    clock = until;
  };

  return { ports, sent, tick, pending: () => timers.size, hide: () => void (hidden = true), show: () => void (hidden = false) };
}

describe("отсечки присутствия", () => {
  it("держит согласованный с владельцем ряд отсечек", () => {
    expect([...ENGAGEMENT_MARKS]).toEqual([20, 40, 60, 80, 100, 120, 150, 180, 240, 300]);
  });

  it("шлёт событие на каждой отсечке и ни одной лишней", () => {
    const s = stand();
    trackEngagement(s.ports);
    s.tick(301);
    expect(s.sent).toEqual([...ENGAGEMENT_MARKS]);
  });

  it("не шлёт раньше срока", () => {
    const s = stand();
    trackEngagement(s.ports);
    s.tick(19);
    expect(s.sent).toEqual([]);
    s.tick(1);
    expect(s.sent).toEqual([20]);
  });

  it("на скрытой вкладке время не идёт", () => {
    const s = stand();
    const t = trackEngagement(s.ports);
    s.tick(10);
    s.hide();
    t.visibility();
    s.tick(3600);
    expect(s.sent).toEqual([]);
    expect(s.pending()).toBe(0);
  });

  it("после возврата досчитывает остаток, а не начинает заново", () => {
    const s = stand();
    const t = trackEngagement(s.ports);
    s.tick(19);
    s.hide();
    t.visibility();
    s.tick(3600);
    s.show();
    t.visibility();
    s.tick(1);
    expect(s.sent).toEqual([20]);
  });

  it("считает только видимое время: скрытая минута не приближает отсечку", () => {
    const s = stand();
    const t = trackEngagement(s.ports);
    s.tick(15);
    s.hide();
    t.visibility();
    s.tick(60);
    s.show();
    t.visibility();
    s.tick(4);
    expect(s.sent).toEqual([]);
    s.tick(1);
    expect(s.sent).toEqual([20]);
  });

  it("если вкладка открыта в фоне, отсчёт начинается с показа", () => {
    const s = stand(true);
    const t = trackEngagement(s.ports);
    s.tick(300);
    expect(s.sent).toEqual([]);
    s.show();
    t.visibility();
    s.tick(20);
    expect(s.sent).toEqual([20]);
  });

  it("повторные visibilitychange не сдваивают события и таймеры", () => {
    const s = stand();
    const t = trackEngagement(s.ports);
    for (let i = 0; i < 5; i += 1) t.visibility();
    expect(s.pending()).toBe(1);
    s.tick(20);
    expect(s.sent).toEqual([20]);
  });

  it("после ухода со страницы ничего не досылает", () => {
    const s = stand();
    const t = trackEngagement(s.ports);
    s.tick(20);
    t.stop();
    s.tick(3600);
    expect(s.sent).toEqual([20]);
    expect(s.pending()).toBe(0);
  });

  it("на последней отсечке таймеры кончаются, вкладка не молотит вечно", () => {
    const s = stand();
    trackEngagement(s.ports);
    s.tick(300);
    expect(s.pending()).toBe(0);
    s.tick(7200);
    expect(s.sent).toEqual([...ENGAGEMENT_MARKS]);
  });

  it("медленный поток событий не теряет отсечки: длинный шаг догоняет пропущенные", () => {
    const s = stand();
    trackEngagement(s.ports);
    s.tick(125);
    expect(s.sent).toEqual([20, 40, 60, 80, 100, 120]);
  });
});
