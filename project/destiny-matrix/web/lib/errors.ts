import type * as SentryModule from "@sentry/browser";
import type { ErrorEvent } from "@sentry/browser";

import { metrikaId } from "./analytics";
import { installNetwatch, onFailure, type ObservedFailure } from "./netwatch";

type Sentry = typeof SentryModule;
type Level = "error" | "warning" | "info";

interface Item {
  name: string;
  message: string;
  stack?: string;
  level: Level;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
  at: number;
}

// Events go to a third-party collector: no e-mail, birth date or query string may leave the browser.
const EMAIL = /[^\s@"'<>()]+@[^\s@"'<>()]+\.[\p{L}]{2,}/gu;
const DATE = /\b(?:\d{1,2}[.\-/]\d{1,2}[.\-/](?:19|20)\d{2}|(?:19|20)\d{2}-\d{1,2}-\d{1,2})\b/g;
// Only errors raised by our own bundles are ours; extensions and third-party scripts are not.
const OUR_CODE = /\/_next\/static\//;
const EXTENSIONS = /(?:chrome|moz|safari(?:-web)?)-extension:\/\//;
const STORE_KEY = "arcana.errors.pending";
const QUEUE_LIMIT = 30;
const REPEAT_MS = 60_000;

const pending: Item[] = [];
const lastSent = new Map<string, number>();
let sentry: Sentry | null = null;
let started = false;

export function scrubText(text: string): string {
  return text.replace(EMAIL, "[email]").replace(DATE, "[date]");
}

export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, "");
}

export function pathTemplate(path: string): string {
  return stripQuery(path).replace(/\/\d+(?=\/|$)/g, "/:n");
}

function scrubDeep(value: unknown): unknown {
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubDeep);
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) (value as Record<string, unknown>)[key] = scrubDeep(item);
  }
  return value;
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  delete event.breadcrumbs;
  if (event.request) {
    if (event.request.url) event.request.url = stripQuery(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    const headers = event.request.headers;
    if (headers?.Referer) headers.Referer = stripQuery(headers.Referer);
  }
  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) {
      if (frame.filename) frame.filename = stripQuery(frame.filename);
      if (frame.abs_path) frame.abs_path = stripQuery(frame.abs_path);
    }
  }
  return scrubDeep(event) as ErrorEvent;
}

/** The error was thrown by our bundle: its stack points at our chunks and not at an extension. */
export function isOurError(stack: string | undefined): boolean {
  return Boolean(stack && OUR_CODE.test(stack) && !EXTENSIONS.test(stack));
}

/** Same rule for an SDK event: code without a file (console, scripts injected by in-app browsers) is not ours. */
export function isOurEvent(event: ErrorEvent): boolean {
  const frames = (event.exception?.values ?? []).flatMap((value) => value.stacktrace?.frames ?? []);
  return isOurError(frames.map((frame) => frame.filename ?? "").join("\n"));
}

export function deviceTags(ua: string): Record<string, string> {
  const pick = (pattern: RegExp, name: string) => {
    const found = ua.match(pattern);
    return found ? `${name} ${found[1].replace(/_/g, ".")}` : null;
  };
  const browser = pick(/MiuiBrowser\/([\d.]+)/, "MiuiBrowser") ?? pick(/YaBrowser\/([\d.]+)/, "YaBrowser")
    ?? pick(/SamsungBrowser\/([\d.]+)/, "SamsungBrowser") ?? pick(/EdgA?\/([\d.]+)/, "Edge")
    ?? pick(/OPR\/([\d.]+)/, "Opera") ?? pick(/Firefox\/([\d.]+)/, "Firefox") ?? pick(/Chrome\/([\d.]+)/, "Chrome")
    ?? pick(/Version\/([\d.]+).*Safari/, "Safari") ?? "other";
  const os = pick(/Android ([\d.]+)/, "Android") ?? pick(/(?:iPhone|iPad|CPU) OS ([\d_]+)/, "iOS")
    ?? pick(/Windows NT ([\d.]+)/, "Windows") ?? pick(/Mac OS X ([\d_]+)/, "macOS") ?? (/Linux/.test(ua) ? "Linux" : "other");
  const tags: Record<string, string> = { browser, os };
  // Reduced Chrome UA hides the model behind "K".
  const model = ua.match(/Android [\d.]+; (?:[a-z]{2}-[a-z]{2}; )?([^;)]+?)(?: Build\/[^;)]*)?[;)]/)?.[1];
  if (model && model !== "K") tags.device = model;
  if (/; wv\)/.test(ua)) tags.webview = "yes";
  return tags;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readStored(): Item[] {
  try {
    const raw = storage()?.getItem(STORE_KEY);
    const items: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items as Item[] : [];
  } catch {
    return [];
  }
}

function writeStored(items: Item[]): void {
  try {
    const store = storage();
    if (!store) return;
    if (items.length) store.setItem(STORE_KEY, JSON.stringify(items.slice(-QUEUE_LIMIT)));
    else store.removeItem(STORE_KEY);
  } catch {
    /* full or blocked storage: the queue stays in memory */
  }
}

function deliver(s: Sentry, item: Item): void {
  const error = new Error(item.message);
  error.name = item.name;
  if (item.stack) error.stack = item.stack;
  s.captureException(error, { level: item.level, tags: item.tags, extra: item.extra, fingerprint: item.fingerprint });
}

export function queueItem(item: Omit<Item, "at">): void {
  if (typeof window === "undefined") return;
  const key = (item.fingerprint ?? [item.name, item.message]).join("|");
  const now = Date.now();
  if (now - (lastSent.get(key) ?? -Infinity) < REPEAT_MS) return;
  lastSent.set(key, now);
  const full: Item = {
    ...item,
    message: scrubText(item.message),
    stack: item.stack && scrubText(item.stack),
    extra: item.extra && (scrubDeep({ ...item.extra }) as Record<string, unknown>),
    at: now,
  };
  if (sentry) deliver(sentry, full);
  else if (pending.length < QUEUE_LIMIT) pending.push(full);
}

function captured(name: string, message: string, rest: Omit<Item, "name" | "message" | "stack" | "at">): void {
  queueItem({ name, message, stack: new Error().stack, ...rest });
}

const FAILURE_NAMES = { offline: "OfflineError", network: "NetworkError", status: "ServerError", format: "ResponseFormatError" } as const;

type Reported = Omit<ObservedFailure, "cause"> & { cause: Exclude<ObservedFailure["cause"], "aborted"> | "format" };

function networkState(): Record<string, unknown> {
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; rtt?: number; downlink?: number; saveData?: boolean };
  }).connection;
  return {
    online: navigator.onLine,
    visibility: document.visibilityState,
    connection: connection?.effectiveType,
    rtt: connection?.rtt,
    downlink: connection?.downlink,
    saveData: connection?.saveData,
    page: location.pathname,
  };
}

function reportFailure(failure: Reported): void {
  const path = pathTemplate(failure.path);
  const status = failure.status ? ` ${failure.status}` : "";
  captured(FAILURE_NAMES[failure.cause], `${failure.method} ${path}${status}`, {
    // Being offline is the visitor's state, not our fault: kept for diagnosis, not as an error.
    level: failure.cause === "offline" ? "info" : "error",
    tags: { kind: "request", failure: failure.cause, method: failure.method, path, status: String(failure.status ?? "") },
    extra: { waitedMs: Math.round(failure.waitedMs), ...networkState() },
    fingerprint: ["request", failure.cause, failure.method, path],
  });
}

export function reportBadFormat(method: string, path: string, status: number, waitedMs: number): void {
  if (typeof window === "undefined") return;
  reportFailure({ method, path, cause: "format", status, waitedMs });
}

export function reportFormCheck(form: string, rule: string): void {
  captured("FormCheck", `${form}: ${rule}`, {
    level: "warning",
    tags: { kind: "form", form, rule },
    extra: { page: typeof location === "undefined" ? undefined : location.pathname },
    fingerprint: ["form", form, rule],
  });
}

export function reportRenderError(error: Error & { digest?: string }, boundary: string): void {
  if (typeof window === "undefined") return;
  queueItem({
    name: error.name || "Error",
    message: error.message || String(error),
    stack: error.stack,
    level: "error",
    tags: { kind: "render", boundary, ...(error.digest ? { digest: error.digest } : {}) },
    extra: { page: location.pathname },
  });
}

function captureEarly(error: unknown): void {
  if (sentry || !(error instanceof Error) || !isOurError(error.stack)) return;
  queueItem({ name: error.name, message: error.message, stack: error.stack, level: "error", tags: { kind: "early" } });
}

if (typeof window !== "undefined") {
  installNetwatch();
  onFailure((failure) => {
    if (failure.cause !== "aborted") reportFailure(failure as Reported);
  });
  // Until the SDK has loaded our own listeners keep what happens, and the queue survives leaving the page.
  window.addEventListener("error", (event) => captureEarly(event.error));
  window.addEventListener("unhandledrejection", (event) => captureEarly(event.reason));
  window.addEventListener("pagehide", () => {
    if (!sentry && pending.length) writeStored([...readStored(), ...pending.splice(0)]);
  });
}

export function startErrorReports(dsn: string | undefined, release?: string): void {
  if (!dsn || started || typeof window === "undefined") return;
  started = true;
  let attempts = 0;
  const load = (): void => {
    attempts += 1;
    import("@sentry/browser").then((module) => {
      module.init({
        dsn,
        release: release || undefined,
        environment: location.hostname,
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: { request: { allow: ["User-Agent"] }, response: false },
          httpBodies: [],
          urlQueryParams: false,
        },
        enhanceFetchErrorMessages: "report-only",
        allowUrls: [OUR_CODE],
        denyUrls: [EXTENSIONS],
        // Offline queue lives in IndexedDB: an event raised while the site is unreachable is sent on the next visit.
        transport: module.makeBrowserOfflineTransport(module.makeFetchTransport),
        // BrowserApiErrors wraps timers and listeners, so a foreign callback's error would carry a frame of our bundle.
        integrations: (defaults) => defaults.filter((integration) => !["BrowserSession", "Breadcrumbs", "BrowserApiErrors"].includes(integration.name)),
        beforeSend: (event) => (isOurEvent(event) ? scrubEvent(event) : null),
      });
      module.setTags({ ...deviceTags(navigator.userAgent), site: location.host });
      const counter = metrikaId();
      // The Metrika visitor id leads to the Webvisor recording of the same visit.
      if (counter) window.ym?.(counter, "getClientID", (id: string) => module.setTag("ym_client", id));
      sentry = module;
      const stored = readStored();
      writeStored([]);
      for (const item of [...stored, ...pending.splice(0)]) deliver(module, item);
    }).catch(() => {
      // The chunk comes from our own server; when it is unreachable, try again once the connection returns.
      if (attempts >= 5) return;
      const retry = () => {
        window.removeEventListener("online", retry);
        clearTimeout(timer);
        load();
      };
      const timer = setTimeout(retry, 30_000 * attempts);
      window.addEventListener("online", retry);
    });
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(load, { timeout: 3000 });
  else setTimeout(load, 1500);
}
