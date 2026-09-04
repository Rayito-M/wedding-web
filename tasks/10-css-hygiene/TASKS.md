## Phase — Cross-screen CSS hygiene (in-repo, no hub dependency)

> Recurring quality problem: implementers work one task at a time with no cross-screen
> visibility, so they re-declare hand-built CSS classes that already exist in a sibling screen —
> and the copies then diverge. Confirmed instance: `.status-pill` is declared independently in
> `screens/schedule/schedule.scss` (semantic aliases, `padding: 3px 9px`, `gap: 6px`) and
> `screens/invitee/invitee.scss` (raw role tokens `--sub`/`--line`/`--accent`, `padding: 2px 8px`,
> no gap) — same intent ("Final schedule / Provisional"), diverged look; both hardcode `#b8862b`
> for `.provisional` (violates CLAUDE.md Hard Rule #3). A related-but-distinct account pill lives
> at `config-manager.scss` (`.couple-status-pill`, active/invited). T241 does the safe token
> hygiene + inventory first; T242 consolidates the duplicated markup once the inventory exists.
> The systemic prevention (implementer guardrail + a read-only CSS-audit agent) is handled outside
> TASKS.md in `.claude/agents/`.

### T241 — Audit duplicated screen CSS + fix token violations (hygiene only, no restructure)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** The `#b8862b` in `schedule.scss:70` and `invitee.scss:143` is **not** an invented
  color — the DS `tokens/colors.css:58-59` already defines **both** `--status-provisional: #b8862b`
  (with an explicit DS comment: *"schedule-level status — deliberately outside the theme palette so
  'provisional' reads as a flag"* — so the off-palette gold is sanctioned, mirror it verbatim) **and**
  `--status-final: var(--accent)`. Neither was mirrored into `src/styles/_tokens.scss` (T239 mirrored
  `--status-confirmed`/`-planned`/`-cancelled` but missed both schedule-level tokens). So this is a
  token-sync + reference fix, **not** a DS change — no hub/DS escalation. The raw-role-vs-semantic-alias
  split (`--sub` vs `--text-muted`, `--line` vs `--border-hairline`, `--accent` vs `--brand-accent`) is
  likewise a CLAUDE.md Hard Rule #3 fix, resolved in favor of the semantic aliases. (Verified against the
  DS token file directly on 2026-08-01, resolving the css-auditor's "couldn't read DS tokens" caveat for
  these two tokens.)
- **Acceptance:**
  - Produce an **inventory** (in the PR description) of every class name declared in more than one
    file across `src/app/screens/**/*.scss` — grep each declared selector and list the duplicates,
    flagging which have **diverged** (different property values). Start from `.status-pill` but list
    all matches; this inventory is the input to T242's consolidation decision. No behavior change here.
  - Mirror **both** `--status-provisional: #b8862b` and `--status-final: var(--accent)` into
    `src/styles/_tokens.scss` under the existing status-token block (alongside `--status-confirmed`/
    `-planned`/`-cancelled`), diffed 1:1 against `../wedding-ui-design/tokens/colors.css:53-59` — no hex
    drift, no new value invented.
  - Replace the hardcoded `#b8862b` in `schedule.scss` and `invitee.scss` with
    `var(--status-provisional)`; remove any remaining raw hex from these two `.status-pill` blocks. The
    `.final` variant currently uses `var(--brand-accent)`/`var(--accent)` directly — switch it to the
    dedicated `var(--status-final)` token (resolves to the same value; makes the semantic intent explicit
    and gives T242 a single token to consume).
  - Resolve the raw-role vs semantic-alias inconsistency **in favor of semantic aliases**: in
    `invitee.scss`'s `.status-pill`, `--sub`→`--text-muted`, `--line`→`--border-hairline`,
    `--accent`→`--brand-accent`, `--on-accent` unchanged; verify `schedule.scss`'s block already uses
    the aliases and matches. (This aligns the two blocks on tokens but does **not** yet dedupe them —
    that's T242. Divergent padding/gap is deliberately left for T242's single source of truth.)
  - Confirm `.couple-status-pill` (`config-manager.scss`) uses only semantic aliases (it currently
    does) — no change unless a raw role or hex is found; note it in the inventory as a consolidation
    candidate for T242, don't restructure it here.
  - No `.ts`/template changes; class names and DOM unchanged. `pnpm typecheck && pnpm lint && pnpm
    build` green; verify no visual regression in all three themes (values are unchanged for the
    terracotta/verdeagua paths; `--status-provisional` now resolves to the same `#b8862b` it did when
    hardcoded).
- **Refs:** `../wedding-ui-design/tokens/colors.css` (line 58, `--status-provisional`); CLAUDE.md Hard
  Rule #3; files: `src/styles/_tokens.scss`, `src/app/screens/schedule/schedule.scss`,
  `src/app/screens/invitee/invitee.scss`, `src/app/screens/config-manager/config-manager.scss`.

### T242 — Consolidate the duplicated status pill into one shared implementation
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T241
- **Context & consolidation decision (architect — recorded here, do not re-litigate):** The
  duplicated `.status-pill` (final/provisional) in `schedule` + `invitee` should collapse to **one
  shared Angular component** — `src/app/shared/status-pill/` (`app-status-pill`) — following the
  established shared-reuse precedent (`shared/pill` implements DS `core/Pill`; `shared/timeline-item`
  implements DS `TimelineItem`). A shared **SCSS partial/mixin** is an acceptable fallback *only if*
  the component wrapper element measurably breaks the existing inline layout; if the implementer takes
  the partial route, record why in the PR. Rationale for the component over leaving two copies: a
  partial still permits class-name drift and doesn't enforce token usage; a component gives one
  DOM/token contract. **Scope/escalation flag:** the DS has **no named `StatusPill` component** — the
  final/provisional shape appears *inline and un-factored* in `ScreenSchedule.jsx` (`statusPill`) and
  `ScreenHome.jsx` (`schedulePill`), and the status tones (planned/confirmed/cancelled) are already
  tokenized (`--status-*`). Reproducing that existing inline pattern as an in-repo shared component is
  **in wedding-web scope** (DRYing an existing visual, not inventing one) and needs **no hub/DS
  escalation to proceed**. Promoting "status pill" to a *canonical DS component* (a `Pill`-sibling with
  its own `.prompt.md`, and refactoring the DS screens to consume it) **is** a design-system decision →
  that is a **parallel, non-blocking escalation to the system-architect** (`../wedding-architecture`);
  note it in the PR, but do not wait on it. No in-repo ADR required for a single-pattern extraction.
- **Acceptance:**
  - New `src/app/shared/status-pill/` (`.ts`/`.html`/`.scss`, `app-status-pill`, standalone,
    `OnPush`) reproducing the final/provisional pill exactly as it renders **after T241** (semantic
    aliases only; `--status-provisional` for provisional, `--status-final` for final; dashed hairline
    default, solid fill when final). Expose the state via a typed `input()` (e.g. `variant: 'final' |
    'provisional'`), no inline
    styles, tokens only. Pick **one** source of truth for the padding/gap that diverged between the two
    screens (schedule's `3px 9px` + `gap: 6px` is the newer DS-aligned value — prefer it unless the DS
    reference says otherwise) and document the choice in the component `.scss`.
  - `screens/schedule/` and `screens/invitee/` consume `app-status-pill` and **delete** their local
    `.status-pill` blocks (and the now-dead `.provisional`/`.final` rules); the two screens render
    identically to each other. Template markup swaps the `<span class="status-pill …">` for
    `<app-status-pill [variant]="…">`; the existing bound condition (final vs provisional from
    `weddingConfig().agenda.status`) is reused — no new component/service logic, no `.ts` data changes
    beyond adding the component to `imports`.
  - Evaluate `.couple-status-pill` (config-manager, active/invited) against the new component: if it
    fits with an added tone/variant, fold it in; if its semantics (account active/invited, different
    padding) make it a distinct concern, **leave it** and note the decision in the PR — do not force an
    ill-fitting merge. Either way it must not reintroduce a raw hex or raw-role token.
  - The T241 inventory is re-checked: any *other* duplicated-and-diverged screen class it surfaced is
    either consolidated here (if it's the same visual pattern) or explicitly listed as a follow-up task
    candidate — this task's structural change stays scoped to the status pill.
  - `pnpm typecheck && pnpm lint && pnpm build` green; visual parity verified for schedule + invitee
    (and config-manager if folded in) across all three themes, mobile + desktop, final vs provisional.
- **Refs:** DS `components/core/Pill.jsx`/`.prompt.md` (precedent, soft/accent only — not the status
  shape), `ui_kits/wedding-app/ScreenSchedule.jsx` (`statusPill`), `ScreenHome.jsx` (`schedulePill`);
  existing shared precedent `src/app/shared/pill/`, `src/app/shared/timeline-item/`; files:
  new `src/app/shared/status-pill/`, `src/app/screens/schedule/`, `src/app/screens/invitee/`,
  `src/app/screens/config-manager/`. Parallel escalation (non-blocking): system-architect, DS
  `StatusPill` spec.

> **css-auditor first-sweep dispositions (2026-08-01).** The `web-css-auditor` confirmed the
> `.status-pill` incident (A1 → T241/T242) and found the divergence is systemic. Each finding's
> disposition is recorded below. Sequencing rule: the **token-hygiene** tasks (T241, T243, T244) are
> safe/mechanical and come first; the **structural extraction** tasks (T245–T247) and the
> **convention** task (T248) follow so they operate on already-alias-consistent SCSS. B4 is the only
> item that is **not** a wedding-web decision — it's escalated (T249). Finding-to-task map:
> A1→T241+T242 · A2→**T247** (+ note on done T236) · A3→**T246** · A4→**T245** · A5→**T247** ·
> B1→T241 · B2→**T243** · B3→**T244** · B4→**T249 (escalate)** · C1→**T243** · C2→**T248**.

### T243 — Raw-role → semantic-alias sweep + travel inline-SVG extraction (token hygiene, mechanical)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T241 (status-token mirror settled first; avoid clobbering T241's `invitee.scss`
  `.status-pill` edit — T243 touches the *other* rules in that file)
- **Context:** css-auditor B2 + C1. 65 raw-role token uses where a semantic alias exists, across ~10
  files (invitee 17, dashboard 12, album 9, `shared/theme-selector` 9, travel 7, welcome 5, plus
  others). Pure CLAUDE.md Hard Rule #3 hygiene: the alias resolves to the **same** value, so this is a
  no-visual-change mechanical swap that also makes the later dedup tasks (T247) clean. C1 folds in here
  because travel is already in the file list and its inline styles include raw roles.
- **Acceptance:**
  - Map every raw-role usage to its semantic alias, repo-wide in `src/app/**/*.scss` (excluding the
    token-source `src/styles/_tokens.scss` and generated `core/api/`): `var(--surface)`→
    `--surface-card` (or `--surface-page` where it's a full-bleed background — judge per context and
    note any ambiguous ones), `var(--sub)`→`--text-muted`, bare `var(--accent)`→`--brand-accent`
    (leave `--accent-2`/`--accent-3` and their aliases as-is), `var(--line)`→`--border-hairline`.
    Also fix the SCSS-var equivalents (`t.$sub` etc.) where the alias form exists.
  - **C1:** move the inline `style="…"` attributes off the SVGs in `travel.html:18,24,30,36,44,50,51`
    into class selectors in `travel.scss` (Hard Rule #2), using semantic aliases (several of those
    inline values are themselves raw roles — resolve them in the same pass).
  - No class renames, no DOM/structure change, no `.ts` change; this is find-and-replace + one template
    de-inlining. `pnpm typecheck && pnpm lint && pnpm build` green; spot-check each touched screen in
    all three themes to confirm **zero** visual change (aliases resolve to identical values).
  - Update the PR description with the final count actually changed (the auditor's 65 is an estimate);
    if any raw-role use is intentional (no alias fits), list it as a candidate for the T249 escalation
    rather than forcing a wrong alias.
- **Refs:** css-auditor B2 + C1; CLAUDE.md Hard Rule #2/#3; `src/styles/_tokens.scss` (alias list);
  files: `src/app/screens/**/*.scss` (esp. invitee, dashboard, album, travel, welcome),
  `src/app/shared/theme-selector/`, `src/app/screens/travel/travel.html`.

### T244 — De-hardcode `shared/loading` + `shared/error` (rogue hex + OS dark-mode blocks)
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** — (fully unblocked; **no longer depends on T249** — see the ADR-0025 note below)
- **Note (2026-08-01, hub ADR-0025 resolves the T249 coupling):**
  - **OS dark mode confirmed unsupported** — `data-theme` is the sole axis. Remove the
    `prefers-color-scheme: dark` blocks as written **and** the same block in
    `shared/theme-selector.scss` (a third instance surfaced during the escalation review).
  - **The scrim line is decoupled, not deferred:** the loading/error full-bleed veils are **not**
    scrims — set them to **solid `var(--surface-page)`** as the **permanent** answer and **drop the
    `// TODO(T249): --scrim` comment**. `--scrim` (ADR-0025) is only for modal backdrops (T249's sweep),
    not these veils. T244 no longer waits on T249.
- **Context:** css-auditor B3 (ranked above the general raw-role sweep for severity). `shared/loading/
  loading.scss` and `shared/error/error.scss` are full of off-palette literals — `#c9a961` (a gold that
  matches **no** theme accent), `#666`, `#333`, `#ccc`, `#fff`, `#d4af85`, `#b8975a`, `#a8874d`,
  `#1a1a1a`… — plus hand-rolled `@media (prefers-color-scheme: dark)` blocks. These break theme
  switching: the app themes via the `data-theme` attribute (T219), **not** OS dark mode, so these
  components neither follow the active theme nor use the brand accent. **Architect decision (not a DS
  escalation):** the `#c9a961`/`#d4af85` gold is a *rogue literal*, unlike the DS-sanctioned
  `--status-provisional` — it must map to the theme accent (`--brand-accent`), not become a new token.
- **Acceptance:**
  - Replace every hardcoded color in both files with the appropriate semantic alias: accent/spinner/
    button fill → `--brand-accent` (hover/active → `--brand-accent`-based, use an existing darker alias
    if one fits, else document); title text → `--text-body`; secondary text → `--text-muted`; button
    foreground → `--on-accent`. No raw hex remains.
  - **Remove the `@media (prefers-color-scheme: dark)` blocks entirely** — the app does not theme off OS
    preference (it uses `[data-theme]`); the aliases already resolve per active theme, so the dark
    overrides are both wrong and redundant. (If any product requirement for OS-dark actually exists,
    that's a separate cross-cutting decision — flag it, don't keep the hand-rolled hex.)
  - The full-bleed overlay **scrim** backgrounds (`rgba(255,255,255,0.95)` / `rgba(17,17,17,0.98)`) have
    **no** token today — this is the shared concern with T249. Interim: use `var(--surface-page)` (solid)
    so the overlay at least follows the theme; leave a `// TODO(T249): --scrim token` comment. Do **not**
    invent a scrim rgba per-file. Swap to the real `--scrim` token when T249 lands.
  - `pnpm typecheck && pnpm lint && pnpm build` green; verify the loading + error overlays render legibly
    in all three themes.
- **Refs:** css-auditor B3; CLAUDE.md Hard Rule #3; T219 (`data-theme` theming); depends-on-when-landed:
  T249 (`--scrim`); files: `src/app/shared/loading/loading.scss`, `src/app/shared/error/error.scss`.

### T245 — Shared `app-avatar` component (DS `core/Avatar`) — retire 3 re-authored copies
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** css-auditor A4. `.avatar` is re-authored at three sizes in `people.scss:149`,
  `profile.scss:90`, `rsvp-edit.scss:82` — core identical, only size/font differ (one uses
  `var(--font-serif)`, one `t.$font-serif`). DS defines `components/core/Avatar.jsx` (verified present)
  but this repo has **no** `shared/avatar` (verified) — so building it implements an existing DS spec,
  the same in-scope pattern as `shared/pill`←DS `core/Pill`. **No DS escalation.** (Note: `screen-header`
  also inlines an `.avatar`; evaluate but don't force it in if its needs differ.)
- **Acceptance:**
  - New `src/app/shared/avatar/` (`app-avatar`, standalone, `OnPush`) per DS `core/Avatar.jsx`, with a
    `size` input (map the three existing sizes to named steps, e.g. `sm|md|lg`, or a numeric px input —
    implementer's call, follow the DS prop shape) and initials/monogram content. Tokens + `--font-serif`
    via the semantic alias only; no inline styles.
  - Migrate `screens/people/`, `screens/profile/`, `screens/rsvp-edit/` to `app-avatar` and delete their
    local `.avatar` rules. No behavior/data change beyond adding the component to `imports`.
  - Reconcile the `var(--font-serif)` vs `t.$font-serif` inconsistency onto one form inside the shared
    component. `pnpm typecheck && pnpm lint && pnpm build` green; visual parity for all three screens,
    all three themes.
- **Refs:** css-auditor A4; DS `components/core/Avatar.jsx`; precedent `src/app/shared/pill/`,
  `src/app/shared/monogram/`; files: new `src/app/shared/avatar/`, `src/app/screens/{people,profile,
  rsvp-edit}/`.

### T246 — Shared status-dot partial for the guest-manager feature
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** css-auditor A3. `.status-cell`/`.status-dot`/`.status-declined` are duplicated in
  `guest-manager/guest-manager.scss:263-290` and `guest-manager/rsvp-details-modal.scss:69-95` (minor
  divergence: `font-size` + `white-space`). Both live in the **same feature folder**, so a local shared
  SCSS partial (imported by both) is the right tool — no component, no design-system boundary crossed.
- **Acceptance:**
  - Extract the status-dot/cell rules into one partial under `src/app/screens/guest-manager/` (e.g.
    `_status-cell.scss`) and `@use` it from both `guest-manager.scss` and `rsvp-details-modal.scss`;
    delete the duplicated blocks. Reconcile the `font-size`/`white-space` divergence onto one value
    (prefer the one matching the DS reference; document the pick).
  - Tokens/semantic aliases only (fix any raw role found in these blocks in passing). No `.ts`/template
    change beyond the SCSS `@use`. `pnpm typecheck && pnpm lint && pnpm build` green; guest list + RSVP
    details modal status indicators render identically, all three themes.
- **Refs:** css-auditor A3; files: `src/app/screens/guest-manager/` (`guest-manager.scss`,
  `rsvp-details-modal.scss`, new `_status-cell.scss`).

### T247 — Consolidate near-clone screen SCSS: dashboard≈invitee blocks + generic primitives
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T243 (operate on alias-consistent SCSS), T236 (done; established the two components
  stay separate under Option A)
- **Context:** css-auditor A2 + A5 — the largest consolidation. **A2:** `dashboard.scss` and
  `invitee.scss` share copy-pasted block families (`.greeting`/`.hello`/`.accent`/`.content`/
  `.deco-fish`), some byte-identical, some diverged (esp. `.deco-fish` position/opacity across
  `dashboard`/`invitee`/`profile`). **A5:** generic primitives (`.card` in 6 files with diverging
  padding/border, `.eyebrow` in 6, `.sub` in 5, plus `.title`, `.mobile-moto`, `.remove-btn`,
  `.add-link`, `.field`/`.field-label`) are re-authored per screen — no runtime collision (Angular
  `:host` scoping) but the same primitive rewritten repeatedly, and the divergence is real. **This task
  is judgment-heavy and MAY be split** (e.g. A2 as one PR, the `.card`/`.eyebrow`/`.sub` trio as another)
  — the implementer should split if it exceeds one reviewable PR.
- **Mechanism decision (architect):** use **shared SCSS placeholders/mixins** (a partial under
  `src/styles/` or `src/app/shared/styles/`, `@use`d by screens) for pure style primitives — **not** new
  Angular components — because these are styling fragments (`.eyebrow`, `.sub`, a `.card` surface), not
  behavior-bearing UI. Reserve component extraction for things with markup/logic (that's T242/T245).
  Where a "primitive" is actually a DS-named component in disguise (e.g. a `.card` that's really DS
  `StayCard`/`ProfileCard`), prefer the existing shared component over a new placeholder. A short in-repo
  ADR (proposed **W-0002**, "shared SCSS primitives") is warranted **if** the placeholder/mixin
  convention is genuinely new to the repo — author it in the same PR; otherwise a doc comment in the
  partial suffices.
- **Acceptance:**
  - Start from the T241 inventory (refreshed): pick the primitives with the clearest shared contract —
    at minimum `.eyebrow`, `.sub`, and the generic `.card` surface — and extract each to one shared
    placeholder/mixin; migrate the screens onto it, deleting the local copies. Reconcile each divergence
    onto one canonical value, checked against the DS reference; document any deliberate per-screen
    override left in place.
  - Dedupe the `dashboard`≈`invitee` block families (A2) onto the shared primitives / a shared partial;
    reconcile the `.deco-fish` position/opacity divergence (prefer using the existing `app-decor-fish`
    component's inputs for positioning rather than re-declaring offsets). Keep both screens as separate
    components (Option A stands) — the shared partial is merge-compatible if Option B is taken later.
  - Semantic aliases only; no raw roles or hex reintroduced. No `.ts`/behavior change. `pnpm typecheck &&
    pnpm lint && pnpm build` green; every migrated screen visually unchanged in all three themes, mobile
    + desktop. List any primitive deliberately **not** consolidated (and why) as the residual backlog.
- **Refs:** css-auditor A2 + A5; done T236 (Option A, components stay separate); DS
  `components/data-display/{StayCard,ProfileCard,StatTile}.jsx` (for `.card`-that-is-really-a-component
  cases); files: `src/app/screens/{dashboard,invitee,profile,…}/`, new shared SCSS partial; proposed
  in-repo ADR W-0002.

### T248 — Breakpoint convention: document sanctioned tiers + reconcile the guest-manager outlier
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Context:** css-auditor C2. CLAUDE.md Hard Rule #4 mandates mobile-first (min-width). Most screens
  comply, but `guest-manager.scss` is **desktop-first** (`max-width: 900/768/480`), and the app uses
  several breakpoint values in different contexts (modals `640px`, screens `900px`, login/welcome
  `1024px`). The tiers themselves may be legitimate per context; the defect is the desktop-first outlier
  and the lack of a written convention. **This carries real regression risk** (inverting guest-manager's
  media queries), so it's isolated as its own task, not folded into the mechanical sweep.
- **Acceptance:**
  - Author a short in-repo ADR (or a section in an existing styling doc) cataloguing the **sanctioned**
    breakpoint tiers and their context (e.g. `640` modal, `900` screen shell, `1024` auth screens) and
    restating the mobile-first (min-width) rule — so future screens have a reference and the auditor has
    a spec to check against.
  - Reconcile `guest-manager.scss` (and its `rsvp-details-modal` if applicable) from desktop-first
    `max-width` queries to the mobile-first `min-width` convention, **or** — if a desktop-first data-grid
    is genuinely justified here — explicitly sanction and document the exception in the ADR with the
    rationale. Decide in-PR; do not leave it undocumented.
  - No behavior/data change; visual parity across the full width range (test the boundaries: below/at/
    above each tier). `pnpm typecheck && pnpm lint && pnpm build` green.
- **Refs:** css-auditor C2; CLAUDE.md Hard Rule #4; files: `src/app/screens/guest-manager/`, new/updated
  in-repo styling ADR.

### T249 — [ESCALATION → hub/DS] Add `--scrim` + `--shadow-card` design tokens
- **Status:** resolved by hub **ADR-0025** (2026-08-01) → now an in-repo **mirror + sweep** follow-up
  (blocked only on the DS shipping the tokens)
- **Owner:** system-architect resolved the decision; the mirror + sweep is a wedding-web implementer task
- **Depends on:** the DS authoring the tokens (see Resolution — authority gap)
- **Resolution (2026-08-01, hub ADR-0025):**
  - **OS dark mode is NOT a supported theming axis** — confirmed. `data-theme` (terracotta default,
    mauve, verdeagua; all **light**) is the sole mechanism. This unblocks **T244**'s removal of the
    `prefers-color-scheme` blocks (and a **third** such block found in `shared/theme-selector.scss` —
    fold it into T244's removal).
  - **Tokens sanctioned, but renamed off `--shadow-card`:**
    - `--scrim: rgba(0, 0, 0, 0.45);` — backdrop dim behind modals/dialogs; **theme-invariant**; lives
      in DS `tokens/colors.css` (`:root` alias block). Consumers: `shared/modal` backdrop and the
      `config-manager` modal backdrop (reconcile its `0.5` → `--scrim`).
    - `--shadow-overlay: 0 4px 16px rgba(0,0,0,0.12);` and `--shadow-modal: 0 24px 70px rgba(0,0,0,0.25);`
      in DS `tokens/spacing.css` — **NOT** `--shadow-card` (in-flow cards stay flat/hairline; shadows
      are for off-flow overlays only). Both theme-invariant. Sweep the literals in `language-selector`,
      `theme-selector`, `country-code-select`, `screen-header` (→ `--shadow-overlay`), `shared/modal`
      panel + `config-manager` modal panel (→ `--shadow-modal`).
  - **Loading/error veils are NOT scrims** → they use solid `var(--surface-page)` **permanently**
    (decouples T244's scrim line from this task — T244 no longer waits on T249).
  - **Authority gap:** the DS repo has no `TASKS.md` and isn't on the hub authority allowlist, so the
    token edits weren't authored by the hub agent; ADR-0025 carries the full token spec for the DS
    owner to apply via the `wedding-design` design plugin. **This in-repo task stays blocked only until
    the DS ships the tokens**; then: (1) mirror the three tokens into `src/styles/_tokens.scss` (same
    step as T219/T241); (2) run the literal→token sweep above. `pnpm typecheck && pnpm lint && pnpm
    build` green; visual parity in all three themes.
- **Why escalated:** css-auditor B4 found hardcoded `rgba()` scrims (overlay backgrounds) and shadows
  spread across `config-manager`, `shared/modal`, `shared/theme-selector`, `shared/country-code-select`,
  `shared/language-selector`, `shared/screen-header`, and the T244 loading/error overlays. The DS token
  set defines **only** `--shadow-knob` (verified in `../wedding-ui-design/tokens/spacing.css:18`); there
  is **no** `--scrim` and **no** `--shadow-card`. Adding new design tokens is a **design-system decision**
  affecting the shared token contract (and its mirror in `src/styles/_tokens.scss`) — per CLAUDE.md
  ("design system changes … escalate") this is **out of the web-architect's authority**. Do **not** invent
  scrim/shadow rgba values in-repo.
- **What the hub/DS is asked to decide:**
  - Whether to add `--scrim` (overlay/backdrop) and `--shadow-card` (raised-surface shadow) tokens to
    `../wedding-ui-design/tokens/`, with per-theme values, and mirror them into this repo's `_tokens.scss`
    (the mirror step then becomes an in-repo follow-up, like T241 did for the status tokens).
  - Whether OS dark-mode is a supported theming axis at all (informs T244's removal of the hand-rolled
    `prefers-color-scheme` blocks).
- **Unblocks (once tokens land):** the scrim line of **T244** (swap `--surface-page` interim → `--scrim`)
  and a follow-up sweep replacing the ad-hoc `rgba()` scrims/shadows in the components listed above.
- **Refs:** css-auditor B4; `../wedding-ui-design/tokens/spacing.css` (`--shadow-knob` only);
  `../wedding-architecture/.agent/authority.md`; CLAUDE.md ("When in doubt" / design-system escalation).
