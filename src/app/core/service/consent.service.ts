import { Injectable, signal } from '@angular/core';

import { environment } from '../../../environments';

/** localStorage key. Mirrors DS `ConsentBanner.jsx` `CONSENT_KEY`. */
export const CONSENT_KEY = 'sc-analytics-consent';

/** Id set on the injected `gtag.js` script tag, so we never inject it twice. */
const GA_SCRIPT_ID = 'sc-ga4-script';

export type ConsentDecision = 'accepted' | 'declined';

/** Minimal shape of the global `gtag.js` queue, avoiding `any` (hard rule). */
interface GtagWindow extends Window {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
}

/**
 * Analytics consent state (hub ADR-0027). Naming mirrors the DS reference
 * (`readConsent` / `writeConsent` / `CONSENT_KEY`) so the contract stays
 * traceable back to `../wedding-ui-design/components/core/ConsentBanner.jsx`.
 *
 * GA4 is only ever loaded from `writeConsent('accepted')` — never on
 * construction, never speculatively — so the script tag cannot exist in the
 * DOM before a decision is made.
 *
 * --- T252 bundle/perf budget verification (hub ADR-0027 Consequences: Negative) ---
 * `ConsentBanner` + `ConsentService` are mounted eagerly at the app root
 * (`app.ts`/`app.html`), so — unlike lazy-loaded screens — their code lands in
 * the *initial* bundle. Measured via `pnpm build` (production) before/after
 * temporarily unmounting `<app-consent-banner>`:
 *   - Delta attributable to this pair: ~3.30 KB raw / ~0.57 KB Angular CLI
 *     "estimated transfer size" (its gzip proxy).
 *   - Total initial bundle with the banner included: 494.84 KB raw / 117.89 KB
 *     estimated transfer — well under the hub's < 200 KB gzipped initial-JS
 *     budget (hub `SPEC.md` line 98 / `ARCHITECTURE.md` "Performance budgets").
 *   (Measured 2026-08-01 against an Angular 22 production build; exact byte
 *   counts will drift with future dependency/app-code changes but the delta is
 *   small enough to leave a large margin under budget.)
 * - `angular.json`'s `budgets` block (`initial` type) uses raw-byte
 *   `maximumWarning`/`maximumError` thresholds (500 kB / 1 MB) — a unit
 *   mismatch against the hub's gzip target (this pair's raw delta above is not
 *   directly comparable to that gzip budget for that reason). Flagged as a
 *   finding, not fixed here: the consent-banner addition itself doesn't push
 *   either threshold, and a general raw-vs-gzip realignment of the budget
 *   config is broader than this task's scope.
 * - NOT verified (blocked on a real GA4 property): a live Lighthouse
 *   Performance trace with `environment.gaMeasurementId` set and consent
 *   accepted, to measure the actual loaded `gtag.js` network/CPU cost against
 *   the Lighthouse Performance ≥ 90 budget. Not implementer-actionable — needs
 *   a real measurement ID from the couple — so left as a follow-up.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly decisionSignal = signal<ConsentDecision | null>(this.readConsent());

  /** Current stored decision, or `null` when the guest hasn't chosen yet. */
  readonly decision = this.decisionSignal.asReadonly();

  constructor() {
    // A previous visit already accepted: re-arm GA4 on this load too (the
    // script tag isn't persisted across reloads, only the decision is).
    if (this.decisionSignal() === 'accepted') {
      this.loadAnalytics();
    }
  }

  /** Read the stored decision: `'accepted' | 'declined' | null`. */
  readConsent(): ConsentDecision | null {
    try {
      const value = window.localStorage.getItem(CONSENT_KEY);
      return value === 'accepted' || value === 'declined' ? value : null;
    } catch {
      return null;
    }
  }

  /** Persist a decision. Loads GA4 only when the decision is `'accepted'`. */
  writeConsent(value: ConsentDecision): void {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
    } catch {
      // storage unavailable — decision won't persist, banner may reappear on reload
    }
    this.decisionSignal.set(value);

    if (value === 'accepted') {
      this.loadAnalytics();
    }
  }

  /**
   * Dynamically injects GA4 (`gtag.js`), anonymizing IPs per ADR-0027. No-op
   * when `environment.gaMeasurementId` is blank (local/dev) or the script is
   * already present. Only ever called after an `'accepted'` decision.
   *
   * T252: `gtag.js` is fetched as a remote, `async` script tag from
   * `googletagmanager.com` at *runtime*, right here — it is never
   * imported/bundled into the app's own JS output, so it does not count
   * against the esbuild/Angular-CLI initial-bundle budget the way a bundled
   * dependency would (contrast hub ADR-0026: Sentry, ~25 KB gzipped, bundled).
   * Its cost is a separate runtime network/parse/execute cost, not measured
   * as part of this repo's build output.
   */
  private loadAnalytics(): void {
    console.info('ConsentService: loading GA4 analytics');
    const measurementId = environment.gaMeasurementId;
    if (!measurementId) return;
    if (document.getElementById(GA_SCRIPT_ID)) return;

    const script = document.createElement('script');
    script.id = GA_SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    const gtagWindow = window as GtagWindow;
    gtagWindow.dataLayer = gtagWindow.dataLayer ?? [];
    gtagWindow.gtag = function gtag(...args: unknown[]): void {
      gtagWindow.dataLayer?.push(args);
    };
    gtagWindow.gtag('js', new Date());
    // ADR-0027: aggregate traffic visibility only, IPs anonymized, no custom
    // event/funnel tracking — this is the only `gtag()` call in the app.
    gtagWindow.gtag('config', measurementId, { anonymize_ip: true });
  }
}
