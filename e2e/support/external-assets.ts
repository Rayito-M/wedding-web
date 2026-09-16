import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page, Route } from '@playwright/test';

/**
 * The suite's third-party network dependency, removed (T389).
 *
 * `playwright.config.ts` says this suite contacts no live backend and stubs
 * the network at the Playwright layer. That was true of `wedding-api` and
 * false of everything else: measured on 2026-09-16, **every page in the suite
 * reaches the public internet on every single load**, because a fresh
 * `BrowserContext` starts with an empty HTTP cache and the suite creates one
 * per test.
 *
 * | Page | Host | Requests per load |
 * |---|---|---|
 * | app (`src/index.html:40-45`) | `fonts.googleapis.com` + `fonts.gstatic.com` | 2 |
 * | app (`src/main.ts:40`, `environment.ts:11`) | `o…ingest.de.sentry.io` | 3 |
 * | DS kit (`ui_kits/wedding-app/index.html:11-13`) | `unpkg.com` — React, ReactDOM, Babel, ~5.3 MB | 3 |
 * | DS kit (`tokens/typography.css:3`, an `@import`) | `fonts.googleapis.com` + `fonts.gstatic.com` | 4 |
 *
 * Across one full run (425 tests, ~190 kit opens) that is several thousand
 * requests and on the order of a gigabyte from `unpkg` alone, from one IP, in
 * about four minutes. **That is the T389 flake.** The Google Fonts stylesheet
 * and the `unpkg` scripts are both render-blocking, so a slow or throttled
 * response stalls `page.goto`'s `load`; the Sentry envelope POSTs stall
 * `waitForLoadState('networkidle')`, which is where the worst observed run
 * failed first. Reproduced by stalling each host in turn: a stalled
 * `fonts.googleapis.com` or `unpkg.com` reproduces the suite's own
 * `ds-kit.ts:121` timeout exactly, and a partially-slow one pushes the same
 * lost budget onto `:122` or `:128` — which is why the reported line moved
 * between runs while the cause did not.
 *
 * So: **fetch each third-party asset once, then serve it from cache.** Bytes
 * are reproduced exactly — `route.fetch()` replays the page's own request
 * (User-Agent included, which is what decides whether Google Fonts answers
 * with `woff2` or a legacy format), and the cache key carries the User-Agent
 * for the same reason. Nothing about how the page renders changes, which
 * matters here more than usual: ten of these specs measure type and geometry
 * against the design system, and a substituted font would move every number.
 *
 * The cache lives in `playwright/.cache/` (already git-ignored) and survives
 * between runs, so after the first run the suite needs no network at all.
 *
 * Sentry is **blocked** rather than cached: the e2e suite has no interest in
 * error reporting, `environment.ts` carries the **production** DSN, and until
 * now every local run shipped Session Replay data to the real project.
 */

const CACHE_DIR = path.resolve(__dirname, '../../playwright/.cache/external-assets');

/** Third-party hosts whose exact bytes the page needs. Fetched once, then replayed. */
const CACHED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com'];

/** Telemetry the suite must never send. Answered locally, never fetched. */
const BLOCKED_HOST_RE = /(^|\.)ingest\.[a-z0-9-]+\.sentry\.io$/i;

interface CachedResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

/** Per-worker memory cache. Playwright runs one worker per process, so this is
 *  hot after the first request and the disk cache only pays on a cold start. */
const memory = new Map<string, CachedResponse>();

/** Pages already wired up — `installApiMocks` and `openDsKitScreen` both call
 *  this, and a kit page opened in a mocked context would otherwise register
 *  the same routes twice. */
const wired = new WeakSet<Page>();

function keyOf(url: string, userAgent: string): string {
  return createHash('sha256').update(`${url}\n${userAgent}`).digest('hex').slice(0, 40);
}

/**
 * `content-encoding` and `content-length` describe the wire body, and
 * `route.fetch()` hands back the *decoded* one — replaying either header
 * would make the browser try to gunzip plain bytes, or truncate them.
 */
function replayableHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (lower === 'content-encoding' || lower === 'content-length') continue;
    out[name] = value;
  }
  return out;
}

async function readDisk(key: string): Promise<CachedResponse | null> {
  try {
    const [meta, body] = await Promise.all([
      readFile(path.join(CACHE_DIR, `${key}.json`), 'utf8'),
      readFile(path.join(CACHE_DIR, `${key}.bin`)),
    ]);
    const { status, headers } = JSON.parse(meta) as Omit<CachedResponse, 'body'>;
    return { status, headers, body };
  } catch {
    return null;
  }
}

async function writeDisk(key: string, entry: CachedResponse): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, `${key}.bin`), entry.body);
    await writeFile(
      path.join(CACHE_DIR, `${key}.json`),
      JSON.stringify({ status: entry.status, headers: entry.headers }),
    );
  } catch {
    // A cache that cannot be written is a slower suite, never a failing one:
    // the memory cache still holds this worker's copy.
  }
}

/** Already reported, so one cold miss per asset does not print five times. */
const warned = new Set<string>();

async function serveCached(route: Route): Promise<void> {
  const request = route.request();
  const url = request.url();
  // Google Fonts answers a different stylesheet per User-Agent (`woff2` vs the
  // legacy formats), so the UA is part of what identifies the response.
  const userAgent = (await request.allHeaders())['user-agent'] ?? '';
  const key = keyOf(url, userAgent);

  let entry = memory.get(key) ?? (await readDisk(key));
  if (!entry) {
    // The one and only time this machine touches the host for this asset: a
    // cold miss, which after the first run only happens when the DS kit or
    // `index.html` starts asking for something new. Generous timeout, because
    // the point is to pay this once rather than the ~2000 times a run used to.
    try {
      // Node's `fetch`, deliberately, and NOT `route.fetch()`. Fonts are
      // fetched lazily by the engine and routinely outlive the assertions, so
      // a cold miss often lands while the page is being torn down —
      // `route.fetch()` is bound to that context and dies with it ("Test
      // ended"), which left one `woff2` permanently uncacheable and therefore
      // permanently live. A plain Node request is not bound to anything, so
      // the cache still fills even when the page it was for has gone.
      //
      // The User-Agent is forwarded because Google Fonts answers a different
      // stylesheet for each engine, and serving Chromium's CSS to WebKit would
      // change which font files the page asks for — and, in ten parity specs,
      // every number measured against the design system.
      const response = await fetch(url, {
        headers: {
          'user-agent': userAgent,
          accept: (await request.allHeaders()).accept ?? '*/*',
        },
        signal: AbortSignal.timeout(60_000),
      });
      entry = {
        status: response.status,
        headers: replayableHeaders(Object.fromEntries(response.headers.entries())),
        body: Buffer.from(await response.arrayBuffer()),
      };
      await writeDisk(key, entry);
      memory.set(key, entry);
    } catch (cause) {
      // Never fail a test from in here: hand the request back to the browser,
      // which is exactly what happened before this file existed, and say so
      // once, named — so a genuinely unreachable host reads as itself rather
      // than as a mute timeout in a locator nobody wrote.
      if (!warned.has(key)) {
        warned.add(key);
        console.warn(
          `e2e: could not cache ${url} — falling back to a live fetch. ` +
            `(${(cause as Error).message.split('\n')[0]})`,
        );
      }
      await route.continue().catch(() => undefined);
      return;
    }
  } else {
    memory.set(key, entry);
  }

  await route
    .fulfill({ status: entry.status, headers: entry.headers, body: entry.body })
    .catch(() => undefined);
}

/**
 * Installs the third-party stubs on `page`. Idempotent, and safe to call on a
 * page that already carries the API mocks: these patterns match absolute
 * third-party URLs only and cannot shadow a `**\/v1/**` route.
 *
 * Registered BEFORE anything navigates. Called from `installApiMocks`
 * (which every spec reaches, directly or through `signInAs*`) and from
 * `openDsKitScreen` (the only place a DS-kit page is opened), so no spec file
 * has to know this exists.
 */
export async function installExternalAssetStubs(page: Page): Promise<void> {
  if (wired.has(page)) return;
  wired.add(page);

  await page.route(
    (url) => BLOCKED_HOST_RE.test(url.hostname),
    (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"e2e"}' }),
  );

  await page.route(
    (url) => CACHED_HOSTS.includes(url.hostname),
    (route) => serveCached(route),
  );
}
