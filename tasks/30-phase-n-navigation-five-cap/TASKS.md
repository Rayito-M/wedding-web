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
- **Status:** todo
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
- **Status:** todo
- **ADR:** hub ADR-0045 (constraints)
- `nav.manage`, `home.today`, `home.gettingThere`, `home.goodToKnow`, `manage.backToApp` (+ any
  T361-T364 strings) in es/en/fr, es first (product default). Sentence case, no title case.
- **Acceptance:** no missing-key warnings in any locale; translations reviewed against the DS
  voice ("warm, personal" — readme Content fundamentals).

### T366 — E2E: the IA holds and nothing regressed
- **Status:** todo
- **ADR:** hub ADR-0045 §Consequences
- Playwright: per-role nav renders ≤5 with active state; Manage in/out (rail + mobile tabs +
  back exit); `/travel` redirect; every pre-existing journey (RSVP, schedule, guests,
  milestones, settings) passes unchanged.
- **Acceptance:** suite green in CI conditions; then stamp the six ledger items `implemented`
  and re-run `node ../wedding-ui-design/tools/audit.mjs` — board shows 0 outdated, 0 queued
  from this feature.
