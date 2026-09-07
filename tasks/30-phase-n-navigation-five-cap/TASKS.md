# Phase N — Navigation five-cap and the Manage door (hub ADR-0045)

> The live nav shows the couple 10 flat destinations; hub ADR-0045 adopts the design system's
> information architecture (DS `c22977a`): one primary surface per role capped at five, the
> couple's tools behind a **Manage** standout entry, Home as an umbrella (Today · Getting there ·
> Good to know). Feature description: hub `docs/features/navigation-five-cap-manage.md`.
>
> **Phase N is done when**: every role's primary nav shows ≤ 5 destinations with a visible active
> state; the couple reaches Guests/Milestones/Settings only through Manage with a working back
> exit; `/travel` and info content live inside Home and old URLs redirect (no 404); all e2e
> journeys pass; labels exist in es/en/fr; and the status ledger stamps AppHeader, TabBar,
> ScreenHome, ScreenTravel, ScreenGuestManagerMobile, PlanRail `implemented`
> (`node ../wedding-ui-design/tools/status.mjs --set <name> implemented`). Findings that don't
> fit this condition are filed outside it (the Phase X lesson).
>
> Sequence: T361 → T362 → (T363 ∥ T364) → T365 → T366. The DS reference for every visual is the
> kit (`../wedding-ui-design/ui_kits/wedding-app/`, AppShell/PlanRail/AppHeader/TabBar) and the
> contract (`contract/ds-contract.json`); hard rules from hub ADR-0042/0043 apply — nav facts on
> route data, one chrome mechanism, no second scroller.
>
> **T367 (post-close, 2026-09-06) re-satisfies the exit condition.** T366 closed Phase N on
> e2e-green, but two owner-reported defects (Home's pill row and the Manage rail both underlapping
> the fixed header at ≥900px) showed the e2e suite had never actually checked for occlusion by the
> fixed header — `toBeVisible()` cannot see it. T367 fixes the clearance (consolidated onto `.body`,
> hub ADR-0043 §1) and adds a permanent `e2e/layout/occlusion-guard.spec.ts` closing that gap for
> every route this app has. Phase N's exit condition is re-satisfied as of T367.

### T361 — Port `PlanRail` (the Manage desktop rail)
- **Status:** done — pure presentational port (`src/app/shared/plan-rail/`), not wired into any
  route, screen, or the Manage area (that is T362/T364). `pnpm lint` green (ESLint's 5 documented
  pre-existing errors unchanged, ds fidelity 31/31 clean, stylelint 0 new). Unit spec covers
  section nesting, active item/section state, and nav/section emit events.
- **ADR:** hub ADR-0045 §3; ADR-0044 (mirror discipline)
- DS source `components/navigation/PlanRail.{jsx,d.ts,prompt.md}`: numbered rail items with
  active dot, per-item meta (e.g. "142 / 172"), Settings pinned to the rail foot with its seven
  sections nested beneath it, section Save moving into the section header
  (`ScreenConfigManager` controlled mode is T364's half).
- New `src/app/shared/plan-rail/` mirror; register in `design-mirror.json` (`pnpm ds:mirror`).
- **Acceptance:** component renders the DS anatomy (verify against the kit's Manage views);
  `pnpm lint` (incl. ds fidelity) green; unit spec for section nesting + active state.

### T362 — Route data carries the five-cap surfaces and the Manage group
- **Status:** done — with one deviation from the literal text (see report): `dashboard` stays the
  couple's ungrouped `home` entry (ADR-0045 §2 requires a distinct couple Home in the primary
  surface, and no replacement Home screen exists yet — building one is T364's). `guests`, not
  `dashboard`, carries `standout: true` and is the group's door; flagged in
  `decisions_needed` (non-blocking) for confirmation once T364 designs the real Overview.
  `config`/`milestones` carry `group: 'manage'`; `travel` drops `tabBar`/`topNav`/`navLabel`
  (folds into Home, ADR-0045 §4) but keeps its route and `enabledRoutes` entry untouched.
  Measured result: guest Home · Schedule · RSVP · People; couple Home · Schedule · People ·
  Manage — matching ADR-0045 §2 for both roles. Report: `reports/T362.json`.
- **ADR:** hub ADR-0045 §1/§2/§6; ADR-0042 §6 (nav derives from route data)
- `RouteChromeData` gains `group?: 'manage'` and `standout?: true`; `NAV_ORDER`/`nav-tabs.ts`
  produce per-role surfaces filtered by enablement: guest Home · Schedule · RSVP · People;
  couple Home · Schedule · People · Manage(standout). Manage children: Overview(=dashboard) ·
  Guests · Milestones · Settings. Album/Seating stay dark (guard already routes them out).
- **Acceptance:** `nav-tabs.spec` covers both roles and the ≤5 cap; no role's set overflows
  TabBar's More sheet; a route rename cannot resurrect the old flat list (walk the tree, no
  hand-copied links — ADR-0042 §6 stands).

### T363 — Header and tab bar learn the standout item
- **Status:** done — `ScreenHeader` splits `NAV_TABS` into plain links + one standout, rendered
  as an outlined pill pushed to the nav's end (`pill-interactive` base, ink-strength override,
  accent border/text + `focus-ring` on `:focus-visible`), capped defensively at six total.
  `TabBar` marks its standout tab ink-strength (not muted) at rest and matches DS `TabBar.jsx`'s
  overflow threshold (`hasStandout ? maxTabs+2 : maxTabs+1`). Both close the T362 risk: a
  group-aware `isOn`/`standoutActive` check reads the standout as active on its own door route
  *or* any `MANAGE_GROUP_TABS` member (`guests`/`milestones`/`config`), never a hand-copied path
  list. `pnpm lint` green (5 documented pre-existing ESLint errors unchanged, ds fidelity 31/31
  clean, stylelint 0 new); 16 new unit-test cases (588 → 602 total, 0 failing); verified visually
  via a temporary, uncommitted Playwright run against mobile and `--bp-lg` viewports (deleted
  after use). Found live (not fixed here, T365's scope): `nav.manage` has no es/en/fr string yet.
  Report: `reports/T363.json`.
- **ADR:** hub ADR-0045 §3; DS `AppHeader.standoutId` / `TabBar` standout
- `screen-header`: at most six items, active dot, the Manage entry as an outlined pill at the
  end (DS anatomy — outlined, accent on active). `tab-bar`: Manage as the last tab at ink
  strength (not muted). Both driven by T362's route data.
- **Acceptance:** ds fidelity clean for AppHeader/TabBar mirrors; visual check against the kit
  at mobile + `--bp-lg`; keyboard focus ring on the standout pill (focus-ring recipe).

### T364 — Home becomes the umbrella; Manage becomes an area
- **Status:** done — with deviations (see report): Manage's Overview reuses `Dashboard`
  unchanged, mounted at a new `/overview` route (one component, two modes, matching DS
  `ScreenHome`'s own `overview` flag), superseding T362's interim `guests` standout per the
  settled decision. `/travel` redirects via a `canActivate` guard, not `Route.redirectTo`
  (Angular rejects the two together, `NG04014`). "Good to know" renders as an honest empty
  state — no such content, screen or DTO field exists anywhere in the product to re-arrange,
  and the feature's own scope note (hub `docs/features/navigation-five-cap-manage.md` §6)
  rules out inventing a new capability here; flagged non-blocking in `decisions_needed`.
  `pnpm lint` green (5 documented pre-existing ESLint errors unchanged, stylelint 0 new,
  ds fidelity 31/31 clean); `npx ng test --watch=false` 603/603 (up from 602); `pnpm build`
  clean. e2e (local-only): the unit layout suite is 100% green; of the local e2e layout
  suite, 2 failures (`guest-manager-scrolled-header.spec.ts`) reproduce identically against
  this task's own pre-change starting commit in a from-scratch worktree (pre-existing,
  unrelated) and 3 (`config-manager.spec.ts`, desktop only) are a necessary, ADR-mandated
  consequence of this task's own "section-controlled mode" bullet making that pre-existing
  spec's desktop-rail premise stale — both documented precisely in `reports/T364.json` for
  T366, whose own acceptance bullet already covers reconciling every pre-existing journey.
  Report: `reports/T364.json`.
- **ADR:** hub ADR-0045 §3/§4
- Home (dashboard/invitee): pill row Today · Getting there · Good to know (DS `AppShell.subnav`);
  travel and good-to-know content render as Home sections; `/travel` (and any info URL)
  **redirects** into Home with the matching section active. Manage area: entering a
  `group: 'manage'` route swaps desktop to `PlanRail` (T361) and mobile to the Manage tab set
  with "← Back to app" above the content; guest-manager mobile adopts the Manage tabs;
  config-manager moves to `section`-controlled mode with Save in the section header.
- **Acceptance:** old deep links land on the right section (e2e); single scroller per screen
  holds (ADR-0041 §3 — the umbrella adds no second scroller); layout suite green.

### T365 — Labels in three locales
- **Status:** done — with one deviation (see report): also added `nav.overview` and
  `home.subnavAriaLabel`, which the code already referenced but the task text didn't name.
  Found and fixed a key-path collision T364 left unwired: `good-to-know.html` read its pill
  label and its own empty-state copy off the same `home.goodToKnow` path, which ngx-translate's
  `getValue` cannot resolve both as a string leaf and a dict parent — renamed the empty-state
  pair to `home.goodToKnowEmpty.title`/`.body`, matching the `emptyXxx.title/body` convention
  `milestones.empty*` already uses. `pnpm lint` green (5 documented pre-existing ESLint errors
  unchanged, stylelint 0 new, ds fidelity 31/31 clean); `npx ng test --watch=false` 603/603
  (unchanged); `pnpm build` clean, global stylesheet unchanged (2658 bytes). Verified "no
  missing-key warnings" with a throwaway script (not committed) diffing all three locale files'
  flattened key sets and resolving every literal `| translate` usage plus the T361-T364 dynamic
  labelKeys against all three locales — full parity, 0 unresolved. Found pre-existing, unrelated
  drift (not fixed, filed in report `risks`): `rsvp.hub.detail.declinedSub` missing in all three
  locales (commit `289bd39`), and a handful of `welcome.*`/`shared.*` keys present in `en` but
  not `es`/`fr` or vice versa. Report: `reports/T365.json`.
- **ADR:** hub ADR-0045 (constraints)
- `nav.manage`, `home.today`, `home.gettingThere`, `home.goodToKnow`, `manage.backToApp` (+ any
  T361-T364 strings) in es/en/fr, es first (product default). Sentence case, no title case.
- **Acceptance:** no missing-key warnings in any locale; translations reviewed against the DS
  voice ("warm, personal" — readme Content fundamentals).

### T366 — E2E: the IA holds and nothing regressed
- **Status:** done — new `e2e/layout/navigation-five-cap.spec.ts` (45 cases × 5 projects, all
  passing): per-role nav caps at 5 with one active indicator (desktop header + mobile tab bar,
  couple and guest, the latter needing a new `signInAsGuest` + `installApiMocks` `role` option
  — no prior spec could reach the guest identity at all); Manage in/out on both breakpoints
  (`PlanRail` mounts/unmounts on `inManage()`, mobile tab-set swap + "← Back to app"); the
  `/travel` → `/dashboard?section=travel` redirect landing on "Getting there" with the real
  embedded Travel screen; RSVP/schedule/guests/milestones/settings all still resolving their own
  screen (title-based, both roles). `config-manager.spec.ts`'s 3 desktop assertions re-pointed
  from the screen's own retired `.rail` to Manage's `PlanRail` (`.manage-rail .rail`/
  `.section-item`) per T364's own handoff — coverage kept, not deleted. T364's "pre-existing,
  unrelated" claim for `guest-manager-scrolled-header.spec.ts` independently reproduced against
  a from-scratch worktree at `bd7766b`: confirmed, not fixed here (carried forward as a risk).
  `pnpm lint` green (5 documented pre-existing ESLint errors unchanged, stylelint/ds fidelity
  clean); `npx ng test --watch=false` 603/603 (unchanged); `pnpm build` clean (2658 bytes). Full
  local Playwright run, all 5 projects: 120 passed, 5 failed (the confirmed pre-existing
  failures above), 15 skipped (`seating`, absent from `enabledRoutes`, unrelated). Ledger
  stamped (`AppHeader`/`TabBar`/`ScreenHome`/`ScreenTravel`/`ScreenGuestManagerMobile`/
  `PlanRail` → `implemented`); `node ../wedding-ui-design/tools/audit.mjs`: gate pass, 0
  violations, board `draft 5 · implemented 51 · out-of-scope 5` — 0 outdated, 0 queued from this
  feature. **Phase N is complete.** Report: `reports/T366.json`.
- **ADR:** hub ADR-0045 §Consequences
- Playwright: per-role nav renders ≤5 with active state; Manage in/out (rail + mobile tabs +
  back exit); `/travel` redirect; every pre-existing journey (RSVP, schedule, guests,
  milestones, settings) passes unchanged.
- **Acceptance:** suite green in CI conditions; then stamp the six ledger items `implemented`
  and re-run `node ../wedding-ui-design/tools/audit.mjs` — board shows 0 outdated, 0 queued
  from this feature.

### T367 — Fixed-header clearance misses the rail and the Home subnav (post-close defect)
- **Status:** done — measured both defects before fixing: the fixed header's real rendered height
  (59px couple/57px guest at ≥900px — the standout pill and nav row outgrew the old avatar-only
  52px assumption; 62px on mobile, harmless there because the header stays transparent pre-scroll)
  outgrew the hardcoded clearance, and `.manage-rail` got none at all (it is `main`'s flex sibling
  inside `.body`, never its descendant). Consolidated the ≥900px clearance onto `.body` — the one
  element every route's content and the rail both descend from — deleting the per-element
  `main`/`.screen-head` restore rules there; mobile is byte-identical (verified by measurement).
  New `e2e/layout/occlusion-guard.spec.ts` derives its route set from the live tab bar (never a
  hand-copied list) and asserts no painted content sits above the header's real occlusion
  boundary; proved it fails on revert (10/10 desktop cases, exact measured numbers) and passes on
  the fix (20/20, all 5 projects). `pnpm lint` green (5 documented pre-existing ESLint errors
  unchanged, stylelint 0 net new — one `52px` literal removed, one `59px` added, baseline count
  unchanged — ds fidelity 31/31 clean); `npx ng test --watch=false` 603/603 (unchanged); `pnpm
  build` clean (2658 bytes, unchanged). Full local Playwright run: 140 passed (120 baseline + 20
  new), 5 failed (confirmed pre-existing `guest-manager-scrolled-header`, unrelated), 15 skipped
  (pre-existing, unrelated). Report: `reports/T367.json`.
- **ADR:** hub ADR-0043 §1 (the clearance-follows-the-flag defect class — third occurrence),
  ADR-0045 §3/§4
- **Reopens Phase N's exit condition**: "the IA holds" was met by the e2e assertions but not on
  screen. Two owner-reported defects (screenshots, 2026-09-06), both desktop ≥900px:
  1. Guest/couple **Home**: the umbrella pill row (Today · Getting there · Good to know) renders
     partially under the fixed header — top halves of the pills clipped.
  2. **Manage rail**: the rail column starts at viewport top, so its first item (Overview) sits
     behind the fixed header and is unreadable.
- **Root cause (verified by reading `private-layout.scss`, confirm by measuring)**: the fixed
  header's 52px clearance is declared per-element — `main` (restored at ≥900px), `.screen-head` —
  and T364's two new first-elements never got it: `.manage-rail .rail` is a flex *sibling* of
  `main` inside `.body` (main's margin-top does not clear it), and the Home subnav's placement
  relative to the cleared element leaves it underlapping. This is the third strike for
  per-element clearance (guests double-stack was the second, `f7684b5`).
- **Fix direction (implementer decides the exact shape, ADR-0043 in hand)**: prefer moving the
  clearance to the ONE layout element all content descends from (e.g. `.body`), deleting the
  per-element copies, over adding a third and fourth copy — the class exists *because* the
  mechanism is per-element. Whatever shape, `guests` (pinned head inside Manage) must not
  double-stack again, and mobile must stay untouched.
- **Process fix, same task**: add a reusable e2e **occlusion guard** — for every route in
  `NAV_TABS`/`MANAGE_GROUP_TABS`, both roles, both breakpoints: the first visible content
  element's `boundingBox().y` ≥ the fixed header's bottom edge. Playwright's `toBeVisible()`
  cannot see occlusion by a fixed overlay, which is precisely why T363/T364/T366 all passed
  over these two defects.
- **Acceptance:** both screenshots' scenarios render clear of the header (measured, not
  eyeballed); the occlusion guard passes on every route × role × breakpoint and **fails when
  the fix is reverted** (prove it once); `guests` shows no double clearance; layout suite,
  unit tests, lint, build all green.

### T368 — Home umbrella: pixel parity with the DS AppShell spec (owner-reported)
- **Status:** done — `home-subnav.scss` now composes the DS's alignment/rhythm/pill values from
  tokens (`--space-*` + a documented `calc()` half-step for the four sub-grid numbers the token
  scale doesn't name); measured 0px alignment delta and exact 26/18px (desktop) and 10/16px
  (mobile) gaps against the DS kit, plus exact pill color/font-size/weight parity both
  breakpoints. Mobile pill padding (DS `5px 11px`) is a flagged, undone deviation — no token
  fits it and `config-manager`'s own mobile pills already don't chase it either. Countdown
  mixed-language and word-order bugs fixed in es/en/fr (singular included). New
  `e2e/helpers/ds-kit.ts` (reusable kit-serving/toggle-driving) +
  `e2e/layout/design-parity-home.spec.ts` (10/10 passing, all 5 projects); proved it fails on a
  reintroduced defect (`pill row not flush with greeting: expected 0 ±1, got -24`) and passes
  again once undone. `pnpm lint` green (5 documented pre-existing ESLint errors unchanged,
  stylelint 0 new violations — `home-subnav.scss` itself carries 0 — ds fidelity 31/31 clean);
  `npx ng test --watch=false` 603/603 (unchanged); `pnpm build` clean (global stylesheet
  unchanged at 2658 bytes — the touched styles are component-scoped, not global). Full local
  Playwright run: 150 passed, 5 failed (confirmed pre-existing `guest-manager-scrolled-header`),
  15 skipped (pre-existing `seating-plan`, unrelated). Report: `reports/T368.json`.
- **ADR:** hub ADR-0045 §4; ADR-0044 (the DS is the spec); DS `ui_kits/wedding-app/AppShell.jsx`
  lines 40–82 (the authoritative numbers below)
- **Owner-reported, side-by-side screenshots (2026-09-06), desktop:** the implemented Home
  umbrella diverges from the DS in at least three measured ways:
  1. **Alignment**: the pill row hangs at the viewport/gutter left; the DS renders it INSIDE the
     centered `maxWidth: 900` content column (`padding: 26px 28px 44px`), so its left edge is
     flush with the greeting/h1 below it.
  2. **Vertical rhythm**: DS = header → **26px** → pill row → **18px** (`padding: 0 0 18px`) →
     greeting. The implementation is tight under the header with different spacing.
  3. **Backgrounds**: the DS pill row has NO band of its own (page `--bg` shows through);
     unselected pills are `var(--surface)` (white on cream) with a hairline border, selected is
     `var(--accent)` with transparent border; font 12px / 500; padding `6px 14px`; gap 6.
     The implementation's row/pill backgrounds differ.
- **Also on this screen, same standard (fix here):** the invitee countdown heading renders mixed
  language in es — "Nos vemos en 272 days !" — and the progress caption reads "272 días falta"
  (should be "Faltan 272 días"). Untranslated units inside a translated string violate the i18n
  hard rule and the DS voice; check all three locales for the countdown family.
- **The parity harness (the process half — a permanent, committed artifact):**
  `e2e/layout/design-parity-home.spec.ts` that serves the design system's kit
  (`python3 -m http.server` from `../wedding-ui-design`, page
  `ui_kits/wedding-app/index.html`, desktop device + guest role + home view) and the app
  side-by-side, and asserts measured equality (±1px) of: pill-row left edge vs h1 left edge;
  header-bottom→pill-row gap; pill-row→greeting gap; unselected/selected pill computed
  background/border colors; pill font-size/weight/padding. Metric-based, not raw-pixel-diff,
  so it is robust to anti-aliasing. This spec is the template for future screen-parity checks —
  keep the kit-serving + measuring helpers reusable (e.g. `e2e/helpers/ds-kit.ts`).
- **Acceptance:** every measured metric matches the DS values above (report the numbers);
  the parity spec passes and **fails when the fix is reverted** (prove once); occlusion guard,
  layout suite, unit tests, lint, build all green; es/en/fr countdown strings verified
  single-language.

### T369 — Design-parity rescan: every implemented screen measured against the kit (owner-requested)
- **Status:** done — 9 screen pairs measured, both breakpoints. 5 conform exactly and ship
  green (Guest/Home, Couple/Home, Guest/People, Couple/Milestones, Couple/Settings); 4 carry
  recorded deviations under `test.fixme()` (Guest/Schedule: 4, Guest/RSVP: 1, Couple/Manage ·
  Overview: 2 structural, Couple/Guests: 1 mobile-only) — exact kit/app numbers in
  `reports/T369-parity-table.md`. Extended `e2e/helpers/ds-kit.ts` with reusable
  `boxOf`/`stylesOf`/`kitContentColumnBox`/`expectClose` plus the Home-subnav measurers
  (moved from `design-parity-home.spec.ts` so `design-parity-dashboard.spec.ts` could reuse
  them). Found and fixed a real harness bug: `openDsKitScreen` didn't force a real desktop
  viewport on the kit's own page, so the kit's `calc(100vw - 32px)` frame silently shrank
  under the suite's four mobile-emulation projects, producing false width-metric failures —
  fixed by pinning the kit page to 1280×900 when `device: 'Desktop'` is requested. Extended
  two test fixtures (`api-mocks.ts`, allowed): guest RSVP's own-record mock (opt-in
  `rsvpStatus`, since making it unconditional would have redirected every `signInAsGuest`
  caller via `postLoginUrl()`'s pending-RSVP rule) and the previously-empty `agenda.items`
  (mirrored from the kit's `schedule.data.js`). No DS-side (kit-off-grid) findings filed —
  every deviation traced to an existing app token not yet adopted by that screen (`--text-micro`,
  the `--space-*` half-step `calc()` pattern T368 established). `pnpm lint` green (5
  documented pre-existing ESLint errors unchanged, stylelint/ds fidelity clean); `npx ng test
  --watch=false` 603/603 (unchanged); `pnpm build` clean (2658 bytes, unchanged). Full local
  Playwright run, 5 projects: 235 passed, 5 failed (confirmed pre-existing
  `guest-manager-scrolled-header.spec.ts`, unrelated), 50 skipped (35 new `test.fixme()` cases
  + 15 pre-existing `seating-plan` skips). No screen was fixed — the owner triages the
  deviation list. Report: `reports/T369.json`.
- **ADR:** hub ADR-0044 (the DS is the spec; the implementer's "design-fidelity evidence"
  amendment, 2026-09-06); ADR-0045 (five-cap IA, the screens this rescan covers)
- **Context:** T368 fixed Home's own visual defect and built the parity harness
  (`e2e/helpers/ds-kit.ts` + `e2e/layout/design-parity-home.spec.ts`) — every check had been
  green while the screen shipped visually wrong. The owner wants the same harness run against
  every other implemented screen: which ones deviate from the kit the way Home did?
- Screen pairs measured (kit role/view ↔ app path/role), per breakpoint (kit Desktop ↔ app
  1280×900; kit Mobile ↔ app 390×844): Guest/Home ↔ `/me` (guest, extends the existing spec);
  Couple/Home ↔ `/dashboard` (couple); Guest/Schedule ↔ `/schedule` (guest); Guest/RSVP ↔
  `/rsvp` (guest, extends the `GET/POST /v1/rsvp/{guestId}` mock so real content renders —
  known fixture gap, T367 risks[]); Guest/People ↔ `/people` (guest); Couple/"Manage ·
  Overview" ↔ `/overview` (couple); Couple/Guests ↔ `/guests` (couple); Couple/Milestones ↔
  `/milestones` (couple); Couple/Settings ↔ `/config` (couple).
- Per screen: content-column left alignment, header-bottom → first-content gap, content column
  width (vs `../wedding-ui-design/contract/ds-contract.json` `screens[<Screen>].shell.maxWidth`
  where present), page/section background colors, and 2-4 signature elements' computed
  color/font-size/weight/padding.
- **Acceptance:** a `e2e/layout/design-parity-<screen>.spec.ts` per screen pair, committed;
  conforming screens ship green (no `fixme`); deviating screens ship with the deviating
  assertions under `test.fixme()` and the deviation recorded precisely (screen, breakpoint,
  metric, kit value, app value) in the report and `reports/T369-parity-table.md`; DS-side
  off-grid values (the kit itself violates the token grid) are filed in
  `../wedding-ui-design/contract/FINDINGS.md` under Open instead, never reported as an app
  deviation; full parity suite (new + T368's) runs, `pnpm lint`/`npx ng test --watch=false`/
  `pnpm build` all green; no screen is fixed by this task — the owner triages the deviation
  list first.

### T370 — Fix the T369 parity deviations (7 real; 1 refused as out-of-scope)
- **Status:** done — all 7 real deviations fixed, `test.fixme()` flipped to enforced assertions
  (green): Schedule ×4 (header→title gap calc'd to 26px desktop / 12px mobile; note font-size
  11px; status-pill split into a solid final/provisional pair off milestone's dashed default —
  `status-pill.scss`), RSVP guest ×1 (`app-rsvp-create` wraps a new `.card` so `:host` becomes
  the outer 620px `container-sm` column), Overview ×1 (new `.plan-card` milestone-progress card,
  reusing the existing `Milestone` entity collection — no new endpoint), Guests mobile ×1
  (`.header-text` 26px at every breakpoint via `calc(var(--space-6) + var(--space-1) / 2)` — no
  26px type-scale token exists, flagged `wedding-ui-design/contract/FINDINGS.md` Open). Overview's
  "this week" TaskRow list converted to `test.skip()` citing ADR-0029 §4.7 + DS `scope.json`, not
  built. Full parity suite: 125 passed / 5 skipped (the refused one × 5 projects) / 0 failed.
  Occlusion guard: 20/20 green. `pnpm lint`: 5 pre-existing ESLint errors (unchanged), stylelint
  0 new violations. `ng test`: 603/603 (unchanged). `pnpm build`: pass, global stylesheet
  unchanged (2658 bytes — no global `src/styles/` file touched). Report:
  `reports/T370.json`.
- **ADR:** hub ADR-0044 (amended — parity evidence), ADR-0045; T369's table is the spec
- Fix, flipping each `test.fixme()` to an enforced assertion as you go:
  1. **Schedule** (×4): header→title gap to kit 26px desktop / 12px mobile; note font-size 11px;
     status-pill solid fill per the kit (check `status-pill` vs the DS TimelineItem badge spec).
  2. **RSVP guest** (×1): restore the outer 620px content column (`shell.maxWidth` 620 in the
     contract; `container-sm` recipe) around the card.
  3. **Overview** (×1 of 2): add the milestone-progress card (kit `ScreenHome` overview mode —
     reuse the dashboard's existing milestone data/service; no new API).
  4. **Guests mobile** (×1): header title 26px (kit) — check the DS type scale token.
- **Refused, permanent**: Overview's "this week" TaskRow list — out of scope (ADR-0029 §4.7,
  `TaskRow` in DS `contract/scope.json`). Convert that `fixme` to a documented `test.skip` citing
  this line; pixel parity never resurrects a cut feature.
- **Acceptance:** all previously-fixme'd assertions (minus the refused one) enforced and green;
  full parity suite green; occlusion guard green; unit/lint/build green.

### T372 — The couple shares the guest Home; planning lives only in Manage · Overview (owner-reported)
- **Status:** todo
- **ADR:** hub ADR-0045 §2/§3; DS `ScreenHome.jsx` (one screen, two modes)
- **Owner report (2026-09-07):** in the DS, guest and couple see the SAME Home — greeting,
  countdown, day highlights, album; the couple merely drops the RSVP recap
  (`role === 'couple' ? null : rsvpConfirmed`, kit line ~201). Everything couple-specific lives
  behind Manage. The app instead gives the couple the old planning dashboard (RSVP stats, tiles,
  manage cards) AS Home at `/dashboard` — a leftover of T362's interim reading that T364 never
  corrected.
- Fix: `/dashboard` (couple Home) renders the shared umbrella-Home content (same blocks as
  `/me` minus the RSVP recap, plus the umbrella pill row already there); the planning content
  (stats, tiles, milestone card, manage links) renders ONLY under the `overview` flag
  (`/overview`). One component, two modes — exactly the DS shape.
- **Acceptance:** block-outline parity (see T373's harness addition) green for BOTH
  kit-Couple/Home ↔ `/dashboard` and kit-Guest/Home ↔ `/me`; `/overview` keeps its parity;
  nav/e2e suites green.

### T373 — Overview layout: the kit's 1.15/0.85 grid, milestone card top-right + block-outline parity (owner-reported)
- **Status:** todo
- **ADR:** hub ADR-0044 (amended), ADR-0045 §3; DS `ScreenHome.jsx` overviewContent (~line 171)
- **Owner report:** the milestone resume is not where the kit puts it. Kit truth: a
  `1.15fr 0.85fr` grid (gap 22, align start) — LEFT column [rsvpStats, tiles], RIGHT column
  [milestoneProgress, week]. T370 appended the card into a single-column flow instead. ("week"
  is the out-of-scope TaskRow block — its slot stays empty, per the T370 refusal.)
- **Harness addition (the process half):** `e2e/helpers/ds-kit.ts` gains a `blockOutline()`
  helper — the ordered list of a screen's content blocks with their grid/column position —
  measured identically on kit and app; every design-parity spec adds a block-outline assertion.
  This is the check whose absence let generic metrics say "match" across structurally different
  screens (T369 compared kit-couple-Home to the planning dashboard and passed).
- **Acceptance:** Overview matches the kit's grid and block order (measured); block-outline
  assertions added to all 9 parity specs and green (T372's home fix is a prerequisite for the
  two Home outlines); suite green.

### T374 — Guest manager: sticky filter toolbar (BLOCKED: cloud pull first)
- **Status:** blocked — the local kit has NO sticky filters; the cloud DS (owner's edits) is
  ahead of local and unpulled. Requires `/design-login`, then ds-sync pull + audit; the pulled
  kit change defines the spec (and the parity spec then asserts computed `position: sticky` +
  scroll behaviour — the second check class T369's metrics never covered).
- **ADR:** hub ADR-0044 (ds-sync pull-before-work discipline)
