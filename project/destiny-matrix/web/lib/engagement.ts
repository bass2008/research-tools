// Метрика считает длительность визита как расстояние между первым и последним событием, а своего
// периодического сигнала не шлёт. Одностраничный визит упирается в `notBounce` на 15-й секунде:
// человек читает три минуты, в отчёте — пятнадцать секунд. Отсечки ниже досылают служебные хиты,
// пока вкладка на экране.
export const ENGAGEMENT_MARKS = [20, 40, 60, 80, 100, 120, 150, 180, 240, 300] as const;

export interface EngagementPorts {
  now(): number;
  schedule(run: () => void, ms: number): number;
  cancel(handle: number): void;
  hidden(): boolean;
  send(seconds: number): void;
}

export interface EngagementTracker {
  visibility(): void;
  stop(): void;
}

export function trackEngagement(
  ports: EngagementPorts,
  marks: readonly number[] = ENGAGEMENT_MARKS,
): EngagementTracker {
  const plan = [...marks].sort((a, b) => a - b);
  let next = 0;
  let watched = 0;
  let since: number | null = ports.hidden() ? null : ports.now();
  let timer: number | null = null;

  const shown = () => watched + (since === null ? 0 : ports.now() - since);

  const arm = () => {
    if (timer !== null) {
      ports.cancel(timer);
      timer = null;
    }
    if (next >= plan.length || since === null) return;
    timer = ports.schedule(fire, Math.max(0, plan[next] * 1000 - shown()));
  };

  function fire() {
    timer = null;
    const mark = plan[next];
    next += 1;
    ports.send(mark);
    arm();
  }

  arm();

  return {
    visibility() {
      if (ports.hidden()) {
        if (since !== null) {
          watched += ports.now() - since;
          since = null;
        }
      } else if (since === null) {
        since = ports.now();
      }
      arm();
    },
    stop() {
      if (timer !== null) ports.cancel(timer);
      timer = null;
      next = plan.length;
    },
  };
}
