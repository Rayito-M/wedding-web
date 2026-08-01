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
   */
  private loadAnalytics(): void {
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
