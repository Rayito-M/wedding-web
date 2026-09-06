# T369 — Design-parity rescan: full table

One row per measured metric. **Verdict**: `match` (±1px / exact color, asserted as a hard
Playwright expectation), `DEVIATES` (asserted, wrapped in `test.fixme()` — the spec documents the
defect and will flip to enforced once fixed), or `kit-off-grid` (the KIT's own literal doesn't sit
on any DS token — filed to `../wedding-ui-design/contract/FINDINGS.md` instead of counted against
the app). No `kit-off-grid` rows were found in this rescan — every deviation traced back to an
existing app-side token (`--text-micro: 11px`, the `--space-*` scale via `calc()`, etc.) that the
screen simply doesn't use yet, so all of them are `DEVIATES`, not DS-side findings.

Spec files: `e2e/layout/design-parity-{home,dashboard,schedule,rsvp,people,overview,guests,milestones,config}.spec.ts`.

## Guest/Home ↔ `/me` (guest) — `design-parity-home.spec.ts`

| Breakpoint | Metric | Kit | App | Verdict |
|---|---|---|---|---|
| desktop | pill row flush with greeting (Δ) | 0px | 0px | match |
| desktop | header→pill-row gap | 26px | 26px | match |
| desktop | pill-row→greeting gap | 18px | 18px | match |
| desktop | pill background/border/weight/size (both states) | exact | exact | match |
| desktop | content column width (contract `ScreenHome.shell.maxWidth` 900) | 900px | 900px | match |
| mobile | pill row flush with greeting (Δ) | 0px | 0px | match |
| mobile | header→pill-row gap | 10px | 10px | match |
| mobile | pill-row→greeting gap | 16px | 16px | match |
| mobile | pill background/border/weight/size (both states) | exact | exact | match |
| mobile | selected pill padding | `5px 11px` | `6px 14px` (documented T368 deviation, not re-flagged) | DEVIATES (pre-existing, T368) |

## Couple/Home ↔ `/dashboard` (couple) — `design-parity-dashboard.spec.ts`

Same metrics/mechanism as Guest/Home (`ScreenHome.jsx`'s `content` branch renders identically for
both roles). All match, both breakpoints, including the 900px content-column width.

| Breakpoint | Metric | Kit | App | Verdict |
|---|---|---|---|---|
| desktop | all Home-subnav metrics (alignment, gaps, pill type) | — | — | match |
| desktop | content column width | 900px | 900px | match |
| mobile | all Home-subnav metrics | — | — | match |

## Guest/Schedule ↔ `/schedule` (guest) — `design-parity-schedule.spec.ts`

| Breakpoint | Metric | Kit | App | Verdict |
|---|---|---|---|---|
| desktop | title flush with note (Δ) | 0px | 0px | match |
| desktop | content column width (contract 620) | 620px | 620px | match |
| desktop | status pill font-size / text-transform / letter-spacing | 9px / uppercase / 0.12em | 9px / uppercase / 0.12em | match |
| desktop | header→title gap | 26px | 14px | **DEVIATES** (Δ12px) |
| mobile | header→title gap | 12px | 14px | **DEVIATES** (Δ2px) |
| both | note font-size | 11px (`--text-micro`) | 12px (`--text-caption`) | **DEVIATES** |
| both | status pill background/border-style/padding | solid fill `var(--status-provisional)`, `1px solid transparent`, `2px 8px` | dashed, transparent fill, `3px 9px` | **DEVIATES** (component-recipe divergence) |

## Guest/RSVP ↔ `/rsvp` (guest, first-time reply) — `design-parity-rsvp.spec.ts`

Fixture gap closed (T369, opt-in `rsvpStatus` on `installApiMocks`): the guest's own RSVP mock was
unmocked (fell to the 501 catch-all), so `/rsvp` rendered nothing. Now returns a `pending` RSVP,
matching the kit's own default first-load state (`app-rsvp-create` ↔ `ScreenRSVPCreate`, step 0).

| Breakpoint | Metric | Kit | App | Verdict |
|---|---|---|---|---|
| desktop | step h2 present, choice-card border color (unselected) | present, hairline | present, hairline | match |
| mobile | same | present, hairline | present, hairline | match |
| desktop | content column width (contract 620) | 620px (outer `AppShell` column) | 560px (`app-rsvp-create` host IS the kit's own inner reply-card, 560px — there is no separate outer 620 wrapper anywhere in the app) | **DEVIATES** |

## Guest/People ↔ `/people` (guest) — `design-parity-people.spec.ts`

| Breakpoint | Metric | Kit | App | Verdict |
|---|---|---|---|---|
| desktop | title accent word position/present | present | present | match |
| desktop | selected filter-chip font-size/padding/background | 10.5px / `6px 12px` / accent | 10.5px / `6px 12px` / accent | match |
| desktop | content column width (contract 980) | 980px | 980px | match |
| mobile | same three metrics | match | match | match |

Fully conforming — no deviations found.

## Couple/"Manage · Overview" ↔ `/overview` (couple) — `design-parity-overview.spec.ts`

| Breakpoint | Metric | Kit | App | Verdict |
|---|---|---|---|---|
| desktop | greeting ("Buenos días") font-size | 12px | 12px | match |
| desktop | content column width (contract, `ScreenHome` shell reused, 900) | 900px | 900px | match |
| desktop | "replies so far" stats-card border color | hairline | hairline | match |
| desktop | "the plan so far" milestone-progress card (+ next-3 list) | present | **absent** (`dashboard.html`'s task block is commented out) | **DEVIATES** (structural) |
| desktop | "this week" task list | present | **absent** | **DEVIATES** (structural) |

## Couple/Guests ↔ `/guests` (couple) — `design-parity-guests.spec.ts`

| Breakpoint | Metric | Kit | App | Verdict |
|---|---|---|---|---|
| desktop | header title font-size | 26px | 26px | match |
| desktop | "Attending" stat value font-size/accent color | 22px / accent | 22px / accent | match |
| desktop | table-header "Guest" column font-size/letter-spacing/text-transform | 10px / 0.14em / uppercase | 10px / 0.14em / uppercase | match |
| mobile | header background color | surface | surface | match |
| mobile | header title font-size | 26px (`ScreenGuestManagerMobile.jsx` keeps the desktop size) | 20px (`guest-manager.scss`, only scales to 26px at ≥900px) | **DEVIATES** |

(No content-column-width metric: `ScreenGuestManager` is `fullBleed` in the kit and carries no
`shell.maxWidth` in the contract — Manage's own rail replaces a centered column.)

## Couple/Milestones ↔ `/milestones` (couple) — `design-parity-milestones.spec.ts`

| Breakpoint | Metric | Kit | App | Verdict |
|---|---|---|---|---|
| desktop | header title font-size | 26px | 26px | match |
| desktop | "Reached" counter font-size/accent color | 22px / accent | 22px / accent | match |
| mobile | header title font-size | 22px | 22px | match |
| mobile | counters vs. filter chips | kit swaps to plain filter chips (`ScreenMilestonesMobile.jsx`, no value+label counters) | app keeps `.counter`/`.counter-value` at every breakpoint | noted (structural difference, not asserted — no kit counter to compare) |

Fully conforming (no `DEVIATES` — the mobile counter/chip note is a structural observation, not a
measured mismatch, since the kit has no equivalent element to measure against there).

## Couple/Settings ↔ `/config` (couple) — `design-parity-config.spec.ts`

| Breakpoint | Metric | Kit | App | Verdict |
|---|---|---|---|---|
| desktop | section-header ("Basics") title font-size | 22px | 22px | match |
| desktop | section-header note font-size | 12px | 12px | match |
| desktop | title flush with fields column (Δ) | — | ≤1px | match |
| mobile | section title box present | — | present | match |
| mobile | `.mobile-bar` Save affordance present | — | present | match |

Fully conforming — no deviations found.

## Summary

- **Fully conforming screens** (every metric within ±1px / exact colors, shipped without
  `test.fixme`): Guest/Home, Couple/Home, Guest/People, Couple/Milestones, Couple/Settings.
- **Screens with recorded deviations** (spec committed, deviating assertions under
  `test.fixme()`): Guest/Schedule (4), Guest/RSVP (1), Couple/Manage·Overview (2, structural),
  Couple/Guests (1, mobile-only).
- **DS-side findings filed**: none — every deviation traces to an existing app token
  (`--text-micro`, the `--space-*` half-step composition T368 already established) the screen in
  question simply hasn't adopted, not to a kit literal with no token to express it.
- **Test counts** (full local Playwright run, 5 projects): 235 passed, 5 failed (confirmed
  pre-existing `guest-manager-scrolled-header.spec.ts`, one per project, unrelated to this task),
  50 skipped (35 `test.fixme()` cases from this task × 5 projects, plus the pre-existing 15
  `seating-plan` skips).
