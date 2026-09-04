## Phase G — Analytics consent (hub ADR-0027)

> Hub ADR-0027 permits aggregate Google Analytics (GA4) traffic visibility (visits, page views,
> basic device/geography), reversing the "no analytics" clause of ADR-0026, **conditional on** a
> cookie consent banner gating GA load — this is a GDPR/ePrivacy requirement, not optional polish.
> The DS shipped the reference component: `../wedding-ui-design/components/core/ConsentBanner.jsx`
> (+ `.d.ts` + `.prompt.md`). Unlike the Phase — Visual refresh tasks above, this is **new product
> behavior**, not a visual-only pass: real `.ts` logic (GA gating, persistence) and real i18n wiring
> are both in scope and required — the "hardcode new copy" convention used in T219–T238 does **not**
> apply here.

### T250 — Cookie consent banner + gated GA4 loading
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Delivered:**
  - `app-consent-banner` (`src/app/shared/consent-banner/`) mirrors DS `ConsentBanner.jsx`: fixed
    bottom bar, `--surface-card` fill, 1px `--border-hairline` top border only, no scrim, message +
    note line, equal-weight Accept (primary) / Decline (secondary) pills via the shared `app-btn`.
  - `ConsentService` (`src/app/core/service/consent.service.ts`), naming mirrors the DS 1:1:
    `CONSENT_KEY = 'sc-analytics-consent'`, `readConsent()`, `writeConsent(value)`; a `decision`
    signal drives banner visibility (hides permanently once a decision is persisted).
  - `consentBanner.message` / `.note` / `.accept` / `.decline` keys added to all three
    `public/i18n/*.json` locales, seeded from the DS `CONSENT_COPY` table.
  - Mounted once in `src/app/app.html`, sibling to `<router-outlet />` (not inside `PrivateLayout`),
    so it shows on first visit regardless of auth state.
  - GA4 (`gtag.js`) is only ever injected from `writeConsent('accepted')` — reads
    `environment.gaMeasurementId`, no-ops when blank, sets `anonymize_ip: true`, single `gtag('config', …)`
    call, no custom events. Re-armed on page load only when a prior `'accepted'` decision is already
    stored (the script tag itself isn't persisted across reloads). Decline never injects the script.
  - `gaMeasurementId: string` added to `Environment` / `environment.ts` / `environment.prod.ts` — blank
    in both today (no real GA4 property yet); `environment.prod.ts` carries a `TODO` to set the real ID
    before shipping.
  - `pnpm typecheck && pnpm lint && pnpm build` green. Verified by code/build-output inspection (grepped
    for `gtag`/`googletagmanager` outside the gated path, confirmed no static reference in the built
    `index.html`) — **not** a live browser network-tab trace; flagging that gap rather than claiming it.
  - Built in an isolated worktree in parallel with T251; the note line's link target
    (`/privacy-policy`) was agreed as a shared contract before either task started, so no direct code
    dependency was needed between the two.
- **Refs:** hub ADR-0027; DS `components/core/ConsentBanner.jsx`, `ConsentBanner.d.ts`,
  `ConsentBanner.prompt.md`; files: `src/app/shared/consent-banner/`,
  `src/app/core/service/consent.service.ts`, `src/app/app.html`, `src/environments/`,
  `public/i18n/*.json`.

### T251 — Privacy policy disclosure for Google Analytics
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T250
- **Delivered:**
  - New `src/app/screens/privacy-policy/` screen at a top-level public route `/privacy-policy`
    (`src/app/app.routes.ts`, no guard, placed before the `PrivateLayout` block and the `**` wildcard)
    — reachable regardless of auth state.
  - Localized (es/en/fr) content under `public/i18n/*.json`'s new `privacyPolicy.*` block: GA used for
    aggregate traffic only (no custom event tracking), cookies are set, IPs are anonymized, a link to
    Google's own privacy policy (`https://policies.google.com/privacy`, opens in a new tab), and a
    text-only note that the Accept/Decline choice can be changed (clearing the site's browser data) —
    deliberately not an interactive "reset consent" control, since that would need to call into
    T250's `ConsentService`, which wasn't available in this task's isolated worktree; kept as a
    disclosure per the task's stated scope.
  - `consentBanner`'s note line (T250) links here via `routerLink="/privacy-policy"`.
  - Explicitly not built: a full legal privacy policy covering guest data (phone/email/dietary/etc.)
    beyond the GA disclosure — out of scope per the task, flagged as a follow-up if the couple wants one.
  - `pnpm typecheck && pnpm lint && pnpm build` green; confirmed the `privacy-policy` lazy chunk is
    present in the build output and the route resolves ahead of the wildcard redirect.
  - Built in an isolated worktree in parallel with T250; merged together afterward with no file
    conflicts (only the `titles`/new top-level i18n blocks touched, at different insertion points).
- **Refs:** hub ADR-0027; files: `src/app/screens/privacy-policy/`, `src/app/app.routes.ts`,
  `public/i18n/*.json`.

### T252 — Verify GA4 consent banner against the bundle/perf budget
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T250
- **Delivered:**
  - Measured via `pnpm build` (production), comparing with/without `<app-consent-banner>` mounted:
    delta attributable to `ConsentBanner` + `ConsentService` is **~3.30 KB raw / ~0.57 KB** Angular
    CLI "estimated transfer size" (gzip proxy). Total initial bundle with the banner included:
    **494.84 KB raw / 117.89 KB estimated transfer** — well under the hub's **< 200 KB gzipped**
    initial-JS budget (`SPEC.md` line 98 / `ARCHITECTURE.md` "Performance budgets"), large margin, no
    breach. Numbers recorded in a doc comment on `ConsentService` in
    `src/app/core/service/consent.service.ts` (measured 2026-08-01 against an Angular 22 production
    build; will drift with future changes but the delta itself is small enough to leave ample room).
  - Documented in the same file (class doc comment + a targeted note on `loadAnalytics()`) that
    `gtag.js` is fetched as a remote `async` script tag from `googletagmanager.com` at *runtime*,
    never imported/bundled — so it's outside the build-time initial-bundle budget entirely (contrast
    ADR-0026's Sentry, ~25 KB gzipped, which *is* bundled); its cost is a separate runtime
    network/parse/execute cost.
  - `angular.json`'s `initial` budget uses raw-byte thresholds (`maximumWarning: 500kB`,
    `maximumError: 1MB`) — a unit mismatch against the hub's gzip target. Flagged only, not fixed:
    the consent-banner's ~3.3 KB raw delta doesn't push either threshold, and a general raw/gzip
    realignment is broader than this task's scope. Worth a separate follow-up if the team wants it
    resolved.
  - Live Lighthouse trace of the loaded `gtag.js` script was correctly left **not done** by the
    implementer at delivery time, since `gaMeasurementId` was still blank in both environment files —
    **note: the user has since set real GA4 measurement IDs directly in `environment.ts` and
    `environment.prod.ts` (confirmed intentional, 2026-08-01)**, so that blocker no longer applies;
    the live Lighthouse Performance trace (consent accepted, real ID loaded) is now actually
    unblocked and still outstanding — flag as a quick follow-up if a Lighthouse run is wanted before
    shipping.
  - `pnpm typecheck && pnpm lint && pnpm build` green; only the 4 pre-existing unrelated
    `shared/modal/` lint errors present, confirmed unaffected.
- **Refs:** hub ADR-0027 (Consequences: Negative), hub `SPEC.md` line 98, hub `ARCHITECTURE.md`
  "Performance budgets", hub ADR-0026 (Sentry bundle-cost precedent, ~25 KB gzipped documented
  in-ADR); files: `src/app/core/service/consent.service.ts`.
