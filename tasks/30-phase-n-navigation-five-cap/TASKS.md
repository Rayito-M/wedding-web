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
- **Status:** todo
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
