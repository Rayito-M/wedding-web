/**
 * Bearer-token leak guard for Sentry (hub ADR-0026 / T253).
 *
 * The generated API client (`src/app/core/api/configuration.ts`) attaches the session token as a
 * plain `Authorization: Bearer <token>` header per request — there's no `core/interceptor/` in the
 * chain to centrally strip it. Sentry's HTTP breadcrumbs/spans and captured request/response data
 * can surface arbitrary header maps, so this walks any value Sentry is about to send and redacts
 * every `Authorization` key (case-insensitive; nested at any depth, e.g.
 * `breadcrumb.data.request_headers.Authorization` or `event.request.headers.authorization`)
 * before it ever leaves the browser.
 */

const REDACTED = '[Filtered]';
const SENSITIVE_HEADER_KEY = /^authorization$/i;

/**
 * Recursively walks `value`, replacing any object property whose key matches `Authorization`
 * (case-insensitive) with `'[Filtered]'`. Returns a new value; does not mutate the input, since
 * Sentry breadcrumb/event objects may be reused internally.
 */
export function redactAuthorizationHeaders<T>(value: T): T {
  if (Array.isArray(value)) {
    // reason: recursive structural clone of unknown-shaped Sentry payloads
    return value.map((item) => redactAuthorizationHeaders(item)) as unknown as T;
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_HEADER_KEY.test(key) ? REDACTED : redactAuthorizationHeaders(entry);
    }
    // reason: recursive structural clone of unknown-shaped Sentry payloads
    return result as unknown as T;
  }

  return value;
}
