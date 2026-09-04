## Phase — Visual-refresh re-baseline to DS `90246bd` (2026-07-31)

> New tasks created by the `b816c12` → `90246bd` re-baseline (rationale + full change list in the
> phase preamble above). Unlike T219–T234, these are **not all visual-only**: the AppShell/nav model
> and the Home merge are structural. Each task states exactly where it crosses the visual-only line so
> the user can decide before any `.ts`/behavior/data-shape change is made. Standing hard rules
> (tokens-only styling, shared-component reuse, mobile-first, WCAG AA, three-theme check,
> `pnpm typecheck && pnpm lint && pnpm build` green) apply to all.

### T235 — Re-baseline the private shell to the rewritten `AppShell` (nav model + desktop chrome)
- **Status:** done (2026-07-31) — **nav-model fully landed.**
  `nav-tabs.ts` reordered to the DS AppShell order (`home, rsvp, schedule, album, travel, people,
  guests, seating, config`) and guest/couple `home` unified to a single `home` id (guest → `/me`,
  couple → `/dashboard`); `/dashboard` route `data.tab` → `home`. `seating` tab+route landed (T229;
  `path: 'seating'` in `app.routes.ts` + `seating` entry with `roles: ['groom','bride']` in
  `nav-tabs.ts`, plus `nav.seating`/`titles.seating` i18n in all three locales — done ad hoc at
  explicit user request, outside this task's own diff pass, but tracked here). **Update
  (2026-07-31, `people` tab+route landed):** now that T237 shipped the People screen, `people` entry
  added to `NAV_TABS` (`{ id: 'people', labelKey: 'nav.people', link: '/people' }`, no `roles`
  restriction — matches DS, visible to both roles) and `path: 'people'` registered in
  `app.routes.ts` (`data: { tab: 'people', tabBar: true, topNav: true }`) — done ad hoc alongside the
  `/profile` route wiring at explicit user request, tracked here as it resolves this task's FLAG
  item 1. This closes the nav-model FLAG entirely: `home`/`seating`/`people` all wired, matching the
  full rewritten `AppShell` nav list. Desktop-chrome diff against the rewritten `AppHeader`/`TabBar`
  completed and pure token/spacing/typography drift re-applied: `screen-header.scss` nav `flex:1` fix
  (left-align vs. centered), desktop header padding/gap (`13px 28px`/`26px` matching DS `wide`, also
  now consistent with the pre-existing `main { margin-top: 52px }` chrome-height assumption),
  nav-link padding/font-size/letter-spacing/dot sizing brought in line with `AppHeader.jsx`, and
  `tab-bar.scss` `:host` padding (`10px 4px 14px`, was `6px`) + tab letter-spacing (`0.02em`, was
  `0.04em`) fixed. Per-screen `maxWidth` reconciliation done for every screen listed in the
  acceptance table: Schedule's desktop `max-width` corrected `560px` → `620px` (`schedule.scss`; DS
  `ScreenSchedule.jsx`'s `wide` fragment has no inner max-width wrapper, so the full `AppShell
  maxWidth={620}` is the visible width, unlike RSVP which wraps at an inner 560 — see acceptance
  note); Home/Album/Travel/RSVP already correct (T220/T225/T227, no change); People (`980px`) and
  Profile (`860px`) confirmed already correct as scaffolded by T237/T238 (no change needed) now that
  those screens exist.
  **Remaining (explicit follow-ups, not blocking this task's completion):** the mobile `TabBar`
  "More" overflow sheet remains **unbuilt** — couple nav is now at 8 destinations (home, schedule,
  album, travel, people, guests, seating, config; guest nav is 6: home, rsvp, schedule, album,
  travel, people), past the DS `TabBar`'s effective 5-tab-before-overflow capacity. Per FLAG item 2
  below, building the sheet was explicitly out of scope for this task (new markup + new local
  open/close state); couple's bottom tab bar renders all 8 entries un-overflowed until that
  follow-up lands — tracked as a new task, not reopening T235. Mock status bar intentionally not
  replicated (flagged below, confirmed non-issue). Account-dropdown "My profile" row wiring —
  explicitly out of scope for this task's own acceptance (depended on T238) — has since been wired
  ad hoc alongside the `/profile` route, at explicit user request, outside this task's diff pass.
  Per-user WIP: the route-enable force-hacks in `route-enabled.guard.ts` /
  `route-config.service.ts` are the user's and were left untouched.
- **Owner:** agent (implementer)
- **Depends on:** T230 (predecessor; T235 supersedes its stale AppShell scope note)
- **Acceptance:**
  - Diff the web shell (`layouts/private-layout/`, `shared/screen-header/`, `shared/tab-bar/`) against
    the **rewritten** `AppShell.jsx` + `components/navigation/{AppHeader,TabBar}.jsx` at `90246bd`.
    Re-apply any pure token/spacing/typography drift (visual-only, in scope, no decision needed).
  - **Per-screen `maxWidth` reconciliation (visual-only):** the new AppShell sets a per-screen content
    `maxWidth` (Home 900, Album 880, Travel 880, Schedule 620, RSVP 620, People 980, Profile 860). In
    this repo that width lives in each screen's SCSS; confirm each screen's desktop `max-width` matches
    its DS value and correct any that drifted. (Album 880 and Travel 880 already tracked by T220/T227.)
  - **FLAG — NOT visual-only, needs user decision before building (do not silently introduce):**
    1. **Nav model change — mostly landed, `people` still outstanding.** `home` is now unified
       (guest `/me` / couple `/dashboard` under one `home` id) and `seating` is now wired (T229
       landed). Only `people` remains unwired — it **has no screen in this repo** (needs T237).
       Recommend sequencing: land T237, then add `people` to `NAV_TABS` + routing.
    2. **`TabBar` "More" overflow sheet.** The couple role is now at 7 nav destinations (home,
       schedule, album, travel, guests, seating, config) — past the DS `TabBar`'s effective
       5-tab-before-overflow capacity (`maxTabs=4`, overflow once `items.length > 5`). This is no
       longer a speculative future condition — it's real today, and will grow to 8 once `people`
       lands. This repo's `tab-bar` has no overflow UI; building it is new markup **and** new local
       state (open/close) — flag as a follow-up to land now (or with `people`/T237 at the latest).
    3. **Mock status bar.** The DS mobile shell renders a `9:41 ●●●●` status bar — a prototype artifact.
       Do **not** replicate it. (Confirmed not present in this repo's shell.)
  - **Explicitly out of scope:** account-dropdown "My profile" row wiring (depends on T238), and any
    real data behind nav badges/counts.
  - `pnpm typecheck && pnpm lint && pnpm build` green; shell verified in all three themes, mobile +
    desktop.
- **Refs:** DS `ui_kits/wedding-app/AppShell.jsx` (rewritten `90246bd`),
  `components/navigation/{AppHeader,TabBar}.jsx`; files: `src/app/layouts/private-layout/`,
  `src/app/shared/screen-header/`, `src/app/shared/tab-bar/`, `src/app/shared/nav-tabs.ts` (flag-only).

### T236 — Role-driven Home: reconcile `dashboard` + `invitee` against the unified `ScreenHome`
- **Status:** done (Option A, visual-only, 2026-07-31) — deferred behavior follow-ups flagged below
  (Manage-nav wiring + missing `seating` route/screen; guest highlights `|| true` stub; both out of
  visual scope). Guest seat/menu **stub** tiles (hardcoded `notAssigned`) removed to match `ScreenHome`.
- **Owner:** agent (implementer)
- **Depends on:** T235's *visual* token/`maxWidth` reconciliation only (Option A does not touch the
  nav model, so it is NOT blocked on T235's flagged nav-model decision). Supersedes T222 + T224.
- **DECISION (2026-07-31):** user chose **Option A** below. Implement the visual-only path: align
  `screens/dashboard/` (couple) and `screens/invitee/` (guest) each to the matching role blocks of
  `ScreenHome.jsx`, keeping both as separate components. Do **not** merge, and do **not** change
  `.ts`/data wiring — flag (don't introduce) anything that would require it.
- **Open decision (RESOLVED — Option A chosen; Option B not taken):**
  `ScreenHome.jsx` is ONE role-driven component. This repo has two components with **divergent
  `.ts`/data wiring**: `screens/dashboard/` (couple; mock `DashboardService`; `HeaderService` label)
  and `screens/invitee/` (guest; real `@ngrx/data` entity collections — `UserProfileDto`, `RsvpDto`,
  `WeddingConfigResponseDto`; live countdown/RSVP computeds). Two paths:
  - **Option A — keep two components, align each visually (recommended for this phase).** Stays inside
    the visual-only constraint: no `.ts`/data change. `screens/dashboard/` is aligned to the couple
    blocks of `ScreenHome.jsx`; `screens/invitee/` to the guest blocks. Routes/nav can still expose a
    single `home` tab per role. Lowest risk; defers the structural merge.
  - **Option B — physically merge into one `screens/home/` component.** Matches the DS 1:1 but is a
    real behavior/data-shape refactor (unify the two data sources behind one component, `role`-switch
    the content blocks) — **outside** the visual-only phase; warrants an in-repo ADR (proposed
    `W-0002`) recording the merge and its data wiring, authored once the user chooses this path.
- **Acceptance (applies under EITHER option; the merge structure differs):**
  - **Couple blocks** match `ScreenHome.jsx` (lines 31–81): greeting; `rsvpStats` card with the single
    flipped `FishIllustration` only (confirming T222's change); `StatTile` pair (Budget/Vendors); the
    "Manage" link list (Guest manager / Seating plan / General config); "This week" `TaskRow` list.
  - **Guest blocks** match `ScreenHome.jsx` (lines 83–123): countdown card; `rsvpConfirmed` card with
    **no emoji** (absorbs T224); `highlights` list built from `app-timeline-item` (absorbs T224); the
    album row. Preserve the existing `invitee` i18n/`translate` wiring where copy still matches.
  - Both mobile and desktop (`wide`) branches implemented per the DS single-column (mobile) /
    two-column grid (desktop) layouts.
  - Under Option A: **no `.ts`/data-shape change** (visual-only). Under Option B: `.ts` changes are
    expected and gated on the in-repo ADR + explicit user go-ahead.
  - `pnpm typecheck && pnpm lint && pnpm build` green; all three themes, mobile + desktop.
- **CSS-hygiene follow-up (2026-08-01, css-auditor finding A2):** because Option A kept `dashboard`
  and `invitee` as **two** components, their SCSS is now a confirmed near-clone (`.greeting`/`.hello`/
  `.accent`/`.content`/`.deco-fish` block families, some byte-identical, some diverged — `.deco-fish`
  position/opacity differs across `dashboard`/`invitee`/`profile`). That duplication is **not** a defect
  of this (done) visual-only task; it is dispositioned to **T247** (shared-block consolidation), which is
  compatible with a future Option B merge (the merge would simply absorb the shared partial). The raw-role
  token cleanup inside these two files is handled first by **T243**.
- **Refs:** DS `ui_kits/wedding-app/ScreenHome.jsx` (`90246bd`, replaces legacy `ScreenDashboard.jsx`
  + `ScreenInviteeDashboard.jsx`); files: `src/app/screens/dashboard/`, `src/app/screens/invitee/`
  (Option A) or new `src/app/screens/home/` (Option B); supersedes T222 (couple) + T224 (guest).

### T237 — Scaffold new People (guest directory) screen (presentational only)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T235
- **Acceptance:**
  - `ScreenPeople.jsx` is a **brand-new** screen with no implementation in this repo. Following the
    T229 (Seating plan) precedent, scaffold a purely **presentational** standalone component
    (`src/app/screens/people/people.ts` / `.html` / `.scss`, `app-people` selector) reproducing the
    reference's mobile (single-column card list) and desktop (`wide`: header + right-aligned search
    controls, then a `repeat(auto-fill,minmax(280px,1fr))` `ProfileCard` grid at `maxWidth 980`).
  - Reuse `app-profile-card`-equivalent shared component if one exists; if not, hand-build the card
    and the search-pill/filter-chip controls from `_tokens.scss` custom properties only (same
    precedent as `config-manager`'s hand-built controls). Reuse `app-input` if present.
  - **Static/placeholder data only** hardcoded in the component (mirroring a subset of the reference's
    `WEDDING_PEOPLE` shape) purely to render the static markup — no `HttpClient`, no facade/service,
    no `EntityCollectionService`. Search/filter may use local signals **only** insofar as needed to
    show the reference's visual states.
  - **All visible copy is static hardcoded literal text** (100%-new screen, no existing i18n to
    preserve); real i18n deferred.
  - **Explicitly out of scope, do not do:** no route registration, no `NAV_TABS`/nav entry, no real
    data/service integration — scaffold only. Wiring `people` into nav + real data is a separate
    follow-up gated on the API/contract side existing.
  - `pnpm typecheck && pnpm lint && pnpm build` green; all three themes, mobile + desktop.
- **Refs:** DS `ui_kits/wedding-app/ScreenPeople.jsx` (`90246bd`); new files:
  `src/app/screens/people/`.

### T238 — Scaffold new Profile (own profile) screen (presentational only)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T235
- **Acceptance:**
  - `ScreenProfile.jsx` is a **brand-new** screen (reached from the account dropdown, never the tab
    bar) with no implementation in this repo. Scaffold a purely **presentational** standalone
    component (`src/app/screens/profile/profile.ts` / `.html` / `.scss`, `app-profile` selector)
    reproducing the reference's identity card (avatar + name + role/relation pills + flipped
    `FishIllustration`), the editable-looking field list (name/email/phone via `app-input`), the
    language selector, and its view/edit/saved visual states, in both mobile and desktop (`wide`,
    `maxWidth 860`) layouts.
  - **Static/placeholder data only** hardcoded in the component (mirroring the reference's `me` /
    `WEDDING_PEOPLE` shape) — no `HttpClient`, no facade/service, no real save. Edit/save may use local
    signals only insofar as needed to render the reference's visual states.
  - **All visible copy is static hardcoded literal text**; real i18n deferred.
  - **Explicitly out of scope, do not do:** no route (`/profile`), no account-dropdown "My profile"
    link wiring (that link, flagged in T230 and T234 as a dead link with no target, becomes buildable
    only once this screen + its route land — a separate follow-up), no `UserProfileDto`/API
    integration.
  - `pnpm typecheck && pnpm lint && pnpm build` green; all three themes, mobile + desktop.
- **Refs:** DS `ui_kits/wedding-app/ScreenProfile.jsx` (`90246bd`); new files:
  `src/app/screens/profile/`. Unblocks the "My profile" dropdown link deferred by T230 / T234.

### T239 — Schedule status: item status + overall provisional/final, guest home + schedule + config
- **Status:** done (2026-07-31) — `shared/timeline-item` gained `status`/`showStatus` inputs (dot/
  badge/strikethrough driven by `[attr.data-status]` + a `--row-status-color` custom property, no
  inline styles); guest home and the schedule screen now read `weddingConfig().agenda.status` for a
  hand-built Final/Provisional pill (no equivalent DS shared component, same precedent as the
  hotel-price-tier segmented control); the schedule screen was migrated off static
  `schedule.timeline` i18n onto the same `WEDDING_CONFIG` `EntityCollectionService` signal as
  `invitee`/`config-manager` (title/subtitle/header date left as static i18n, per scope); config
  manager's agenda section got a per-item status segmented control (`setAgendaStatus(id, status)`)
  and an overall "Schedule status" toggle (`setScheduleStatus`, local state only, no `PATCH`
  wiring, per existing doc comment). `--status-confirmed/planned/cancelled` mirrored into
  `_tokens.scss`. New keys added to `es/en/fr.json` (`shared.agendaStatus.*`,
  `shared.scheduleStatus.*`, `schedule.status.final`, `schedule.note.*`,
  `invitee.schedule.provisionalNote`, `configManager.field.status`,
  `configManager.agenda.scheduleStatus*`). `pnpm typecheck`/`lint`/`build` verified green in an
  isolated copy of the tree (the live tree has unrelated concurrent WIP in `people.ts` breaking
  `pnpm typecheck` — confirmed pre-existing/unrelated, not touched by this task).
- **Owner:** agent (implementer)
- **Depends on:** T219, T224, T226
- **Context:** DS update adds a `status` concept to the schedule: each agenda item is
  `planned | confirmed | cancelled`, and the schedule as a whole is `provisional | final`
  (`agenda.status`). The generated API client already carries both — see
  `CreateWeddingConfigDtoAgendaItemsInner.status` and `CreateWeddingConfigDtoAgenda.status`
  (`src/app/core/api/model/`) — so this is a display/consumption task, not a contract change.
  `--status-confirmed` / `--status-planned` / `--status-cancelled` tokens already exist
  (`tokens/colors.css`); confirm they're mirrored in `src/styles/_tokens.scss` (add them under the
  existing semantic-alias block if missing, no invented colors).
- **Acceptance:**
  - **`shared/timeline-item`:** add `status` (`'planned' | 'confirmed' | 'cancelled'`, default
    `'confirmed'`) and `showStatus` (default `true`) inputs, per DS
    `components/data-display/TimelineItem.jsx` + `.prompt.md`: solid accent dot for `confirmed`
    (no badge); hollow dot + dashed connector + uppercase outline badge for `planned`; struck-through
    time/title + dimmed (opacity) row + badge for `cancelled`. Dot/badge/time color comes from the
    `--status-*` token for the row's status. `showStatus=false` suppresses the badge only (dot/strike
    behavior unchanged) — used where a whole schedule is provisional and every row would otherwise
    show "Planned".
  - **Guest home (`screens/invitee/`):** already wired to real `weddingConfig().agenda.items` (see
    current uncommitted `invitee.ts`/`.html`) — pass each item's `status` into `app-timeline-item`.
    Add the status pill next to the "The day · highlights" label (Final = solid accent pill; else
    outline "Provisional" pill, dashed border) and, when not final, the small sub-line "Times may
    still shift until the schedule is final." — matches `ScreenHome.jsx` `schedulePill` +
    `highlights` block (~lines 20–25, 110–119). Final/provisional comes from
    `weddingConfig().agenda.status`.
  - **Schedule screen (`screens/schedule/`):** currently sources rows from static i18n
    `schedule.timeline` (no `id`/`status`) — migrate to the same `EntityCollectionService`-backed
    `weddingConfig()` signal already used by `invitee`/`config-manager` (`WEDDING_CONFIG` entity),
    reading `agenda.items` (id/time/title/desc per current language, matching `getEventTranslation`
    in `invitee.ts`) and `agenda.status`. Keep `schedule.title`/`schedule.subtitle`/header date as
    static i18n (unchanged). Add the status pill ("Final schedule" / "Provisional") and the note row
    with per-status counts, matching `ScreenSchedule.jsx`'s `statusPill` + `note` (confirmed/planned/
    cancelled counts; cancelled count only shown when > 0).
  - **Config manager agenda section (`screens/config-manager/`, `section === 'agenda'`):** add a
    per-item status control — three segmented buttons (Planned/Confirmed/Cancelled), each using its
    own `--status-*` token when selected — wired to `setAgendaStatus(id, status)` (new method,
    mirrors the existing `setAgendaTime`/`setAgendaVenue` pattern). Add an overall "Schedule status"
    segmented toggle (Provisional/Final) bound to `cfg().agenda.status` (new `setAgendaStatus`-level
    method or extend `setBasics`-style setter for the agenda root). Matches `ScreenConfigManager.jsx`
    `ITEM_STATUSES` + the "Schedule status" toggle (~lines 59, 199–227). Cancelled items keep the
    existing dimmed-card treatment (`opacity: a.status === 'cancelled' ? 0.65 : 1`).
  - **i18n:** add new keys (status labels, the two note strings, the guest-home pill note) in all
    three files (`public/i18n/es.json`, `en.json`, `fr.json`), following each section's existing key
    style — no hardcoded copy in templates (Hard Rule #8).
  - **Explicitly out of scope:** no `PATCH /v1/config` wiring for the new agenda-status edits (Save
    stays local-state-only, matching the rest of `config-manager` per its existing doc comment) — this
    task is view + edit-state only, not persistence.
  - `pnpm typecheck && pnpm lint && pnpm build` green; verify all three themes, mobile + desktop, and
    all three statuses (including a cancelled row and a provisional vs. final schedule) actually
    render as described above — not just typecheck-green.
- **Refs:** DS `components/data-display/TimelineItem.jsx`/`.d.ts`/`.prompt.md`,
  `ui_kits/wedding-app/ScreenHome.jsx`, `ScreenSchedule.jsx`, `ScreenConfigManager.jsx` /
  `ScreenConfigManagerMobile.jsx`; files: `src/app/shared/timeline-item/`, `src/app/screens/invitee/`,
  `src/app/screens/schedule/`, `src/app/screens/config-manager/`.

### T240 — Config manager: missing "The couple" section
- **Status:** done (2026-08-01) — added `'couple'` to `SectionId`/`SECTIONS` (second, after
  `basics`), renumbered venues→03, agenda→04, hotels→05, dietary→06, appearance→07. New local
  `couple` signal (`CoupleAccount[]`, not part of `cfg`/the API client — no `couple` field exists on
  `WeddingConfigResponseDto`), seeded from a `buildCoupleSeed()` fixture mirroring the reference's
  `c1`/`c2` (same local-fixture precedent as `profile.ts`'s `ME_SEED`). New setters `setPerson`/
  `addPerson`/`removePerson` plus `sendCoupleInvite`/`toggleCoupleStatus` action wrappers (all
  `dirty.set(true)` on mutation, matching every other section's setters); dynamically-generated
  "last seen" copy (sign-in link sent, invite sent, invitation pending, just now, never signed in)
  goes through `translateService.instant(...)` (same pattern already used for `HeaderService.set`
  in this file's constructor) — the seeded fixture's own `lastSeen` text ("Today, 09:12" etc.) stays
  literal fixture content, consistent with `ME_SEED`. Section content matches
  `ScreenConfigManager.jsx` lines 179-232: per-role card (avatar-with-initials, name + last-seen,
  active/invited status pill, first/last name + email/phone fields, Owner/Editor/Viewer segmented
  access reusing the existing generic `.segment`/`.segment.on` styling, and a bordered actions row
  — send sign-in link/resend invitation, suspend/reactivate, delete) plus a dashed empty-state card
  ("No account yet…", "Create {role} account") when a role's slot is unset. New CSS is scoped to the
  couple section only (`.couple-*` classes, `.grid-14fr-1fr`) and reuses existing `.card`/`.field`/
  `.card-list`/`.field-label` rather than duplicating them. i18n: added `configManager.section.couple`
  + `configManager.note.couple` to the existing maps, plus a new `configManager.couple.*` namespace
  (role/status/field/access/action/lastSeen labels) in all three locale files — no hardcoded copy in
  the template. Out of scope, as specified: no `PATCH`/API wiring, no separate mobile-only template
  (fits the existing single-template + SCSS breakpoint pattern). `pnpm typecheck && pnpm lint && pnpm
  build` all green (confirmed the 5 pre-existing lint errors in `login.ts`/`shared/modal/` and the
  `config-manager.scss`/`guest-manager.scss` budget warnings predate this change, via `git stash`
  diff). Live interactive verification in a running browser (dev server) was not completed — the
  local `wedding-api` dev environment was shared with other concurrent agent sessions at the time,
  and reaching `/config` requires a full admin SMS-OTP sign-in round trip; verification instead
  relied on structural line-by-line comparison against the DS reference JSX and reuse of CSS classes
  already shipped and visually confirmed in this same screen's other sections. Recommend a follow-up
  manual pass (three themes, mobile+desktop) before this ships to guests.
- **Owner:** agent (implementer)
- **Depends on:** T219, T221
- **Context:** DS reference `ScreenConfigManager.jsx` defines 7 sections (`SECTIONS`, lines 54-62):
  `basics` (01), `couple` (02), `venues` (03), `agenda` (04), `hotels` (05), `dietary` (06),
  `appearance` (07). The implemented screen (`src/app/screens/config-manager/config-manager.ts`,
  `SectionId`) only has 6 — `couple` was never built and every section after it is numbered one
  short of the reference. T221 (visual polish pass) explicitly kept `.ts` section-switching logic
  untouched, so this gap was never in scope until now. There is no `couple` field anywhere on the
  generated API client (`WeddingConfigResponseDto` / `CreateWeddingConfigDto*`) — like the rest of
  `config-manager` (no live `PATCH /v1/config` yet), this section is UI-only, local component state;
  do not invent an API shape. Follow the same seed-fixture-as-local-state precedent as
  `screens/profile/profile.ts`'s `ME_SEED`.
- **Acceptance:**
  - New `'couple'` entry added to `SectionId` and `SECTIONS`, positioned second (after `basics`,
    before `venues`), per `ui_kits/wedding-app/ScreenConfigManager.jsx` lines 54-62. Renumber the
    existing `number` field on every later section to match the reference (venues 02→03, agenda
    03→04, hotels 04→05, dietary 05→06, appearance 06→07).
  - New local signal holding two slots (`bride`, `groom`), each either unset or
    `{ firstName, lastName, email, phone, access: 'owner' | 'editor' | 'viewer', status: 'active' | 'invited', lastSeen }`
    — mirrors the reference `SEED.couple` shape (lines 11-14). Seed both slots populated (matching
    the reference `c1`/`c2` fixture), consistent with how `config-manager.ts` already seeds `cfg`.
  - Section content matches `ScreenConfigManager.jsx` lines 179-232: section header + note ("The two
    accounts that own this wedding. They sign in, edit everything and receive guest replies.");
    per-role (bride/groom) card with initials avatar, name + last-seen line, active/invited status
    pill, editable first name/last name/email/phone fields, a 3-way Owner/Editor/Viewer segmented
    access control, and a row of actions: send sign-in link (invited) / resend invitation (active) —
    reference has this inverted, verify against the actual JSX not this summary; suspend/reactivate
    access; delete account. Empty state (no account yet for a role): dashed card, "No account yet ·
    this half of the couple cannot sign in", "Create {role} account" button.
  - New setter methods on `ConfigManager` mirroring the existing `setPerson`/`addPerson`/`rmPerson`
    naming from the reference (adapted to this codebase's signal-update style, e.g.
    `cfg.update(...)` or a dedicated `couple` signal — implementer's call, follow the pattern already
    used by `setAgendaTime`/`setAgendaVenue` etc. in this file) — all local state, `dirty.set(true)`
    on every mutation, exactly like every other section's setters.
  - i18n: add `configManager.section.couple` and `configManager.note.couple` (all 3 section-label/
    note maps already have every other section — add the missing key, do not restructure), plus a
    new `configManager.couple.*` namespace for field labels, access levels, status pill text, and
    action button copy, in all three files (`public/i18n/es.json`, `en.json`, `fr.json`). No
    hardcoded copy in the template (Hard Rule #8).
  - **Explicitly out of scope:** no `PATCH`/API wiring (matches the rest of the screen); no
    `ScreenConfigManagerMobile.jsx`-specific layout fork — this codebase already unifies mobile/
    desktop per-screen via SCSS (see T219 re-baseline note), so fit the couple section into that same
    one-template pattern, not a separate mobile file.
  - `pnpm typecheck && pnpm lint && pnpm build` green; verify manually (dev server) that the couple
    section renders, the section rail numbering is consistent end-to-end, and editing/access/status/
    delete/empty-state all visually work, in all three themes, mobile + desktop.
- **Refs:** DS `ui_kits/wedding-app/ScreenConfigManager.jsx` (lines 11-14, 54-62, 179-232); files:
  `src/app/screens/config-manager/`, `public/i18n/{es,en,fr}.json`.
