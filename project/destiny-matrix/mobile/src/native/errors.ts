import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/react-native';
import { config } from './config';

export function scrub(text: string) {
  return text.replace(/https?:\/\/[^\s)]+/g, url => url.replace(/[?#].*$/, '').replace(/\/[\w.-]{24,}(?=\/|$)/g, '/[id]'))
    .replace(/[^\s@"'<>()]+@[^\s@"'<>()]+\.[\p{L}]{2,}/gu, '[email]')
    .replace(/\b(?:\d{1,2}[.\-/]\d{1,2}[.\-/](?:19|20)\d{2}|(?:19|20)\d{2}-\d{1,2}-\d{1,2})\b/g, '[date]')
    .replace(/\b(?:eyJ[\w.-]+|[A-Za-z0-9_-]{40,})\b/g, '[token]');
}
/** An allowlist avoids SDK upgrades silently adding request bodies, routes or user context. */
export function cleanEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: event.type,
    event_id: event.event_id, timestamp: event.timestamp, level: event.level, platform: event.platform,
    release: config.release, environment: config.local ? 'mobile-local' : 'mobile',
    tags: { app: 'arcana-mobile' },
    exception: { values: event.exception?.values?.map(value => ({ type: ['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'AggregateError'].includes(value.type ?? '') ? value.type : 'Error',
      // Arbitrary exception messages may contain names or reading text that regexes cannot identify.
      value: value.value === 'ArcanaMobileDeliveryProbe' ? value.value : 'Unexpected application error',
      mechanism: value.mechanism && { type: value.mechanism.type, handled: value.mechanism.handled },
      stacktrace: value.stacktrace && { frames: value.stacktrace.frames?.map(frame => ({
        filename: frame.filename && scrub(frame.filename), function: frame.function && scrub(frame.function),
        lineno: frame.lineno, colno: frame.colno, in_app: frame.in_app,
      })) },
    })) },
    contexts: {
      os: event.contexts?.os && { name: event.contexts.os.name, version: event.contexts.os.version },
      device: event.contexts?.device && { model: event.contexts.device.model, manufacturer: event.contexts.device.manufacturer, arch: event.contexts.device.arch },
    },
  };
}
export function startErrorReports() {
  if (!config.errorsDsn) return;
  Sentry.init({
    dsn: config.errorsDsn, release: config.release, environment: config.local ? 'mobile-local' : 'mobile',
    sendDefaultPii: false, enableNative: true, enableNativeCrashHandling: true,
    autoInitializeNativeSdk: false,
    enableAutoSessionTracking: false, enableAutoPerformanceTracing: false, enableAutoBreadcrumbTracking: false,
    enableCaptureFailedRequests: false, enableUserInteractionTracing: false, enableLogs: false,
    maxBreadcrumbs: 0, tracesSampleRate: 0, profilesSampleRate: 0, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0,
    beforeBreadcrumb: () => null, beforeSend: cleanEvent,
  });
}
const reported = new Map<string, number>();
export function reportError(error: Error, code = 'unexpected') {
  if (!config.errorsDsn) return;
  const key = `${code}:${error.name}`;
  if (Date.now() - (reported.get(key) ?? 0) < 60000) return;
  reported.set(key, Date.now());
  Sentry.captureException(error, { tags: { code } });
}
export async function sendErrorProbe() {
  Sentry.captureException(new Error('ArcanaMobileDeliveryProbe'));
  if (!await Sentry.flush()) throw new Error('Error report was not delivered');
}
export function sendNativeCrashProbe() {
  if (config.local && config.errorsDsn) Sentry.nativeCrash();
}
