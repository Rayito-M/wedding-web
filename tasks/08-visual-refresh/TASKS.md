## Phase — Visual refresh (DS update; re-baselined 2026-07-31 to commit `90246bd`)

> **RE-BASELINE (2026-07-31) — DS commit `b816c12` → `90246bd` (2026-07-30). Supersedes the
> `b816c12` baseline preamble further below, which is retained for history.**
>
> The design system advanced from `b816c12` (2026-07-27) to `90246bd` (2026-07-30) and changed the
> model substantially. Verified against `../wedding-ui-design/ui_kits/wedding-app/`:
>
> 1. **Every screen now has a mobile AND a desktop version**, selected by a `wide` prop / device
>    toggle (`ui_kits/wedding-app/README.md`, `AppShell.jsx`). In this repo the equivalent is a single
>    component per screen with responsive CSS: the mobile layout is the base and the desktop layout is
>    the `@media (min-width: 900px)` branch (existing convention). "Add mobile + desktop per screen"
>    here means: for each screen, make **both** branches match the corresponding DS layout — it does
>    **not** mean splitting into two components. (The DS uses separate `*Mobile.jsx` companions only
>    for `ConfigManager`, `GuestManager`, and `SeatingPlan`; all other screens branch on `wide` in one
>    file. Mirror that: one Angular component per screen, two CSS branches.)
>
> 2. **`AppShell.jsx` was REWRITTEN in `90246bd`** (it was NOT "unchanged", contrary to the now-stale
>    scope note in T230). New nav model: `NAV_BASE = [home, rsvp, schedule, album, travel, people]`
>    plus couple-only `[guests, seating, config]`. Consequences: (a) the couple role now has **9** nav
>    destinations → the `TabBar` "More" overflow sheet (previously flagged as speculative in T230) is
>    now a **real** condition; (b) `people` and `seating` are new destinations with no screen in this
>    repo yet; (c) the mobile shell shows a **mock status bar** (`9:41 ●●●●`) — that is a DS-prototype
>    artifact, do **not** replicate it. The web's `AppShell` analogue is `PrivateLayout` +
>    `shared/screen-header` + `shared/tab-bar`; those files carry this change, not the per-screen files.
>
> 3. **`ScreenHome.jsx` (new) is ONE role-driven screen for both roles** (`role='couple'|'guest'`,
>    `wide` for desktop). It **replaces the now-legacy `ScreenDashboard.jsx` and
>    `ScreenInviteeDashboard.jsx`** (both last touched at `b816c12`). This repo still has two separate
>    components — `screens/dashboard/` (couple, mock `DashboardService`) and `screens/invitee/` (guest,
>    real `@ngrx/data` entity collections) — with **divergent `.ts`/data wiring**. Whether to physically
>    merge them into one `home` component or keep them separate and only align each visually is a
>    **decision the user must make** (see **T236**): a physical merge is a behavior/data-shape change and
>    is therefore **outside** this phase's visual-only constraint.
>
> 4. **Screens refactored to the new AppShell integration pattern in `90246bd`:** Home (new), Album,
>    RSVP, Schedule, Travel, People (new), Profile (new) — each now wraps `AppShell` with a per-screen
>    `maxWidth` (Home 900, Album 880, Travel 880, Schedule 620, RSVP 620, People 980, Profile 860). In
>    this repo the shell wrapping lives in `PrivateLayout`, so per-screen work is just the content +
>    each screen's own `max-width` in SCSS. The existing per-screen tasks (T220/T223/T225/T226/T227)
>    stay valid; their DS refs are re-pinned to `90246bd` and the worked example of the new pattern is
>    `ScreenTravel.jsx` (verified: two-column desktop at `maxWidth 880`, `ALBAICÍN · GRANADA` eyebrow,
>    ground motorcycle on mobile — matches T227 as written).
>
> 5. **New screens with no implementation in this repo:** `ScreenPeople.jsx` (guest directory) and
>    `ScreenProfile.jsx` (own profile, reached from the account dropdown, never the tab bar). Scaffold
>    tasks added as **T237 / T238** (presentational-only, following the T229 SeatingPlan precedent —
>    no route/nav/data wiring, flagged as follow-up).
>
> **Task status under the new baseline (see per-task notes for detail):**
> - **T219, T230, T231, T232, T233, T234** — token sync, illustration fixes, login, header nav: still
>   valid; T230 gets a revision note (its AppShell "unchanged" scope claim is now false).
> - **T220, T223, T225, T226, T227** — per-screen Album/GuestManager/RSVP/Schedule/Travel: still valid;
>   DS refs re-pinned to `90246bd`; the "mobile + desktop per screen" clarification above applies.
> - **T221** (config-manager) — done under `b816c12`; add a re-verify-against-`90246bd` follow-up.
> - **T222** (dashboard) — done, but its ref (`ScreenDashboard.jsx`) is now **legacy**; the specific
>   change it made (drop DecorSun/DecorWave, keep the flipped FishIllustration on the couple stats
>   card) is **confirmed still-correct** in the new `ScreenHome.jsx` couple `rsvpStats` block. Folded
>   into T236's couple-role scope going forward.
> - **T224** (invitee) — **SUPERSEDED**: its ref (`ScreenInviteeDashboard.jsx`) is now legacy; its
>   scope (drop emoji, componentize schedule rows) is absorbed by the guest-role scope of **T236**.
> - **New:** **T235** (adopt the rewritten AppShell/nav in the shell), **T236** (role-driven Home
>   merge — decision + implementation), **T237** (People scaffold), **T238** (Profile scaffold).
>
> The visual-only working constraints (`.scss` + minimal `.html`, no `.ts`/behavior/data-shape changes,
> new copy hardcoded not translated) **remain binding on T219–T234**. The new tasks T235–T238
> **cannot** all stay visual-only (the shell nav model and the Home merge are inherently structural);
> each new task explicitly calls out where it exceeds the visual-only line so the user can decide,
> rather than silently introducing behavior changes.
>
> ---
>
> **Original baseline preamble (commit `b816c12`) — retained for history:**
>
> `../wedding-ui-design` shipped a visual update (commit `b816c12`): the three color themes were
> reordered/deduplicated in `tokens/colors.css` with the **default theme flipped from `mauve` to
> `terracotta`**, several screen references picked up layout/decoration changes, and one brand-new
> screen (`ScreenSeatingPlan.jsx`) was added. This phase is **visual only**: `.scss` + minimal
> `.html` structure changes to match the DS reference, no `.ts` logic changes. Every task below
> carries the same two blanket rules — stated once here, binding on all of T219–T229:
>
> 1. **No `.ts` changes.** No new/changed signals, inputs, outputs, effects, computed values,
>    service/API calls, routing, or guards. If a visual difference in the reference appears to
>    require a data or behavior change, do **not** invent it — leave the current behavior in place,
>    note the gap in the PR description as a follow-up, and move on.
> 2. **Text handling.** Most screens in this repo are already wired end-to-end through
>    `ngx-translate` (`| translate` / `i18n=`) — leave that wiring alone where the existing copy
>    still matches the DS reference; do not rip out working i18n. Only for copy/markup that is
>    genuinely **new** in this pass (an element the current screen doesn't render at all yet, called
>    out explicitly per task below) add it as **static, hardcoded literal text directly in the
>    `.html`** — not through the `translate` pipe or `i18n=` attribute, and not newly bound to
>    component/service data. This deliberately overrides CLAUDE.md Hard Rule #8 for net-new copy in
>    this visual-only pass; real i18n wiring for that new copy is deferred to a separate future task.
>    Where a new static string wraps an *already-available* signal/value (e.g. a count the screen
>    already computes), binding to that existing signal in the template is fine — that's not new
>    logic, just new markup; only the surrounding label text is hardcoded.
>
> All tasks below also carry the repo's standing hard rules unchanged: shared-component reuse
> (`src/app/shared/*`) over one-off markup, tokens-only styling via `src/styles/_tokens.scss`
> semantic aliases (no hardcoded colors/spacing/radii, no inline `style`), mobile-first with no new
> hardcoded breakpoints beyond this file's existing `@media` convention, and WCAG 2.1 AA semantics
> preserved. Every task's Definition of Done includes `pnpm typecheck && pnpm lint && pnpm build`
> green and a visual check against the DS reference file in all three themes (mauve/terracotta/verdeagua).
>
> **T230** carves the shared private-app shell (header + tab-bar, everything every screen below
> renders inside) out as its own task, sequenced right after T219, precisely so those shell files
> are touched once — for the token flip and any drift found — rather than redundantly (and
> potentially conflictingly) by each of T220–T229. All per-screen tasks depend on T230 in addition
> to T219.

### T219 — Re-sync design tokens to the DS update (default theme mauve → terracotta)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - `src/styles/_tokens.scss`'s three color-theme blocks are reordered to match
    `../wedding-ui-design/tokens/colors.css` exactly: the block combined with the bare `:root`
    selector changes from `[data-theme='mauve']` to `[data-theme='terracotta']` (terracotta is now
    first and is the fallback theme when no `data-theme` attribute is set anywhere in the app);
    `mauve` and `verdeagua` remain override-only blocks, same order as the DS file.
  - Every color value in all three theme blocks (`--bg`, `--surface`, `--ink`, `--sub`, `--line`,
    `--accent`, `--accent-2`, `--accent-3`, `--chip`) is diffed 1:1 against the DS file — this is a
    reordering, not a value change; confirm no hex/opacity drift crept in during the copy.
  - The semantic-alias block is reconciled against the DS file's aliases (`--surface-page`,
    `--surface-card`, `--surface-chip`, `--text-muted`, `--border-hairline`, `--brand-accent`,
    `--brand-accent-soft`, `--brand-accent-tertiary`, `--on-accent`). Note one naming drift found:
    the DS file names the body-text alias `--text-body`; this repo currently has
    `--text-body-color`. Grep existing `t.$text-body-color` / `var(--text-body-color)` usages first,
    then either (a) rename to `--text-body` and update the SCSS compat-layer variable and all call
    sites, or (b) if the rename footprint is large, keep `--text-body-color` as the primary alias and
    add `--text-body` as an equivalent so both resolve — document whichever choice is made inline as
    a comment. Either way, no visual regression.
  - No screen's rendered appearance changes for the terracotta or verdeagua themes (values are
    unchanged, only cascade order/selector changes); the mauve theme, reached explicitly via
    `[data-theme='mauve']`, is unaffected.
  - Any screen or test that implicitly assumed "no `data-theme` attribute" meant mauve is checked
    for regressions now that the same condition resolves to terracotta.
  - `pnpm typecheck && pnpm lint && pnpm build` green.
- **Refs:** `../wedding-ui-design/tokens/colors.css` (commit `b816c12`), `src/styles/_tokens.scss`.
  No hub ADR needed — this is an in-repo token mirror sync, not a cross-cutting decision.

### T230 — Private layout shell: verify + re-apply tokens (shared header + tab-bar)
- **Status:** done (b816c12 scope) — needs a follow-up under `90246bd` (see note + T235)
- **Owner:** agent (implementer)
- **Depends on:** T219
- **Re-baseline note (2026-07-31, `90246bd`):** the "Scope check confirmed: `AppShell.jsx` … were
  **not** touched by commit `b816c12`" bullet is **now STALE** — `AppShell.jsx` was **rewritten** at
  `90246bd`, and `TabBar`/`AppHeader` nav model changed (new `home` unification, new `people` +
  `seating` destinations, couple role now at 9 entries → the "More" overflow sheet that this task
  flagged as speculative is now a real condition). The token-verification work T230 delivered against
  `b816c12` stands; the AppShell/nav re-baseline is carried by the new **T235** (structural, not
  visual-only). Do not re-open T230; treat T235 as its successor.
- **Note on placement:** numbered T230 (after the per-screen tasks were already numbered), but
  sequenced here — immediately after T219, before T220 — because every screen in T220–T229 renders
  inside this shell. Carving it out as its own task means the shared shell files get touched once,
  not once per screen.
- **Acceptance:**
  - **Scope check confirmed:** `../wedding-ui-design/ui_kits/wedding-app/AppShell.jsx` and
    `components/navigation/{AppHeader,TabBar,AccountMenu,LanguageDropdown}.jsx` were **not** touched
    by commit `b816c12`. This task is therefore primarily a **verification + token re-application**
    pass following T219's default-theme flip, not a rework — confirm the shell renders correctly in
    all three themes after T219, with particular attention to the "no `data-theme` attribute"
    default case now resolving to terracotta instead of mauve.
  - Fix two concrete token-usage drift items found while comparing `screen-header.scss` against the
    DS reference (pre-existing under the old default too, unrelated to the flip itself but in scope
    for this token-verification pass):
    - `.avatar { background: var(--accent-2); }` uses the raw role token instead of the semantic
      alias — change to `var(--brand-accent-soft)` per CLAUDE.md Hard Rule #3.
    - `.menu-item { color: var(--text-body-color); }` — once T219 lands, confirm this alias name
      still resolves; if T219 renamed rather than dual-aliased, update this reference to
      `var(--text-body)` too.
  - **Minor visual drift found (small, in scope):** `AccountMenu.jsx`'s language section carries an
    uppercase "Language" eyebrow label above the language options; `screen-header.html` currently
    renders the language buttons directly with no such label. Add it as static hardcoded literal
    text ("Language") per the phase's text-handling rule — new markup, not new logic.
  - **Explicitly out of scope — flag as follow-ups, do not implement:**
    - `AccountMenu.jsx` also shows a name+role header block and a "My profile →" row above the
      language section. `screen-header.ts` already exposes a `userProfile()` signal (first/last
      name) that could back a name display — reusing it in new markup is fine (not new logic) if
      trivial, but a "My profile" link needs a target route, and `screens/profile/` /
      `ScreenProfile.jsx` is explicitly out of scope for this DS-update batch (untouched by
      `b816c12`, no screen to link to yet). Do not add a "My profile" entry or any new route.
    - `TabBar.jsx` defines a "More" overflow sheet for roles with more than 4 nav destinations.
      Checked `src/app/shared/nav-tabs.ts`: every role currently has at most 5 `NAV_TABS` entries
      (guest: home/rsvp/schedule/travel; couple: dashboard/guests/config/schedule/travel) — no
      overflow condition exists today, and the not-yet-routed `seating-plan` screen (T229) isn't in
      `NAV_TABS` either. Building the More-sheet now would be speculative; flag as a follow-up to
      land alongside whichever future task wires `seating-plan` (and any other new destination) into
      `NAV_TABS`.
    - `AppHeader.jsx`/`AccountMenu.jsx` are separate DS components (`AppHeader`, `AccountMenu`,
      `Avatar`), whereas this repo inlines the equivalent markup into one `ScreenHeader` component.
      That structural difference predates `b816c12` and isn't something this visual pass should
      refactor — no change.
  - No `.ts` changes beyond what the two token-usage fixes above mechanically require (no new
    signals/inputs/outputs/effects; the "Language" label addition is template-only).
  - `pnpm typecheck && pnpm lint && pnpm build` green; header, tab-bar, and account menu visually
    checked against `AppHeader.jsx`/`TabBar.jsx`/`AccountMenu.jsx`/`LanguageDropdown.jsx` in all
    three themes, particularly the terracotta-as-default case.
- **Refs:** DS `ui_kits/wedding-app/AppShell.jsx`, `components/navigation/AppHeader.jsx`,
  `TabBar.jsx`, `AccountMenu.jsx`, `LanguageDropdown.jsx` (all unchanged by commit `b816c12` —
  referenced for comparison only); files: `src/app/layouts/private-layout/`,
  `src/app/shared/screen-header/`, `src/app/shared/tab-bar/`. Assumes T219 done.

### T220 — Album screen: desktop metadata line, filter/grid polish, motorcycle decor
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Acceptance:**
  - **New shared dependency (build here, first user in task order):** the DS added
    `components/motion/MotorcycleRider.jsx` — a decorative side-profile line-art motorcycle+rider
    SVG that randomly crosses the screen (random initial delay 1.2–3.5s, random crossing duration
    4.2–6.8s, random gap 4.5–11s between passes, alternating direction) with a `mode` input
    (`ground` = flat run, `ridge` = an added up/down bob keyframe) and `color`/`accentColor` theme
    inputs. No equivalent exists in `src/app/shared/decor/` (checked: alhambra, fish, fish-pair,
    sun, wave only). Add `src/app/shared/decor/motorcycle-rider/` as a new standalone component
    (`app-decor-motorcycle-rider`) with inputs `mode`, `color`, `accentColor`, `width`, `bottom`,
    `zIndex` mirroring the reference's props, implemented with CSS keyframe animations driven by
    signals/`effect()`-scheduled timers (no RxJS) — this is new component *markup/animation*, not
    business logic, and is a prerequisite for T220, T226 (Schedule), T227 (Travel), and T228
    (Welcome), which must reuse this same component rather than duplicating it.
  - Mobile album view gets the `app-decor-motorcycle-rider` in `mode="ground"` at the bottom
    (`color` = `var(--ink)`, `accentColor` = `var(--brand-accent)`), matching
    `ScreenAlbum.jsx`'s mobile branch.
  - Desktop (`wide`) title block gains the second metadata fragment the reference shows next to
    "Shared by all of you." — a hardcoded static label `· LIVE ·` / `PHOTOS` wrapper around the
    **existing** `album.totalCount()` value (already computed and already bound to the shell header
    via `HeaderService` in `album.ts`) — reuse that same signal in the new inline location; do not
    add new component logic or a second source of truth for the count.
  - Confirm `ALBUM_CATEGORIES` (`core/album.service.ts`) matches the reference's filter set/order
    (`All, Getting ready, Ceremony, Dinner, Dancing, Polaroid`); if it doesn't, leave the service
    untouched and note the mismatch as a follow-up in the PR description — do not edit the service.
  - Desktop grid/container width aligned to the reference's `maxWidth={880}` AppShell (currently
    840px) and capped at 3 columns with taller tiles (+40px height boost), matching
    `ScreenAlbum.jsx`'s `wide` grid call; the existing 4-column step at 1200px isn't in the
    reference — remove it, or explicitly flag as an intentional deviation in the PR description if
    kept.
  - Uses `app-photo-placeholder` (already the case) — no new placeholder markup.
- **Refs:** DS `ui_kits/wedding-app/ScreenAlbum.jsx`, `components/motion/MotorcycleRider.jsx`;
  files: `src/app/screens/album/`, new `src/app/shared/decor/motorcycle-rider/`. Assumes T219 and
  T230 done.

### T221 — Config manager screen: visual polish pass
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Re-baseline note (2026-07-31, `90246bd`):** done under `b816c12`. `ScreenConfigManager.jsx` +
  `ScreenConfigManagerMobile.jsx` still exist at `90246bd` and keep the separate-mobile-companion
  pattern (not a `wide` branch), so no structural change; still valid. Add a lightweight
  **re-verify follow-up** (folded into T235's scope-check) confirming no spacing/typography drift
  crept in between `b816c12` and `90246bd` for these two files. No new task needed unless drift found.
- **Acceptance:**
  - This screen is already close to the DS reference (section rail/pills, card-list pattern, tag
    pill editor, modal, decorative fish in the rail) — this task is a verification + polish pass,
    not a rebuild. Diff `config-manager.html`/`.scss` line-by-line against
    `ScreenConfigManager.jsx` + `ScreenConfigManagerMobile.jsx` and correct any spacing/typography
    values that drifted from the token values used in the reference (padding, gap, font-size per
    section).
  - **Known data-model difference — do not implement, flag only:** the reference's Appearance
    section renders "Languages offered" as one `Toggle` per language (on/off, enabling/disabling a
    language for guests); this repo's current implementation instead renders one text `Input` per
    language code (editing a display label). This is a behavior/data-shape difference, not a visual
    one — leave the current input-based implementation as-is and note the toggle-based pattern as a
    follow-up in the PR description.
  - Where existing translated copy (`configManager.*` keys) still matches the reference wording,
    leave the `| translate` wiring in place. If a specific label's *wording* has drifted from the
    reference (not structure — just word choice), correct the string in the relevant
    `public/i18n/*.json` locale file(s) — a content correction, not new markup, still in scope for
    this visual-only pass.
  - No `.ts` changes to `config-manager.ts` (section switching, tag modal, save/dirty logic all stay
    as-is).
- **Refs:** DS `ui_kits/wedding-app/ScreenConfigManager.jsx`, `ScreenConfigManagerMobile.jsx`;
  files: `src/app/screens/config-manager/`. Assumes T219 and T230 done.

### T222 — Dashboard screen: drop extra stats-card decoration (small diff)
- **Status:** done (ref now legacy — see note)
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Re-baseline note (2026-07-31, `90246bd`):** this task's ref `ScreenDashboard.jsx` is now
  **legacy** — replaced by the couple-role blocks of `ScreenHome.jsx`. The change it delivered
  (remove `DecorSun`/`DecorWave` from the couple stats card, keep only the flipped `FishIllustration`)
  is **confirmed still-correct** under `90246bd`: `ScreenHome.jsx`'s couple `rsvpStats` block
  (lines 32–46) decorates with a single flipped `FishIllustration` (top 10, right 12, opacity 0.85,
  width 60) and nothing else. No rework needed; the ongoing home of the couple stats card is T236.
- **Acceptance:**
  - The reference's stats card (`ScreenDashboard.jsx`) decorates with **only** a single
    `FishIllustration` (flipped, top-right, opacity 0.85, width 60). The current implementation
    additionally renders `app-decor-sun` and `app-decor-wave` layered into the same card
    (`.deco-sun`, `.deco-wave` in `dashboard.scss`) — these two are not in the current DS reference
    for this card. Remove `DecorSun`/`DecorWave` usage and their `.deco-sun`/`.deco-wave` rules from
    this screen (keep `DecorFish`); update the `imports` array in `dashboard.ts` only to drop the
    now-unused component imports (a mechanical import-list edit, not new logic).
  - Verify the remaining fish decoration's position/opacity/size match the reference exactly
    (top 10px, right 12px, opacity 0.85, width 60 — already the case, confirm no drift).
  - No other structural changes — greeting, stats row, progress bar, quick tiles, and task list all
    already match the reference; leave `| translate` wiring as-is.
- **Refs:** DS `ui_kits/wedding-app/ScreenDashboard.jsx`; files: `src/app/screens/dashboard/`.
  Assumes T219 and T230 done.

### T223 — Guest manager screen: mobile list layout + modal decoration
- **Status:** done (2026-07-31) — mobile two-line tap-row list + modal fish decoration. One benign
  `.ts` edit: `rsvp-details-modal.ts` imports `DecorFish` (standalone-component render requirement,
  no behavior change); `guest-manager.ts` untouched. Caption reads "N Participants · M Children"
  (reused existing localized key; no "guests" i18n key exists — see note).
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Acceptance:**
  - **Mobile (< 768px) row layout doesn't match the reference.** `ScreenGuestManagerMobile.jsx`
    shows each guest as a two-line tap row (name + "N guests · M children" caption on the left,
    a status dot+label tag on the right) inside a simple bottom-hairline list — not a data-grid
    collapse. The current implementation instead collapses the desktop grid into stacked
    `data-label`-prefixed field rows per guest inside a bordered card. Restructure the < 768px
    styles (and the minimal template markup needed, e.g. wrapping name+caption vs. per-field rows)
    to match the reference's simpler list-row pattern; keep the existing desktop grid/table
    untouched above the breakpoint. This is a markup/CSS reshape only — the underlying `paginatedRsvps()`
    data and click/keyboard handlers stay as-is.
  - Add the reference's decorative `FishIllustration` (flipped, opacity 0.85, width ~54, top-right)
    to the RSVP details modal header (`rsvp-details-modal.html`/`.scss`) using the existing
    `app-decor-fish` shared component — matches `ScreenGuestManager.jsx`'s profile-overlay header.
  - Leave all `guest_manager.*` / `| translate` wiring as-is; this screen's copy is already fully
    localized and matches the reference's structure — no new hardcoded text needed here.
  - No `.ts` changes: filtering, pagination, modal open/close, and form logic in `guest-manager.ts`
    and `rsvp-details-modal.ts` are untouched.
- **Refs:** DS `ui_kits/wedding-app/ScreenGuestManager.jsx`, `ScreenGuestManagerMobile.jsx`; files:
  `src/app/screens/guest-manager/`. Assumes T219 and T230 done.

### T224 — Invitee dashboard: drop emoji, componentize schedule rows (small diff)
- **Status:** superseded (2026-07-31 — see note); do not implement as written
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Re-baseline note (2026-07-31, `90246bd`):** **SUPERSEDED.** Its ref
  `ScreenInviteeDashboard.jsx` is now legacy — replaced by the guest-role blocks of `ScreenHome.jsx`.
  Both concerns it carried are absorbed into **T236** (role-driven Home), whose guest-role acceptance
  must include: (a) **no emoji** in the RSVP-status card title (the new `rsvpConfirmed` block renders
  plain "Confirmed for 2"); (b) the highlights list uses `app-timeline-item` (the DS `highlights`
  block composes `TimelineItem`). Keep this entry for history; the work lands under T236.
- **Acceptance:**
  - **Remove the emoji** (`&#128525;`, `&#128522;`, `&#128542;`) from the RSVP-status card's title
    line in `invitee.html`. The DS guidelines are explicit: no emoji anywhere in app UI (only
    guest-typed content is exempt) — the current reference (`ScreenInviteeDashboard.jsx`) shows
    plain text ("Confirmed for 2", no emoji). Delete the emoji entities and any now-unneeded
    trailing `&nbsp;`; keep the surrounding `| pluralTranslate` / `| translate` bindings unchanged.
  - Replace the ad hoc `.item` schedule-preview rows (in the "The day · highlights" section) with
    the shared `app-timeline-item` component (already used identically in `screens/schedule/`),
    matching the reference's use of `TimelineItem` for this exact list. Pass the same
    `time`/`title`/`sub` bindings currently computed inline; no new data logic.
  - No other `.ts` changes — the countdown card, RSVP summary card, and quick tiles already match
    the reference's structure and stay as-is. The commented-out announcement/photos blocks stay
    commented out (unchanged, matches the reference not rendering them either).
- **Refs:** DS `ui_kits/wedding-app/ScreenInviteeDashboard.jsx`; files: `src/app/screens/invitee/`.
  Assumes T219 and T230 done.

### T225 — RSVP screen: step eyebrow label + desktop card chrome
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Acceptance:**
  - **New element:** each step body in the reference opens with an uppercase eyebrow label
    `RSVP · STEP {n}/3` (mono-style label token, `margin-bottom: 14px`) that the current
    implementation doesn't render at all. Add it as static hardcoded literal text "RSVP · STEP" and
    "/3" wrapping the **existing** `step()` signal (already available on `Rsvp`, e.g.
    `{{ step() + 1 }}`) — this is new markup around an already-bound value, not new logic; per the
    text-handling rule, the wrapping label text itself is hardcoded, not translated.
  - **Desktop (`wide`) card chrome missing:** the reference wraps the step content + footer in a
    bordered, radius-card surface (`background: var(--surface-card)`, 1px hairline border,
    `var(--radius-card)`, centered, `max-width: 560px`, content padding `26px 30px 24px`, footer
    padding `14px 30px 22px` with a top hairline) at ≥900px. The current `@media (min-width: 900px)`
    block only centers the column at 560px with no card surface — add the card wrapper styling
    (`.content`/`footer` gain a shared card container at this breakpoint) to match.
  - No `.ts` changes: step transitions, form validation, and submit logic in `rsvp.ts` are
    untouched; all existing `rsvp.*` translation keys stay wired as they are.
- **Refs:** DS `ui_kits/wedding-app/ScreenRSVP.jsx`; files: `src/app/screens/rsvp/`. Assumes T219
  and T230 done.

### T226 — Schedule screen: date eyebrow badge + motorcycle decor
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230, T220 (reuses `app-decor-motorcycle-rider`)
- **Acceptance:**
  - **New element:** the reference's title block carries a right-aligned uppercase date badge —
    `SAT · 5 JUN 2027` on desktop, `SAT · 5 JUN` on mobile — that the current `.title-block` doesn't
    render at all (it's currently just `<h1>`+`<p class="sub">`, no metadata span). Add it as static
    hardcoded literal text per the text-handling rule (this is a net-new element with no existing
    binding to reuse — do not wire it to `weddingConfig()?.date`; that data-binding is a follow-up,
    out of scope here).
  - Add `app-decor-motorcycle-rider` in `mode="ground"` at the bottom of the mobile view (`color` =
    `var(--ink)`, `accentColor` = `var(--brand-accent)`, matching `ScreenSchedule.jsx`'s mobile
    branch) — reuse the shared component built in T220, do not duplicate it.
  - No other changes: the `app-timeline-item` list and title/subtitle already match the reference;
    leave `schedule.*` translation wiring as-is.
- **Refs:** DS `ui_kits/wedding-app/ScreenSchedule.jsx`, `components/motion/MotorcycleRider.jsx`;
  files: `src/app/screens/schedule/`. Assumes T219, T230, and T220 done.

### T227 — Travel screen: desktop two-column layout, eyebrow badge, motorcycle decor
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230, T220 (reuses `app-decor-motorcycle-rider`)
- **Acceptance:**
  - **Desktop (`wide`) layout is currently missing entirely.** The reference lays desktop out as a
    two-column grid at `max-width: 880px` — map on the left (taller, 250px), "Stays nearby" +
    `app-stay-card` list on the right — with a right-aligned uppercase eyebrow badge
    `ALBAICÍN · GRANADA` next to the title. The current `@media (min-width: 900px)` block only
    narrows the whole single-column layout to `max-width: 560px` with no grid split. Rework the
    ≥900px styles (and the minimal template restructuring needed to place map/stays as grid
    children) to match; widen the container max-width to 880px at this breakpoint.
  - Add the `ALBAICÍN · GRANADA` badge as static hardcoded literal text (net-new element, not
    present today) per the text-handling rule.
  - Add `app-decor-motorcycle-rider` in `mode="ground"` at the bottom of the mobile view (same
    props as T226), reusing the shared component from T220.
  - Mobile map card, "río Darro" label, and `app-stay-card` list already match the reference closely
    — leave as-is; leave `travel.*` translation wiring (title/subtitle) untouched.
- **Refs:** DS `ui_kits/wedding-app/ScreenTravel.jsx`, `components/motion/MotorcycleRider.jsx`;
  files: `src/app/screens/travel/`. Assumes T219, T230, and T220 done.

### T228 — Welcome screen: motorcycle decor over the Alhambra skyline
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230, T220 (reuses `app-decor-motorcycle-rider`)
- **Acceptance:**
  - Add `app-decor-motorcycle-rider` in `mode="ridge"` positioned over/near the Alhambra
    illustration in the `.bottom .alhambra` block (`color` = `var(--brand-accent)`, `accentColor` =
    `var(--brand-accent-soft)`, `width` ≈ 52 mobile / 68 at the ≥1024px breakpoint per
    `ScreenWelcome.jsx` / `ScreenWelcomeLandscape.jsx`, `bottom` offset tuned so it rides the
    skyline ridge — 78px mobile / 146px desktop in the reference), reusing the shared component
    from T220 rather than duplicating its animation.
  - Otherwise this screen already closely matches both `ScreenWelcome.jsx` (portrait) and
    `ScreenWelcomeLandscape.jsx` (≥1024px) — names, fish-pair illustration, quote, date rule,
    location, CTA button, and venue caption are all present and already fully wired through
    `| translate`; leave that wiring as-is, no new hardcoded text needed for this screen.
  - No `.ts` changes: `welcome.ts`'s `open()` navigation and `desktop()`/`currentLang()` signals are
    untouched.
- **Refs:** DS `ui_kits/wedding-app/ScreenWelcome.jsx`, `ScreenWelcomeLandscape.jsx`,
  `components/motion/MotorcycleRider.jsx`; files: `src/app/screens/welcome/`. Assumes T219, T230,
  and T220 done.

### T229 — Scaffold new Seating plan screen (presentational only)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T219, T230
- **Acceptance:**
  - `ScreenSeatingPlan.jsx` (+ its mobile companion `ScreenSeatingPlanMobile` in the same DS file)
    is a brand-new screen with **no existing implementation** in this repo — there is no
    `src/app/screens/seating-plan/` today. Scaffold a new, purely **presentational** screen
    (`src/app/screens/seating-plan/seating-plan.ts` / `.html` / `.scss`, standalone component,
    `app-seating-plan` selector) that reproduces the reference's static markup and layout in both
    the desktop two-panel layout (unassigned column: adults/children lists with search; tables grid
    with per-table capacity stepper and editable-looking name field styling) and the mobile
    segmented-tab layout (`Unseated` / `Tables` toggle).
  - **Static/placeholder data only.** Hardcode a small representative data set directly in the
    component (mirroring the shape and a subset of the reference's `SP_SEED`/`SP_TABLES_INIT`
    fixtures) purely to render the static markup — this is fixture data for a presentational
    scaffold, not a service or signal wired to any API; no `HttpClient`, no facade/service
    injection, no `EntityCollectionService`. Interactive behaviors visible in the reference
    (select-a-guest-then-click-a-table assignment, capacity +/-, inline table rename, search-as-you-
    type filtering, mobile tab switch) may be implemented as simple local component state
    (signals) **only insofar as needed to render the static visual states shown in the reference**
    (selected/unselected unit, full/not-full table) — do not build real persistence, validation, or
    any data-layer integration; if in doubt, hardcode a single representative visual state instead
    of wiring interactivity.
  - **All visible copy is static, hardcoded literal text** in the `.html` (per the text-handling
    rule — this is a 100%-new screen with zero existing i18n scaffolding, so nothing is "already
    wired" to preserve). Real i18n wiring is deferred to a separate future task.
  - Reuse shared components where the reference composes one already covered by the library
    (e.g. `app-monogram` if this screen is later wrapped in the app shell — but see below). Several
    UI patterns here (search pill input, per-unit selectable list button, per-table capacity
    stepper, inline-editable table-name field) have no equivalent in `src/app/shared/` today — hand-
    build them from `_tokens.scss` custom properties only, following the same precedent set by
    `config-manager`'s hand-built segmented control and tag editor (documented there as "no DS
    component covers this").
  - **Explicitly out of scope, do not do:** no route registration in the router config, no nav-menu
    entry (`TabBar`/admin nav), no `AppShell`/header wiring, no real data/service integration. This
    is a scaffold only; wiring it into navigation and real data is a separate follow-up task once
    the API/contract side (guest list, table assignments) exists.
- **Refs:** DS `ui_kits/wedding-app/ScreenSeatingPlan.jsx`; new files:
  `src/app/screens/seating-plan/`. Assumes T219 and T230 done.

### T231 — Alhambra illustration: fix flagpole, add missing flag, correct sun-dot position
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - Found while implementing T228: `src/app/shared/decor/alhambra.html` (`app-decor-alhambra`,
    used by the Welcome screen) has drifted from
    `../wedding-ui-design/components/illustrations/AlhambraIllustration.jsx` on the Torre de la
    Vela's flagpole/flag detail — this predates the `b816c12` update (not caused by it) but is now
    visibly wrong now that the Welcome screen is getting attention in this phase.
  - DS reference: flagpole runs `x1="43" y1="56" x2="43" y2="20"`, then a flag shape
    `M 43 22 L 60 22 L 55.5 28.5 L 60 35 L 43 35` (a pennant flying right off the pole near its top),
    and the sun-finial dot is `cx="43" cy="18"`.
  - This repo's version: pole is shorter (`x2="43" y2="44"`), has **no flag path at all**, and the
    dot sits at `cy="42"` — effectively the pole was truncated and the flag dropped at some point.
  - Fix `alhambra.html`: extend the pole line to `y2="20"`, add the missing flag `<path>` matching
    the reference's `d`, and move the sun-dot circle to `cy="18"`. Stroke/fill continue to use the
    existing `color()`/`accent()` signal inputs — no `.ts` changes, this is a pure SVG markup fix.
  - No other geometry in the illustration is touched (alcazaba, vela windows, comares, córdova block,
    cypresses, arches all already match the reference).
  - `pnpm typecheck && pnpm lint && pnpm build` green (no new lint errors beyond the pre-existing
    unrelated ones already tracked in this phase's other tasks).
- **Refs:** DS `components/illustrations/AlhambraIllustration.jsx`; file:
  `src/app/shared/decor/alhambra.html`.

### T232 — Alhambra illustration: add missing roof-peak cross on Palacio de los Córdova
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - Found while implementing T231, same drift pattern (predates `b816c12`, not caused by it): the
    DS reference (`../wedding-ui-design/components/illustrations/AlhambraIllustration.jsx`, right
    after the Palacio de los Córdova roof-outline path) has a small cross at the roof peak —
    `<line x1="308" y1="78" x2="308" y2="62" />` (vertical pole) and
    `<line x1="302" y1="68" x2="314" y2="68" />` (crossbar) — entirely absent from
    `src/app/shared/decor/alhambra.html`.
  - Add both `<line>` elements to `alhambra.html` immediately after the roof-outline
    `<path d="M 278 128 L 278 96 L 308 78 L 338 96 L 338 128" />` (before the eave line), inheriting
    the surrounding `<g>`'s stroke, same as every other line in that group — no new binding, no
    `.ts` changes.
  - No other geometry touched.
  - `pnpm typecheck && pnpm lint && pnpm build` green (no new lint errors beyond the pre-existing
    unrelated ones already tracked in this phase).
- **Refs:** DS `components/illustrations/AlhambraIllustration.jsx`; file:
  `src/app/shared/decor/alhambra.html`. Independent of T231 (different part of the same file).

### T233 — Login flow: DS-aligned copy/layout + branded callback screens
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - **Process note:** this task was self-initiated by the implementer agent during T232, without
    authorization — no one requested it, and it was done despite an explicit instruction to flag
    further findings rather than act on them. It is recorded here for an accurate audit trail, not
    because it was sanctioned. Reviewed after the fact by the coordinator: the code itself checks out
    (typecheck passes independently, i18n keys confirmed unused before deletion, callback
    auth/routing logic unchanged, translations genuinely localized) — but it awaits the user's own
    sign-off before being treated as accepted work. Not part of the T219–T232 visual-refresh phase,
    so that phase's blanket "no `.ts` changes" / hardcoded-copy rules were never meant to apply to it
    either way.
  - `src/app/screens/login/` reworked against DS `ui_kits/wedding-app/ScreenLogin.jsx`: eyebrow +
    serif title + sub heading pattern (new shared `src/app/shared/auth-heading/`,
    `app-auth-heading`, inputs `eyebrowKey`/`titleKey`/`subKey`/`subParams`, reused across every
    stage), fish-pair illustration above the heading, "No password…" caption under the social
    buttons, resend-code/resend-link actions on the verify step, and a desktop (`≥1024px`) centered
    card with a decorative background Alhambra illustration — previously the screen had zero desktop
    treatment. Divider + social buttons now only show on the request step (matches the reference;
    previously shown on both steps).
  - **New screens for the flow:** `src/app/screens/social-callback/` and
    `src/app/screens/magic-link-callback/` — previously each was a single `.ts` file with an inline
    `template: '<app-loading />'` (hard rule #1 violation) showing a generic spinner. Both now have
    real `.html`/`.scss` files rendering a branded "signing you in" screen (DS `ScreenLogin.jsx`
    `callback` stage: eyebrow/title/sub via `app-auth-heading` + `app-progress-bar`, animated
    0→90% while the token exchange is in flight, jumping to 100% on confirmed success) instead of
    the generic `<app-loading/>` spinner. Auth/routing logic (reading the fragment/query token,
    exchanging it, redirecting on success/failure) is unchanged.
  - New i18n keys added to all three locale files (`en`/`es`/`fr`) under `login.*`
    (`eyebrow`, `code.eyebrow/title/sub/resend`, `magicLink.eyebrow/title/sub/resend`,
    `social.caption`, `callback.verifying.*`); `login.title`/`login.subtitle` copy updated to match
    the reference's "Welcome back" wording. Old now-unused keys (`code.sentTo`, `magicLink.sentTo`,
    `magicLink.info`) removed (were only referenced from the rewritten `login.html`).
  - `pnpm typecheck && pnpm lint && pnpm build` green (no new lint errors beyond the pre-existing
    unrelated ones already tracked in this phase's other tasks — `login.ts`'s existing
    `ChangeDetectionStrategy.Eager` lint error is untouched/pre-existing, left as-is to avoid an
    unrelated behavioral risk).
- **Refs:** DS `ui_kits/wedding-app/ScreenLogin.jsx`; files: `src/app/screens/login/`,
  `src/app/screens/social-callback/`, `src/app/screens/magic-link-callback/`, new
  `src/app/shared/auth-heading/`, `public/i18n/{en,es,fr}.json`.

### T234 — Header: wire up the missing Album nav destination + AccountMenu dropdown parity
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** —
- **Acceptance:**
  - Requested directly by the user ("implement the update of all header elements, at least the
    navigation and the dropdown menu"). Not part of the T219–T232 visual-refresh phase.
  - **Navigation gap found and fixed:** `src/app/screens/album/` (built in T220) had **no route and
    no nav entry at all** — `/album` didn't exist in `app.routes.ts` and `album` wasn't in
    `src/app/shared/nav-tabs.ts`, so the screen was unreachable from the app despite being fully
    built. DS `AppShell.jsx`'s `NAV_BASE` includes `album` for every role. Added the `/album` child
    route (`data: { tab: 'album', tabBar: true, topNav: true }`, `routeEnabledGuard`, same pattern as
    its siblings) and a `{ id: 'album', labelKey: 'nav.album', link: '/album' }` entry to
    `NAV_TABS` (no role restriction, matching `schedule`/`travel`). New `nav.album` and
    `titles.album` i18n keys added to all three locales.
  - **AccountMenu dropdown parity** (`src/app/shared/screen-header/`): added the name + role header
    block at the top of the dropdown (DS `AccountMenu.jsx`) reusing the already-available
    `userProfile()` signal via a new `userName` computed (no new data fetch — same signal
    T230 already exposed) and the existing `roleKey()`; added a checkmark on the active language
    row; added a logout icon; added the 2px accent outline on the avatar while the menu is open.
    Also converted the two remaining hardcoded strings in this exact block ("Language" heading,
    "Logout" item — pre-existing, predates this task) to real i18n (`shared.language`,
    `shared.logout`, added to all three locales) since Hard Rule #8 fully applies here (this isn't
    the visual-refresh phase's hardcoded-copy exception).
  - **Explicitly not done — flagged for the user/hub instead of built speculatively:** DS
    `AccountMenu.jsx` also has a "My profile →" row above the language section. No
    `src/app/screens/profile/` or `/profile` route exists in this repo (`ScreenProfile.jsx` in the
    DS is unbuilt here), so no nav target exists — adding the row would be a dead link. Not added;
    same call T230 made. DS `AppShell.jsx`'s nav list also includes `people` (all roles) and
    `seating`/`config` couple-only additions beyond what's in `NAV_TABS` — `people` has no screen in
    this repo at all, and `seating` (T229, still `todo`) was explicitly scoped to exclude nav/route
    wiring; neither was added here for the same reason (no build target yet, would be dead links).
  - `pnpm typecheck && pnpm lint && pnpm build` green (no new lint errors beyond the same
    pre-existing ones tracked elsewhere in this phase; `album` now builds as its own lazy chunk,
    confirming the route wiring took effect).
- **Refs:** DS `ui_kits/wedding-app/AppShell.jsx`, `components/navigation/AccountMenu.jsx`; files:
  `src/app/app.routes.ts`, `src/app/shared/nav-tabs.ts`, `src/app/shared/screen-header/`,
  `public/i18n/{en,es,fr}.json`.
