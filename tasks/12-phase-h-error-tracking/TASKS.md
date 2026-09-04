## Phase H — Error tracking (hub ADR-0026)

> Hub ADR-0026 adopts Sentry for full-stack **operational** error tracking (unhandled-exception
> capture, performance tracing, session replay) — explicitly distinct from the **user-behavior
> analytics** already covered by ADR-0027/T250–T252 (GA4, gated behind the consent banner).
> ADR-0026's status is `proposed`, same as ADR-0027 was when it produced T250–T252 — this repo's
> established pattern is proposed-but-actioned, so this task is not blocked on the ADR's status
> field. Like Phase G, this is new product behavior, not a visual-only pass: real `.ts`
> bootstrap-level wiring is in scope and required.

### T253 — Integrate Sentry Angular SDK (error tracking, release tagging)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Delivered:**
  - **Version deviation (flag, not silent):** `@sentry/angular@^21` does not exist on the npm
    registry — the Sentry JS SDK line jumped straight from v9 to v10 (dist-tags: `v9: 9.47.1`,
    `latest: 10.69.0`; no `v21` anywhere in the published version list). ADR-0026's "`^21`" almost
    certainly conflates the npm SDK's version line with self-hosted Sentry's calendar-style server
    versioning (e.g. Sentry 24.x/25.x), which is a separate, unrelated number. Installed
    `@sentry/angular@^10.69.0` (latest) instead — its peer range is
    `@angular/common|core|router: >= 14.x <= 22.x`, which covers this repo's Angular 22 exactly, and
    `pnpm peers check` after install shows zero new peer issues (the only peer warnings present are
    pre-existing `@ngrx/data@21.1.1` wanting Angular 21, unrelated to Sentry, unchanged by this
    task).
  - `src/main.ts`: `Sentry.init({...})` runs before `bootstrapApplication`;
    `bootstrapApplication(App, appConfig).catch((err) => { console.error(err); Sentry.captureException(err); })`
    keeps the existing `console.error` alongside the new `captureException` call. Init config:
    `dsn: environment.sentryDsn`, `release: RELEASE` (see below), `replayIntegration({ maskAllText:
    true, blockAllMedia: true })`, `tracesSampleRate: 0.5`, `replaysSessionSampleRate: 0.1`,
    `replaysOnErrorSampleRate: 1.0`, plus the `beforeBreadcrumb`/`beforeSend` redaction hooks below.
  - **`environment` tag deviation (flag, not silent):** the task's literal spec was
    `environment: environment.production ? 'production' : 'development'`. Partway through this
    implementation, `Environment.production: boolean` was refactored to `Environment.stage: AppStage`
    (`'local' | 'dev' | 'alpha' | 'beta' | 'production'`) across `environment.model.ts`,
    `environment.ts`, `environment.prod.ts`, and `configuration.service.ts`'s
    `isProduction()`/`isDevelopment()` — **not** a change this task made or was asked to make; per
    `CLAUDE.md`'s folder-ownership rules the hub is explicitly barred from touching application code,
    so this change's provenance sits outside this task's visibility and should be independently
    verified by whoever reviews this PR. Adapted rather than fought it (reverting mid-task without
    being asked felt riskier than adapting): passed `environment: environment.stage` directly to
    `Sentry.init` — a strict superset of the boolean (Sentry's `environment` option accepts any
    string tag), so the more granular stage name is at least as useful as the two-value original.
    Documented inline in `main.ts` with the same reasoning.
  - `sentryDsn: string` added to `Environment`, `environment.ts`, `environment.prod.ts` (`TODO`
    comment in `environment.prod.ts`, mirroring T250's `gaMeasurementId` pattern exactly). Note: the
    user set real Sentry DSN values directly in both files during this task (same precedent as
    T252's note about `gaMeasurementId`) — left as-is, not reverted; the stale-looking `TODO` above
    the now-populated `environment.prod.ts` value is left untouched too, matching the existing
    `gaMeasurementId` precedent in the same file.
  - **Bearer-token leak guard:** `src/app/core/helper/sentry-redaction.ts` exports
    `redactAuthorizationHeaders()`, a pure recursive function that walks any Sentry
    breadcrumb/event payload and replaces every object key matching `Authorization`
    (case-insensitive, any nesting depth) with `'[Filtered]'`, without mutating the input. Wired as
    both `beforeBreadcrumb` and `beforeSend` in `main.ts`. Unit-tested in
    `sentry-redaction.spec.ts` (7 cases: top-level, case-insensitivity, nested `request_headers`,
    inside arrays, no-op when absent, non-mutation, primitives/null/undefined pass-through) — all
    passing.
    - **Actually exercised**, not just unit-tested: a temporary Node/jsdom harness (removed after use,
      not committed) ran the real `@sentry/browser` SDK — same fetch/breadcrumb code
      `@sentry/angular` re-exports — with the app's exact `beforeBreadcrumb`/`beforeSend` hooks,
      against a real local HTTP server, making a real `fetch()` call carrying
      `Authorization: Bearer <token>` (confirmed on the wire via a server-side header log) to a
      `/v1/config/public`-shaped URL. Finding: Sentry's **default fetch/xhr breadcrumb never
      includes headers at all** (only `method`/`url`/`status_code`/`request_body_size`/
      `response_body_size` — confirmed against `@sentry/core`'s `FetchBreadcrumbData`/
      `XhrBreadcrumbData` types), so the real authenticated call's breadcrumb was clean before the
      guard even ran. To prove the guard itself works (not just that the SDK happens not to need it
      yet), also fed a synthetic breadcrumb and a `captureException` context shaped like a future
      `httpClientIntegration`/manual-instrumentation payload that *does* carry
      `Authorization: Bearer <token>` in `data.request_headers` / `contexts.request.headers` — in
      both cases the token was replaced with `'[Filtered]'` before the payload would have left the
      browser. (One artifact worth naming: the harness's own `console.log` of the token, used to
      prove it was really on the wire, itself became a Sentry `console` breadcrumb via the SDK's
      default console-capture — a reminder that this guard redacts by *header key*, not by scanning
      arbitrary log message text for token-shaped strings; general console-log hygiene is a separate,
      unaddressed concern, out of this task's scope.)
  - **Release tracking:** `scripts/generate-release.mjs` (new, mirrors `scripts/gen-api.mjs`'s
    style/doc-comment conventions) regenerates `src/environments/release.ts` — `export const RELEASE
    = '<git rev-parse HEAD>'` — chained into `package.json`'s `build`/`build:prod` scripts
    (`node scripts/generate-release.mjs && ng build [...]`). Chosen over an `angular.json`
    file-replacement or an env-var read because this Angular CLI version (`@angular/build` 22, the
    esbuild-based "application" builder) has no built-in `process.env`/`define`-style passthrough
    (verified: no `define` option in its build schema, no `NG_APP_`/`import.meta.env` support
    either) — a plain pre-build codegen script was the simplest mechanism that actually works with
    this toolchain. `release.ts` is committed with a `'dev'` placeholder (so `typecheck`/`lint`/`test`
    — which never invoke the build — always import a real file) and is overwritten on every
    `pnpm build`/`pnpm build:prod` run; not gitignored, so a local build leaves it modified in the
    working tree until the next commit (same trade-off already accepted for the generated API
    client, just without the "never hand-edit, only regenerate" enforcement gen:api gets from its
    `--check` mode — not built here, since a single-constant file doesn't carry the same drift risk).
    **Confirmed non-`"unknown"`/populated in a real production build:** `pnpm build:prod` at commit
    `4f7873c` wrote `RELEASE = '4f7873ce8c3f6c9d66f71e88a397af5ebff8f056'`, and
    `grep -c '4f7873ce8c3f6c9d66f71e88a397af5ebff8f056' dist/wedding-app/browser/main-*.js` returned
    `1` — the hash is present exactly once in the built bundle.
  - **Bundle check — does NOT match the ADR estimate (flag, not silent):** measured via
    `pnpm build:prod`, comparing the committed pre-T253 baseline against this change:
    - Baseline: 494.89 KB raw / 117.98 KB estimated transfer (Angular CLI's gzip proxy).
    - With `@sentry/angular` + `Sentry.init(...)` (incl. the required Replay integration): 724.12 KB
      raw / 181.13 KB estimated transfer.
    - Delta: **~229.2 KB raw / ~63.2 KB estimated transfer** — roughly **2.5x** hub ADR-0026's ~25 KB
      gzipped estimate, not "in the ballpark" of it. Most of the gap is very likely the Replay
      integration's rrweb-based recording engine, which the ADR's headline number probably didn't
      price in — Replay is a hard requirement of this task's acceptance criteria, not optional, so
      this isn't something the implementation could have trimmed away.
    - Total initial bundle (181.13 KB estimated transfer) is still under the hub's < 200 KB gzipped
      budget (`SPEC.md` line 98 / `ARCHITECTURE.md` "Performance budgets"), but the margin shrank
      from T252's ~82 KB to **~19 KB** — future additions have much less headroom now.
    - This also newly trips `angular.json`'s `initial` budget's raw-byte `maximumWarning: 500kB`
      (724.12 KB > 500 KB; still under `maximumError: 1MB`) for the first time — a real build
      warning now, not just T252's flagged raw/gzip unit-mismatch finding.
    - Numbers recorded as a doc comment on `Sentry.init(...)` in `src/main.ts` (same pattern as
      `ConsentService`'s T252 doc comment). Measured 2026-08-02 against an Angular 22 production
      build; will drift with future dependency/app-code changes.
  - Sentry/Replay introduce no cookies (Replay persists to localStorage/sessionStorage only), so
    `Sentry.init(...)` runs unconditionally in `main.ts`, outside the T250 consent-banner gate —
    this is operational error tracking, distinct from the user-behavior analytics (GA4) that banner
    gates. Documented inline as a comment above the `Sentry.init(...)` call.
  - `pnpm typecheck && pnpm lint` green (lint: only the same 4 pre-existing unrelated
    `shared/modal/` errors, confirmed unaffected, same as T252's baseline).
    **`pnpm test` is not fully green** — 7/9 tests pass (all 7 new
    `sentry-redaction.spec.ts` cases). The 2 failing tests are the pre-existing
    `src/app/app.spec.ts` suite, failing on `NG0201: No provider found for EntityServices`
    (`ConfigurationService` → `EntityServices`, via `provideEntityDataServices()` missing from that
    spec's `TestBed` providers) — confirmed via `git stash` that this failure is identical on the
    committed pre-T253 baseline, i.e. predates and is unrelated to this task. Flagging rather than
    silently claiming full green, and rather than fixing a pre-existing, out-of-scope test outside
    this task's boundary.
- **Refs:** hub ADR-0026 ("Implications per repo" → wedding-web); hub ADR-0027/T250 (`gaMeasurementId`
  placeholder precedent), T252 (bundle-budget check precedent); files: `package.json`,
  `pnpm-lock.yaml`, `src/main.ts`, `src/environments/environment.model.ts`,
  `src/environments/environment.ts`, `src/environments/environment.prod.ts`,
  `src/environments/release.ts`, `scripts/generate-release.mjs`,
  `src/app/core/helper/sentry-redaction.ts`, `src/app/core/helper/sentry-redaction.spec.ts`,
  `src/app/core/helper/index.ts`.
