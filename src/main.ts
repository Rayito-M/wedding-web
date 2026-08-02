import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';
import * as Sentry from '@sentry/angular';

import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments';
import { RELEASE } from './environments/release';

import { redactAuthorizationHeaders } from './app/core/helper/sentry-redaction';

registerLocaleData(localeEs);
registerLocaleData(localeFr);

// Operational error tracking (hub ADR-0026 / T253) — distinct from the GA4 *user-behavior*
// analytics gated behind the consent banner (hub ADR-0027 / T250). Sentry/Replay set no cookies
// (Replay persists to localStorage/sessionStorage only), so this intentionally initializes
// unconditionally, outside the consent-banner gate.
//
// --- T253 bundle-budget check ---
// Measured via `pnpm build:prod`, comparing the committed pre-T253 baseline against this change
// (`@sentry/angular` + `Sentry.init(...)`, including the required Replay integration):
//   - Baseline: 494.89 KB raw / 117.98 KB estimated transfer (Angular CLI's gzip proxy).
//   - With Sentry: 724.12 KB raw / 181.13 KB estimated transfer.
//   - Delta attributable to this change: ~229.2 KB raw / ~63.2 KB estimated transfer.
// This is NOT in line with hub ADR-0026's ~25 KB gzipped estimate — actual is ~2.5x that. Most of
// the gap is very likely the Replay integration's recording engine (rrweb-based), which the ADR's
// headline estimate probably didn't price in; the task's acceptance criteria require Replay, so it
// isn't optional here. Total initial bundle (181.13 KB estimated transfer) is still under the hub's
// < 200 KB gzipped initial-JS budget (`SPEC.md` line 98 / `ARCHITECTURE.md` "Performance budgets"),
// but only by ~19 KB margin — this also newly trips `angular.json`'s `initial` budget's raw-byte
// `maximumWarning: 500kB` (724.12 KB > 500 KB; still under the 1 MB `maximumError`), which T252
// already flagged as a raw/gzip unit mismatch against the hub's gzip target — that finding now has
// a concrete build-time warning attached to it. Flagging both findings here rather than silently
// claiming budget compliance; not resolved as part of this task (angular.json budget realignment is
// broader scope, per T252 precedent). (Measured 2026-08-02 against an Angular 22 production build;
// numbers will drift with future dependency/app-code changes.)
Sentry.init({
  dsn: environment.sentryDsn,
  // `environment.stage` (not `environment.production`, per the task's literal wording): the
  // `Environment` model's `production: boolean` was refactored to a `stage: AppStage` enum
  // ('local' | 'dev' | 'alpha' | 'beta' | 'production') mid-implementation, by a change this task
  // did not make (see commit history / PR description) — adapted to it rather than fighting it,
  // since `stage` is a strict superset of the boolean and Sentry's `environment` tag accepts any
  // string, so passing the more granular value is at least as useful.
  environment: environment.stage,
  release: RELEASE,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.5,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  // Bearer-token leak guard: the generated API client attaches `Authorization: Bearer <token>` per
  // request (no centralized `core/interceptor/` for it — see src/app/core/helper/sentry-redaction.ts)
  // so any HTTP breadcrumb/event data Sentry captures is scrubbed of that header before it leaves
  // the browser.
  beforeBreadcrumb: (breadcrumb) => redactAuthorizationHeaders(breadcrumb),
  beforeSend: (event) => redactAuthorizationHeaders(event),
});

bootstrapApplication(App, appConfig).catch((err) => {
  console.error(err);
  Sentry.captureException(err);
});
