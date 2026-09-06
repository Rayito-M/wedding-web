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
- **Status:** todo
- **ADR:** hub ADR-0045 §3; ADR-0044 (mirror discipline)
- DS source `components/navigation/PlanRail.{jsx,d.ts,prompt.md}`: numbered rail items with
  active dot, per-item meta (e.g. "142 / 172"), Settings pinned to the rail foot with its seven
  sections nested beneath it, section Save moving into the section header
  (`ScreenConfigManager` controlled mode is T364's half).
- New `src/app/shared/plan-rail/` mirror; register in `design-mirror.json` (`pnpm ds:mirror`).
- **Acceptance:** component renders the DS anatomy (verify against the kit's Manage views);
  `pnpm lint` (incl. ds fidelity) green; unit spec for section nesting + active state.

### T362 — Route data carries the five-cap surfaces and the Manage group
- **Status:** todo
- **ADR:** hub ADR-0045 §1/§2/§6; ADR-0042 §6 (nav derives from route data)
- `RouteChromeData` gains `group?: 'manage'` and `standout?: true`; `NAV_ORDER`/`nav-tabs.ts`
  produce per-role surfaces filtered by enablement: guest Home · Schedule · RSVP · People;
  couple Home · Schedule · People · Manage(standout). Manage children: Overview(=dashboard) ·
  Guests · Milestones · Settings. Album/Seating stay dark (guard already routes them out).
- **Acceptance:** `nav-tabs.spec` covers both roles and the ≤5 cap; no role's set overflows
  TabBar's More sheet; a route rename cannot resurrect the old flat list (walk the tree, no
  hand-copied links — ADR-0042 §6 stands).

### T363 — Header and tab bar learn the standout item
- **Status:** todo
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
