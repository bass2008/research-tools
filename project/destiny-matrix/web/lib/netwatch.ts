// The single place where requests to our own API are observed. Every caller goes through
// window.fetch, so wrapping it covers request(), direct fetch() calls and future code alike.

export type FailureCause = "aborted" | "offline" | "network";

export interface ObservedFailure {
  method: string;
  path: string;
  cause: FailureCause | "status";
  status?: number;
  waitedMs: number;
}

type Listener = () => void;

const SKIP = new Set(["/api/pulse"]);
// A page being replaced has its requests aborted moments before pagehide; a failure is reported only if the page stays.
const LEAVE_GRACE_MS = 300;
const failureListeners = new Set<(failure: ObservedFailure) => void>();
const stateListeners = new Set<Listener>();
let leaving = false;
let retrying = 0;
let installed = false;

export function isLeaving(): boolean {
  return leaving;
}

export function failureCause(error: unknown): FailureCause {
  if (leaving || (error instanceof DOMException && error.name === "AbortError")) return "aborted";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  return "network";
}

export function onFailure(listener: (failure: ObservedFailure) => void): () => void {
  failureListeners.add(listener);
  return () => failureListeners.delete(listener);
}

function emitFailure(failure: ObservedFailure): void {
  for (const listener of failureListeners) listener(failure);
}

function observed(input: RequestInfo | URL): string | null {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith("/api/") || SKIP.has(url.pathname)) return null;
  return url.pathname + url.search;
}

export function installNetwatch(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  // Not beforeunload: a mailto: link fires it and the page stays.
  window.addEventListener("pagehide", () => { leaving = true; });
  // A page restored from the back-forward cache is alive again.
  window.addEventListener("pageshow", () => { leaving = false; });
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);

  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = observed(input);
    if (!path) return original(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const started = performance.now();
    try {
      const response = await original(input, init);
      if (response.status >= 500) {
        emitFailure({ method, path, cause: "status", status: response.status, waitedMs: performance.now() - started });
      }
      return response;
    } catch (error) {
      const failure: ObservedFailure = { method, path, cause: failureCause(error), waitedMs: performance.now() - started };
      if (failure.cause !== "aborted") setTimeout(() => leaving || emitFailure(failure), LEAVE_GRACE_MS);
      throw error;
    }
  };
}

const SERVER_SNAPSHOT = { retrying: false, online: true };
let snapshot = SERVER_SNAPSHOT;

function notify(): void {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  if (snapshot.retrying !== retrying > 0 || snapshot.online !== online) snapshot = { retrying: retrying > 0, online };
  for (const listener of stateListeners) listener();
}

export function subscribeNetwork(listener: Listener): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export function networkSnapshot(): { retrying: boolean; online: boolean } {
  return snapshot;
}

export function serverNetworkSnapshot(): { retrying: boolean; online: boolean } {
  return SERVER_SNAPSHOT;
}

export function beginRetry(): () => void {
  retrying += 1;
  notify();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    retrying -= 1;
    notify();
  };
}

/** Wait before the next attempt; when offline, resume as soon as the browser reports a connection. */
export function waitForRetry(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const browser = typeof window !== "undefined";
    const finish = () => {
      clearTimeout(timer);
      if (browser) window.removeEventListener("online", finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    if (browser && navigator.onLine === false) window.addEventListener("online", finish);
  });
}

/** Resolve true once the browser reports a connection, false if it does not within ms. */
export function waitForOnline(ms: number): Promise<boolean> {
  if (typeof window === "undefined" || navigator.onLine !== false) return Promise.resolve(navigator?.onLine !== false);
  return new Promise((resolve) => {
    const finish = (online: boolean) => {
      clearTimeout(timer);
      window.removeEventListener("online", back);
      resolve(online);
    };
    const back = () => finish(true);
    const timer = setTimeout(() => finish(false), ms);
    window.addEventListener("online", back);
  });
}
