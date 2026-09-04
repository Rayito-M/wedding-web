## Phase W — Guest manager: infinite scroll + sort re-sync (`wedding-ui-design` `6a76eba`)

> DS commit `6a76ebaaca9c36a0ab405cd6e91176610e8af7e8` — "Enhance guest management UI with
> infinite scrolling and sorting features" — replaced the guest manager's numbered pagination with
> a list that grows on scroll, on both `ScreenGuestManager.jsx` and
> `ScreenGuestManagerMobile.jsx`. This repo's screen is one responsive component, so the two DS
> screens collapse into T330; T331 picks up the sorting details `fe9654f` did not already cover.
> The windowing is **client-side** — see in-repo ADR W-0008 and T330's finding. T332 is the
> accessibility follow-on T331 deliberately deferred: table semantics so `aria-sort` is legal.
> T333 fixes a pre-existing keyboard bug T332 surfaced and correctly left alone. All four edit the
> same files — run them in order T330 → T331 → T332 → T333.

### T330 — Guest manager: replace pagination with a growing list (scroll + "Load more")
- **Status:** done — 2026-08-31. Verified independently by the coordinator
  (diff reviewed, gate re-run, baseline re-measured on a stashed tree). Pagination is gone —
  no `currentPage`/`pageSize`/`paginatedGuests`/`Math` and no `guest_manager.pagination` key
  survives. `shown`/`hasMore` + a `viewChild` scroll ref in `guest-manager.ts`; 5 new
  `guest_manager.list.*` keys in all three locales; 9 new specs. Suite went 419 → 428 passing
  with the same 9 pre-existing failures. Two things the implementer flagged rather than
  overclaiming: **keyboard operability is verified by construction and unit test, not in a
  browser** (no e2e exists), and `.table-body` became a scrollable region with no `tabindex`
  (WCAG 2.1.1) — **handed to T332**, which was already attaching a role to that element.
- **Owner:** agent (implementer)
- **Depends on:** — (independent of T320–T329; different screen area)
- **Why:** The design system dropped numbered pagination from the guest manager in favour of a
  list that grows as you scroll — `../wedding-ui-design` commit
  `6a76ebaaca9c36a0ab405cd6e91176610e8af7e8`, files `ui_kits/wedding-app/ScreenGuestManager.jsx`
  (desktop) and `ui_kits/wedding-app/ScreenGuestManagerMobile.jsx` (mobile). **Read both files
  yourself before starting; they are the source of truth for every number below.** This repo's
  screen is a single responsive component (`.table-header` is `display: none` until the 900px
  tier, `.table-row` swaps grid↔flex), so the two DS screens collapse into one task here.
- **FINDING — the windowing is client-side; do not invent an API parameter.** This screen reads
  `UserProfileDto` rows out of the shared `@ngrx/data` `UserProfile` collection. Its data service
  (`src/app/core/data/user-profile-data.service.ts`) calls the generated
  `WeddingUserProfileService.profileControllerGetAllV1()`, which takes **no request-parameter
  object at all** (only `observe`/`reportProgress`/`options`), and
  `UserProfileListResponseDto` is `{ profiles, notFoundIds? }` — no cursor, no total, no
  `hasMore`. `GET /v1/profile` returns the whole list in one response. So `shown` slices an array
  that is already in memory; there is no incremental fetch. (`GET /v1/guests` *does* take
  `cursor`/`limit` via `GuestsControllerListV1RequestParams` — it is **not** what this screen
  reads, and moving onto it is a data-layer migration with its own ADR, not this task.) Do not
  hand-edit anything under `src/app/core/api/`; no `pnpm gen:api` is needed. Rationale in full:
  **ADR W-0008**, which you must read first.
- **What changes (`guest-manager.ts`):**
  - Delete `currentPage`, `pageSize`, `paginatedGuests`, `totalPages`, `previousPage`,
    `nextPage`, `getCurrentPage` and the `protected readonly Math = Math` escape hatch that only
    existed for the pagination arithmetic.
  - Add `private static readonly BATCH = 12` (comment it as a **presentation** constant, not an
    API page size — ADR W-0008 §2), `private readonly shown = signal(GuestManager.BATCH)`, a
    `protected readonly visibleGuests = computed(() => this.sortedGuests().slice(0, this.shown()))`
    replacing `paginatedGuests`, and `protected readonly hasMore = computed(() => this.shown() <
    this.sortedGuests().length)`.
  - `loadMore()`: no-op when `!hasMore()`, otherwise `this.shown.update((n) => n + BATCH)`.
    **Synchronous — no `setTimeout`, no `loadingMore` flag.** The DS's 550 ms delay only exists to
    fake a network page (ADR W-0008 §3).
  - `onListScroll(event: Event)`: read `scrollHeight`/`scrollTop`/`clientHeight` off the target
    element and call `loadMore()` when `scrollHeight - scrollTop - clientHeight < 120` (the DS's
    exact threshold).
  - `setFilter`, `updateSearch` and `toggleSort` each reset `shown` to `BATCH` (they reset
    `currentPage` today — same call sites, new target) **and** scroll the list container back to
    `scrollTop = 0` via a `viewChild` element ref on `.table-body`. Without the scroll reset, a
    user who was at the bottom lands on a 12-row window with a clamped scroll position and can
    trigger an unasked-for grow (ADR W-0008 §6).
- **What changes (`guest-manager.html`):**
  - `@for` iterates `visibleGuests()`; the `@else` empty state is unchanged.
  - `.table-body` gets `(scroll)="onListScroll($event)"`.
  - After the rows, inside the scroll container: `@if (hasMore())` → a centred wrapper holding a
    real `<button type="button" class="load-more-btn" (click)="loadMore()">` labelled
    `guest_manager.list.loadMore`. It is a native `<button>`, so it is keyboard-reachable and
    Enter/Space work for free — do **not** add `(keydown.enter)`/`(keydown.space)` handlers
    (the copy-paste pattern elsewhere in this template double-fires on a real button).
  - `@if (!hasMore() && visibleGuests().length > BATCH)` → a centred `guest_manager.list.endOfList`
    line. Expose `BATCH` to the template as a `protected` member.
  - The whole `.pagination` block is replaced by a two-span footer, same
    `.pagination`-style bar: left span = `guest_manager.list.noResults` when
    `filteredGuests().length === 0`, else `guest_manager.list.showing` interpolated with
    `{ shown: visibleGuests().length, total: sortedGuests().length }`; right span =
    `guest_manager.list.scrollForMore` while `hasMore()`, empty otherwise. Rename the classes to
    `.list-footer` / `.list-footer-info` / `.list-footer-hint` so no `.pagination*` name outlives
    the feature.
  - The left span carries `aria-live="polite"` — it is the announcement that replaces the DS's
    visual "Loading…" swap (ADR W-0008 §4).
- **What changes (`guest-manager.scss`)** — all CSS in the file, class selectors only, tokens only
  (hard rules 1–3). Values are the DS's; match them exactly, do not approximate:
  - `.table-body` gains `min-height: 0` so it can actually scroll inside the flex column
    (`.table-container` is already `flex: 1; overflow: hidden`).
  - `.load-more-row`: `padding: 14px 4px` (default/mobile tier) → `padding: 16px` at the 900px
    tier; `display: flex; justify-content: center`.
  - `.load-more-btn`: `border-radius: var(--radius-pill)`; `border: 1px solid
    var(--border-hairline)`; `background: transparent`; `color: var(--text-muted)`;
    `font-size: 11.5px`; `letter-spacing: 0.04em`; `font-family: t.$font-sans`;
    `padding: 8px 16px` mobile → `7px 16px` at the 900px tier. Add `min-height: 44px` on the
    mobile tier only (WCAG 2.5.5; the DS's own mobile controls do this — see `GmSeg`'s
    `minHeight: 44` in `ScreenGuestManagerMobile.jsx`) and a `:focus-visible` ring matching the
    `.table-header .col-sort` one already in this file.
  - `.end-of-list`: `padding: 14px 4px` mobile → `16px` desktop; `text-align: center`;
    `font-size: 11px`; `color: var(--text-muted)`; `letter-spacing: 0.06em`.
  - Footer spans: `font-size: 11px` on both tiers (the current `.pagination-info` drops to 10px on
    mobile; the DS uses 11 on both), `color: var(--text-muted)`, `letter-spacing: 0.06em` mobile /
    `0.04em` desktop. Drop `.pagination-controls` and `.pagination-btn` entirely.
- **i18n — all three locale files (`public/i18n/es.json`, `en.json`, `fr.json`), ES is default.**
  Existing convention is `guest_manager.<group>.<camelCase>`. **Delete** the whole
  `guest_manager.pagination` group (`prev`, `next`, `of`, `noResults`) — grep confirms
  `guest-manager.html` is its only consumer — and add a `guest_manager.list` group:
  - `list.showing` — EN `"Showing {{shown}} of {{total}}"` · ES `"Mostrando {{shown}} de {{total}}"`
    · FR `"Affichage de {{shown}} sur {{total}}"`
  - `list.noResults` — EN `"No results"` · ES `"Sin resultados"` · FR `"Aucun résultat"`
  - `list.scrollForMore` — EN `"Scroll for more"` · ES `"Desplaza para ver más"` ·
    FR `"Faites défiler pour voir plus"`
  - `list.loadMore` — EN `"Load more"` · ES `"Cargar más"` · FR `"Charger plus"`
  - `list.endOfList` — EN `"End of list"` · ES `"Fin de la lista"` · FR `"Fin de la liste"`
  - **No `loading` / `loadingMore` keys.** They would be dead strings in three files — there is no
    asynchronous step to report (ADR W-0008 §3). If you find yourself wanting them, you have
    invented a fetch; stop and re-read the finding above.
- **Acceptance:**
  - Fresh render shows at most 12 rows; the 13th and beyond appear only after a scroll near the
    bottom or a "Load more" press. Each grow adds 12.
  - `hasMore` boundary: with exactly 12 matching guests neither the "Load more" button nor the
    "End of list" line renders; with 13, "Load more" renders; after growing past the end, "End of
    list" renders (and only when more than 12 rows are on screen, per the DS condition).
  - Changing filter, search or sort resets the window to 12 and the scroll position to the top.
  - The list is fully operable by keyboard alone: Tab reaches "Load more", Enter/Space activates
    it, and the whole list can be exhausted without a scroll wheel or a pointer.
  - `aria-live="polite"` on the "Showing X of Y" line; no `aria-busy` (there is no busy state).
  - **`lastSeen` stays couple-only and read-only (hard rule 16, hub ADR-0035/0036).** You are
    touching the header row and the footer; do not regress the gate. The `.col-last-seen` column
    and the `.last-seen-mobile` line are reachable only because `/guests` is behind `rbacGuard`
    with `roles: ['groom', 'bride']` (`src/app/app.routes.ts` L147-155) — the reason is already in
    `lastSeenLabel`'s TSDoc; leave it there. **Never** introduce a `profile.lastSeen != null`
    visibility condition, an edit control, or a clear button, and do not fold the column into any
    windowing/filter logic.
  - No API type is redeclared locally (hard rule 15) — rows stay `UserProfileDto`.
  - `guest-manager.spec.ts` covers: initial window is 12; "Load more" grows to 24; a scroll event
    within 120px of the bottom grows; a scroll event far from the bottom does not; the window
    resets to 12 after `setFilter`, after `updateSearch`, and after a header click; and the
    `hasMore` boundary at exactly 12 / 13 rows. Reuse the existing `createGuestManager` helper and
    the `.table-row .guest-name` row-name reader in that file. The existing "column sort" and
    "search matches on nickname" describes must still pass — update their references to
    `paginatedGuests` (a comment on L138 names it) rather than leaving them stale.
  - `pnpm typecheck && pnpm lint && pnpm test` all pass; no new lint errors beyond the 4 known
    pre-existing ones in `src/app/shared/modal/` (leave those alone). There is **no** e2e suite —
    nothing here gates on `pnpm test:e2e`.
- **Refs:** DS `../wedding-ui-design` commit `6a76ebaaca9c36a0ab405cd6e91176610e8af7e8`,
  `ui_kits/wedding-app/ScreenGuestManager.jsx` (desktop: `shown`/`BATCH`/`loadMore`/`onScroll`
  L53-77, scroll container L205, load-more + end-of-list L221-226, footer L231-236) and
  `ScreenGuestManagerMobile.jsx` (L50-69, L120, L137-142, L145-148); in-repo **ADR W-0008**;
  hub ADR-0035/0036 (`lastSeen`); CLAUDE.md hard rules 1-3, 5, 8, 14, 15, 16.
  Files: `src/app/screens/guest-manager/guest-manager.{ts,html,scss,spec.ts}`,
  `public/i18n/{es,en,fr}.json`. Read-only context:
  `src/app/core/data/user-profile-data.service.ts`,
  `src/app/core/api/api/wedding-user-profile.service.ts`,
  `src/app/core/api/model/user-profile-list-response-dto.ts`.

### T331 — Guest manager: align the sort affordance and the "Last seen" order with the DS
- **Status:** done — 2026-08-31. Verified independently by the coordinator
  (diff reviewed, gate re-run). All three deltas landed: inactive `▲` at `opacity: 0.35` (the
  `width: 8px` reservation hack is gone — it only existed because the inactive state rendered
  nothing), `.col-sort.active` → `var(--brand-accent)` with `.sort-icon` on `currentColor` at
  `9px`, and `compareByColumn`'s `lastSeen` branch reversed so ascending is most-recent-first
  with the never-signed-in sentinel last. 4 new specs pin **both** directions so the sign
  cannot silently flip back. 428 → 432 passing, same 9 pre-existing failures. The five
  pre-existing sort specs passed unchanged — no selector adjustment was needed. Out-of-scope
  list held: no `dietary`/`table` keys, `statusRank` still four-state, no `aria-sort`, no
  mobile sort control. **Not verified:** rendered appearance (source-level only, never diffed
  in a browser against the DS).
- **Owner:** agent (implementer)
- **Depends on:** T330 (same three files; sequence them, do not run in parallel)
- **Why:** T329's predecessor `fe9654f` ("feat: Implement sortable columns in Guest Manager
  table") already landed column sorting, and most of it matches the same DS commit
  `6a76ebaaca9c36a0ab405cd6e91176610e8af7e8`: the sortable key set is the same minus two columns
  that carry no data here, the default is guest/last-name ascending, a repeat click reverses, a
  new column restarts ascending, headers are real `<button>`s with a translated state-announcing
  `aria-label`, and the window resets on a sort change (T330 keeps that). **Do not redo any of
  that.** Three details still differ from the DS, and one of them is a wrong ordering.
- **What changes:**
  1. **The inactive-column arrow is missing.** DS `ScreenGuestManager.jsx` L200 renders a glyph on
     *every* sortable header: `▲` at `opacity: 0.35` when the column is inactive, `▲`/`▼` at
     `opacity: 1` when active. This repo renders an empty string when inactive
     (`guest-manager.html` L156-158 and the four sibling headers) and reserves the width in CSS.
     Render `▲` for the inactive state and drive the difference with `[class.active]` +
     `opacity` in `.sort-icon`. Keep `aria-hidden="true"` on the glyph — the `aria-label` already
     carries the state.
  2. **Active/inactive header colours are inverted relative to the DS.** DS: inactive label
     `var(--sub)`, active label `var(--accent)`. Here `.table-header .col-sort` goes to
     `var(--text-body-color)` on `.active` (and on `:hover`). Change the `.active` colour to
     `var(--brand-accent)`; leave the hover as-is (the DS prototype has no hover state to copy).
     `.sort-icon` should inherit `currentColor` instead of being hard-set to `var(--brand-accent)`
     on every header, and its `font-size` goes `8px → 9px` (the DS value).
  3. **"Last seen" ascending is currently backwards.** `compareByColumn`'s `lastSeen` case does
     `(a.lastSeen ?? '').localeCompare(b.lastSeen ?? '')`, so ascending puts never-signed-in first
     and then oldest→newest. The DS's `SEEN_RANK` (`ScreenGuestManager.jsx` L119) orders
     `Today, Yesterday, Last week, Last month, <dates>, Never` — i.e. ascending means **most
     recently seen first, never-signed-in last**. Reverse it: both missing ⇒ `0`; `a` missing ⇒
     after `b`; `b` missing ⇒ before `a`; otherwise `b.lastSeen.localeCompare(a.lastSeen)`. Note
     the sentinel must sort last in *ascending* and therefore first in descending — write the test
     for both directions so the sign is pinned.
- **Explicitly NOT in scope (decided, not forgotten):**
  - **The DS's `dietary` and `table` sort keys stay unimplemented.** Both columns render a static
    `—` placeholder here because `UserProfileDto.guestInfo.rsvp` is a summary that carries neither
    dietary data nor a table assignment (see the comments already in `guest-manager.html`
    L283-291). A sort control over a constant is a lie; leave them as plain `<div>` labels.
  - **The `status` rank stays as it is** (attending 0, pending 1, no-RSVP-record 2, declined 3).
    The DS only knows three states; this app has a real fourth (a guest with no RSVP document at
    all, which the `undefined` filter and `StatisticService` both count separately), and the
    existing spec `'on the status column, a guest with no RSVP record ranks between pending and
    declined'` pins the intended reading. Do not flatten it to the DS's `yes/pending/no`.
  - **No `aria-sort`.** It is only valid on an element with `columnheader`/`rowheader`/`gridcell`
    role inside a `table`/`grid` structure. This header is a CSS grid of `<button>`s and the rows
    below are `role="button"` click targets, not `role="row"`s — bolting `aria-sort` onto a
    `<button>` is ignored by assistive tech and trips axe's `aria-allowed-attr`. Making it valid
    means restructuring the whole table into `role="table"/"row"/"columnheader"`, which conflicts
    with the row-as-button interaction and is a separate, larger task. The shipped
    `sortAriaLabel()` (`"Sort by {{column}}, ascending"`) already announces column + direction on
    the control the user operates; that stays the mechanism.
  - **Mobile sorting.** DS mobile is always alphabetical by last name and has no headers; here the
    header row is `display: none` below 900px, so mobile is already pinned to the default
    last-name-ascending order. No change, and do not add a mobile sort control.
- **Acceptance:**
  - Every sortable header shows an arrow at all times; the active one is `var(--brand-accent)` at
    full opacity, inactive ones are `var(--text-muted)`-toned at `opacity: 0.35`; glyph
    `font-size: 9px`; `aria-hidden="true"` retained.
  - Sorting by "Last seen" ascending lists the most recently seen guest first and every
    never-signed-in guest last; descending is the exact reverse. New specs in
    `guest-manager.spec.ts` cover both directions and the all-missing case.
  - The five existing sort specs still pass untouched in intent (you may need to adjust a
    selector if the glyph markup changes — not the assertions).
  - **Hard rule 16 unchanged:** the "Last seen" header remains a sortable column only on a surface
    the couple alone can reach (route `guests`, `roles: ['groom','bride']`). Do not gate it on
    `profile.lastSeen` being present, do not add any control that writes or clears it, and do not
    describe it in code or i18n as a read receipt or an automation trigger (ADR-0035 §7/§8/§10).
  - `pnpm typecheck && pnpm lint && pnpm test` all pass; no new lint errors beyond the 4 known
    ones in `src/app/shared/modal/`.
- **Refs:** DS `../wedding-ui-design` commit `6a76ebaaca9c36a0ab405cd6e91176610e8af7e8`,
  `ui_kits/wedding-app/ScreenGuestManager.jsx` (sort state L52/L139, comparators L118-136, header
  buttons L196-203); commit `fe9654f` in this repo (what already exists); hub ADR-0035/0036;
  CLAUDE.md hard rules 3, 8, 14, 16.
  Files: `src/app/screens/guest-manager/guest-manager.{ts,html,scss,spec.ts}`.

### T332 — Guest manager: real ARIA table semantics so `aria-sort` becomes valid
- **Status:** done — 2026-08-31. Verified independently by the coordinator
  (diff reviewed, gate re-run). Built as decided: `role="table"` + `aria-label`, seven
  `columnheader` wrappers, `rowgroup` on `.table-body`, `row`/`cell` on the data rows, and the
  empty state / Load-more / End-of-list rows converted **in place** to
  `role="row"` > `role="cell" aria-colspan="7"`. `aria-sort` via a new `ariaSort()` on the five
  sortable headers, absent on `dietary`/`table`. `.table-row` lost `role="button"`/`tabindex`/
  keydown; the keyboard path is `.row-open-btn` in the first cell (`.guest-name` became a
  `span` — a `div` inside `<button>` is invalid content model), and `:focus` → `:focus-within`.
  `sortAriaLabel()` deleted (a single-branch version leaves `column` unused and trips lint);
  `guest_manager.sort.{ascending,descending}` removed from all three locales. T330's scroll
  region got `tabindex="0"` + a label + `outline-offset: -2px` (an outward ring is clipped by
  `.table-container { overflow: hidden }`); validity checked against `aria-query` —
  `rowgroup` supports `aria-label`, `cell` supports `aria-colspan`, `columnheader` supports
  `aria-sort`. 432 → 444 passing, same 9 pre-existing failures.
  **Deviation from this task, accepted:** the task authorised one scoped disable for
  `click-events-have-key-events`; **two** rules fire on that line — `interactive-supports-focus`
  as well, because `aria-query` gives `row` a widget superclass. One scoped
  `eslint-disable-next-line` names both, with a comment. The zero-disable alternative is a
  stretched-pseudo-element overlay instead of `(click)` on the row, not taken because this task
  specifies the row keeps a plain `(click)`.
  **Not verified:** screen-reader behaviour — *none of it*. No VoiceOver/NVDA here, no
  axe/pa11y/Lighthouse in the repo, no e2e; `pnpm lint`'s `templateAccessibility` set plus the
  12 new specs are the whole automated signal, and the manual AT pass is outstanding. Visual
  rendering also unverified: the grid item moved from the button to the `columnheader` wrapper
  and the CSS compensation was reasoned, not seen — **eyeball the desktop header row first.**
- **Owner:** agent (implementer)
- **Depends on:** T330, then T331 — all three edit `guest-manager.html`/`.scss`; run them in
  order, do not parallelise.
- **Why:** T331 deliberately did *not* add `aria-sort`, because it is only valid on an element
  whose role is `columnheader`/`rowheader`/`gridcell` inside a `table`/`grid`. Today the header is
  a bare CSS grid of `<button>`s and each row is a `role="button"` click target — putting
  `aria-sort` on those buttons is ignored by assistive tech and trips
  `@angular-eslint/template/valid-aria`. Making it valid means giving the whole thing table
  semantics *and* re-homing the "open this guest's profile" affordance, because a `role="row"`
  cannot also be a button. That reconciliation is this task. A screen-reader user currently hears
  seven unrelated buttons above an unstructured stack of clickable regions, with no column/row
  relationship and no sort state.
- **DECIDED — `role="table"`, not `role="grid"`.** `grid` obligates the full grid interaction
  contract: arrow-key navigation between cells, a roving tabindex, Home/End/Ctrl+Home, and a
  documented focus model. Nothing here is cell-navigable — the cells hold static text and the only
  interactive things are the sort buttons and one "open profile" control per row. `role="table"`
  is the static equivalent of `<table>`, permits interactive widgets inside its cells (exactly how
  a sortable HTML table works: `<th aria-sort><button>`), and is the minimum that makes `aria-sort`
  legal. Do not implement `grid`.
- **DECIDED — ARIA roles on the existing divs, not native `<table>` markup.** A native `<table>`
  would get the semantics free, but T330 makes `.table-body` the scroll container, and a
  scrollable `<tbody>` requires `display: block` on it, which destroys native table layout — at
  which point every role has to be restored by hand anyway. The layout is `display: grid` at the
  900px tier and `display: flex` below it; keep the DS layout exactly as T330/T331 leave it and
  attach roles to what is already there.
- **Structure to build (`guest-manager.html`):**
  - `.table-container` → `role="table"` + `[attr.aria-label]` from a new
    `guest_manager.table.ariaLabel` key. Do **not** reuse the visible `guest_manager.header.meta`
    string — an a11y name that silently follows display copy is a trap.
  - **No `aria-rowcount`/`aria-rowindex`.** They exist for partially-rendered lists and T330's
    window is exactly that, but the rendered rows *are* the complete set the user chose to load,
    the `aria-live` "Showing X of Y" line already carries the remainder, and mixing the
    load-more/end-of-list rows into an indexed sequence is an off-by-one waiting to happen for no
    user-visible gain. Deliberate omission — do not add them.
  - `.table-header` → `role="row"`. Each of its seven children becomes a
    `<div role="columnheader" class="col-…">` **wrapper**; the five sortable ones contain the
    existing `<button class="col-sort">` unchanged in behaviour, the two static ones
    (`dietary`, `table`) contain their plain label text. The button must not itself carry
    `role="columnheader"` — that would override its button semantics and lose the control.
  - `.table-body` → `role="rowgroup"` (it stays the scroll container; T330's `(scroll)` binding
    and `viewChild` ref are unaffected).
  - `.table-row` → `role="row"`; its seven child divs → `role="cell"`.
  - **The empty state, T330's "Load more" wrapper and T330's "End of list" line each become a
    `role="row"` containing one `role="cell"` with `aria-colspan="7"`** — the ARIA equivalent of
    `<tr><td colspan="7">`, which is what they already are visually. This is what keeps the
    `rowgroup`'s required children valid without moving them out of the scroll container and
    changing T330's layout.
- **The row-as-button conflict — how the affordance survives:**
  - `.table-row` **loses** `role="button"`, `tabindex="0"`, `(keydown.enter)` and `(keydown.space)`.
  - The keyboard/AT path becomes a real `<button type="button" class="row-open-btn">` inside the
    first cell, wrapping the guest name (and nickname) so its accessible name *is* the guest's
    name — "Laura Mendoza" — rather than a generic "open profile". Its `(click)` calls
    `$event.stopPropagation()` then `openGuestProfile(profile.id)`.
  - The row keeps a plain `(click)` so a pointer user can still hit anywhere across the row, as
    the DS row does. `@angular-eslint/template/click-events-have-key-events` may now flag that
    `(click)` on a non-interactive element; **first check whether it actually fires** — if it does,
    add exactly one scoped
    `<!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events -->`
    with a comment stating that the keyboard path is the `<button>` inside the first cell, which
    the rule cannot see. Do not silence any other rule, and do not disable at file scope.
  - **Styling (`guest-manager.scss`):** `.row-open-btn` resets to an inline control —
    `background: transparent; border: none; padding: 0; margin: 0; font: inherit; color: inherit;
    text-align: left; cursor: pointer` — so the row looks identical to today. The current
    `.table-row:focus` treatment (`background-color: var(--surface-card)` +
    `box-shadow: inset 0 0 0 2px var(--brand-accent)`) moves to `.table-row:focus-within`, so
    focusing the inner button still lights the whole row rather than ringing just the name. Give
    `.row-open-btn` `outline: none` only where `:focus-within` already provides the visible
    indicator — never remove the indicator outright (hard rule 14). The desktop `:hover` rule is
    pointer-only and stays as-is.
  - Header CSS: the grid item is now the `role="columnheader"` wrapper, so `.table-header .col-*`
    keeps the grid/typography styling and `.table-header .col-sort` (the button) becomes a
    `width: 100%` child of it, keeping its `display: flex`, gap, reset and `:focus-visible` ring.
- **`aria-sort` proper:**
  - `[attr.aria-sort]` on the five sortable `columnheader` wrappers: `"ascending"` / `"descending"`
    on the active column, `"none"` on the other four. **Omit the attribute entirely** on the
    `dietary` and `table` headers — `none` claims "sortable, not currently sorted", which would be
    a lie about columns that hold a constant `—` (T331).
  - **`sortAriaLabel()` is trimmed, not kept as-is.** With direction now on `aria-sort`, the
    active-state labels ("Sort by Guest, ascending") double-announce it. The button's accessible
    name becomes always `guest_manager.sort.by` ("Sort by {{column}}"); `sortAriaLabel()` collapses
    to that single branch or is replaced by an inline `translate` call with params. The now-unused
    `guest_manager.sort.ascending` and `guest_manager.sort.descending` keys are removed from all
    three locale files (`public/i18n/{es,en,fr}.json`) — grep to confirm no other consumer first.
- **Responsive tier — stated, not left open.** The roles are static in the template; **do not**
  branch semantics on a viewport (that would need a media-query listener in TS, i.e. a hardcoded
  breakpoint, against hard rule 4). Below 900px `.table-header` is `display: none`, so the whole
  `row` of `columnheader`s is removed from the accessibility tree — that is correct, not a bug: a
  `role="table"` is valid with no header row. Likewise `.col-adults`/`.col-children`/`.col-dietary`/
  `.col-table`/`.col-last-seen` are `display: none` there, so mobile rows genuinely expose two
  cells, matching the two columns of content actually on screen. **Do not** "fix" the hidden
  headers with `visibility: hidden`, an sr-only clone, or `aria-hidden` juggling — a hidden
  columnheader that is still in the tree would describe columns the mobile user cannot perceive.
  The table's `aria-label` carries the identification on both tiers.
- **Verification — no automated a11y audit exists in this repo; do not write acceptance that
  pretends otherwise.** Confirmed against `package.json`: there is no `axe-core`, no `jest-axe`,
  no `pa11y`, no Lighthouse step, and no e2e suite. What *does* exist is
  `angular.configs.templateAccessibility` in `eslint.config.js`, which includes `valid-aria` and
  `role-has-required-aria` — so `pnpm lint` is a partial automated signal (it is the rule set that
  would have rejected `aria-sort` on a `<button>`), and it must stay clean.
- **Acceptance:**
  - New specs in `guest-manager.spec.ts`: `.table-container` has `role="table"` and a non-empty
    `aria-label`; there are exactly 7 `[role="columnheader"]`; by default the guest header has
    `aria-sort="ascending"`, the other four sortable headers `"none"`, and `dietary`/`table` have
    no `aria-sort` attribute at all; clicking the guest header flips it to `"descending"`;
    clicking the adults header sets `aria-sort` on adults and returns guest to `"none"`; a data
    row has `role="row"` with 7 `[role="cell"]` children; `.table-row` has neither
    `role="button"` nor `tabindex`; `.col-guest button.row-open-btn` exists, its text content is
    the guest's name, and clicking it opens the profile (reuse whichever
    modal-open assertion the existing `describe`s already use).
  - **The five existing sort specs must keep passing.** Their `clickHeader` helper queries
    `.table-header .col-${column}` and casts it to `HTMLButtonElement`; after the wrap that
    selector returns the wrapper div. Update the helper to
    `.table-header .col-${column} .col-sort` — change the helper, not the assertions.
  - Manual check, recorded in the PR description: Tab reaches every sort button and one
    `.row-open-btn` per row in DOM order; VoiceOver on macOS Safari announces the table, the
    column headers with their sort state, and row/cell position; iOS Safari (mobile tier)
    announces the rows without phantom columns.
  - `lastSeen` gating is unchanged (hard rule 16): the "Last seen" column stays couple-only via
    the existing route gate (`guests`, `roles: ['groom','bride']`), never via
    `profile.lastSeen != null`, and gains no write/clear control while its header is being
    restructured.
  - `pnpm typecheck && pnpm lint && pnpm test` all pass. `lint` shows no new errors beyond the 4
    known pre-existing ones in `src/app/shared/modal/` — leave those alone. No `pnpm test:e2e`
    (it does not exist).
- **Note on size:** this is one PR at its upper bound, and it is deliberately not split. The
  restructure is indivisible — `role="table"` without cells and rows, or `aria-sort` without
  `columnheader`s, is an invalid tree, so any intermediate commit would ship worse semantics than
  the current state. If it grows past what one review can hold, stop and report rather than
  landing half of it.
- **Refs:** T331 (which declined `aria-sort` and why), T330 (the load-more/end-of-list rows this
  must wrap); WAI-ARIA `table` / `columnheader` / `aria-sort`; `eslint.config.js`
  (`angular.configs.templateAccessibility`); CLAUDE.md hard rules 1-4, 8, 14, 16.
  Files: `src/app/screens/guest-manager/guest-manager.{ts,html,scss,spec.ts}`,
  `public/i18n/{es,en,fr}.json`.

### T333 — Guest manager: remove the double-firing keydown bindings on native buttons
- **Status:** done — 2026-08-31. Verified independently by the coordinator, including a
  **mutation check**: re-injecting a single `(keydown.enter)` on the `lastName` header flipped
  exactly one spec to red (`expected 'ascending' to be 'descending'`, 10 failed / 448 passed),
  and reverting restored 9 / 449. The specs genuinely catch the bug rather than passing either
  way. All 22 bindings gone from the 11 native-`<button>` hosts (`grep -c keydown` on
  `guest-manager.html` is now **0**); all 14 `(click)` handlers intact; no `.ts`, `.scss` or
  i18n change. 5 new specs in a `T333` describe, each dispatching **keydown then click** to
  model what the browser does — jsdom does not synthesize the click, so a keydown-only spec
  would have passed before and after and proved nothing. The two latent hosts assert a
  `vi.spyOn` call count of exactly 1, not DOM state, because `GuestCreateModal.open()` and
  `setFilter` are idempotent and a DOM assertion would pass with the bug present. 444 → 449
  passing, same 9 pre-existing failures. **Lint fired nothing on `guest-manager.html`** — neither
  `click-events-have-key-events` nor `interactive-supports-focus` demanded the bindings back, so
  no disable comment was needed (verified by reading the output, not by reasoning).
  **Wider scan, reported not fixed:** no out-of-scope instance of this bug exists. Every other
  `keydown` binding in `src/app/**/*.html` is either a `<div role="button">` host (where it is
  the only keyboard path), an `<input>` (submit-on-Enter, hard rule 9), or the **inverse**
  pattern in `confirm-dialog.html` / `notification-dialog.html`, where a bare `(keydown)` guard
  *suppresses* duplicate activation from auto-repeat. All correct as they stand.
  **Not verified:** that a real browser synthesizes the click these specs dispatch by hand —
  asserted by construction; jsdom is the only runner and no e2e suite exists.
- **Owner:** agent (implementer)
- **Depends on:** T330, T331, T332 (all `done` — same file; this is a follow-on, not a revision of
  any of them)
- **Why:** Found while implementing T332 and correctly left alone as out of scope. A native
  `<button>` that carries **both** `(click)` and `(keydown.enter)`/`(keydown.space)` runs its
  handler **twice** per key press: the keydown binding fires, and the browser then dispatches its
  own synthetic `click` for the same key (on keydown for Enter, on keyup for Space). The keydown
  bindings are pure redundancy — a native `<button>` is keyboard-activatable with no help at all.
- **Severity, measured per handler — say it accurately, it changes what the specs must assert:**
  - **User-visible and broken today: the five sort headers.** `toggleSort` is a *toggle*, so two
    invocations cancel — the direction flips and flips straight back. **A keyboard user pressing
    Enter on a column header sees nothing happen at all.** Sorting by keyboard is, in effect,
    dead on this screen.
  - **Latent, not currently user-visible: "add guest" and the five filter chips.**
    `addNewGuest()` → `GuestCreateModal.open()` (`modal/guest-create-modal.ts` L233-244) resets
    the form and sets an `isOpen` signal, so a second invocation re-resets an already-blank form
    and re-sets a signal that is already `true` — one modal, not two. `setFilter` is likewise
    idempotent. Both are still genuine double-invocations and become defects the moment either
    handler stops being idempotent (an analytics event, a focus-trap push, a fetch, a toast). Fix
    them in the same pass, but **do not write acceptance claiming a visible add-guest bug that
    does not currently exist** — the honest assertion is "the handler ran exactly once".
- **What changes — `src/app/screens/guest-manager/guest-manager.html` only.** Delete the 22
  redundant bindings on these 11 native `<button>` hosts (line numbers verified against the file
  as it stands after T332; re-grep before editing, do not trust the numbers blind):
  - filter chips — L63-64, L74-75, L85-86, L96-97, L107-108 (`setFilter`)
  - add guest — L131-132 (`addNewGuest`)
  - sort headers — L171-172, L195-196, L219-220, L243-244, L273-274 (`toggleSort`)
  Leave every `(click)` exactly as it is. No `.ts` change, no `.scss` change, **no i18n change —
  no strings are added, removed or altered by this task.**
- **The pattern to match, already correct, do not touch:** `.row-open-btn` (L318-323) and the
  Load-more button (L401-403), both added by T330/T332 — native `<button>`s with a `(click)` and
  no keydown binding.
- **Proving the bug — read this before writing the spec, it is the crux.** The tests run in
  **jsdom** (`package.json` devDependency; there is no browser test runner). **jsdom does not
  synthesize a `click` from a `keydown` on a native button.** So a spec that merely dispatches
  `keydown` will observe *one* handler call and pass identically before and after the fix,
  proving nothing — exactly the unfalsifiable test this task exists to avoid. Model what the
  browser actually does: **dispatch the `keydown`, then dispatch the `click`**, on the same
  element, in one test.
  - Before the fix, on a sort header: 2 × `toggleSort` ⇒ direction unchanged.
  - After the fix: keydown does nothing, click toggles once ⇒ direction changed.
  There is in-repo precedent for simulating real browser key sequences in a spec, including the
  reasoning comment style — see `src/app/shared/confirm-dialog/confirm-dialog.spec.ts` L140-159.
  State this reasoning in a comment on the new specs so the next person does not "simplify" them
  back into uselessness.
- **Acceptance:**
  - New spec in `guest-manager.spec.ts`: a `keydown` (Enter) **followed by** a `click` on
    `.table-header .col-guest .col-sort` changes the rendered row order (or the header's
    `aria-sort`, which T332 now exposes and which is the cleaner assertion). Confirm it **fails on
    the current code** and passes after the deletion — if it passes before the fix, the spec is
    wrong, not the bug. Repeat for Space if cheap.
  - New spec: the same keydown-then-click sequence on the add-guest button invokes
    `GuestCreateModal.open` **exactly once** — spy on the modal instance's `open` and assert the
    call count. Do **not** assert "one modal is in the DOM": that passes with the bug present and
    proves nothing.
  - `guest-manager.spec.ts`'s existing `clickHeader` helper (two copies, L152-158 and L723-729,
    both already pointing at `.table-header .col-${column} .col-sort` after T332) still drives the
    five shipped sort specs unchanged. Extend it with a sibling keyboard helper rather than
    changing its behaviour. No existing spec anywhere dispatches keydown at a guest-manager
    element, so nothing else can break on the deletion — verified by grep.
  - **Verify, do not assume, that lint stays clean without the bindings.**
    `@angular-eslint/template/click-events-have-key-events` only fires on non-interactive hosts,
    so a native `<button>` should need nothing — but T332 already hit a case where the predicted
    rule set was wrong (`interactive-supports-focus` also fired on `role="row"`), so run
    `pnpm lint` and read the output rather than reasoning about it. If a rule does demand the
    bindings back, **stop and report** — do not add a disable comment to force this through.
  - Gate: `pnpm typecheck && pnpm lint && pnpm test`. Baseline after Phase W, to compare against:
    `lint` exits 1 with exactly the 4 known pre-existing errors in `src/app/shared/modal/` (leave
    them alone); `test` is 9 failed / 444 passed of 453, the 9 pre-existing in `rsvp.spec.ts`,
    `rsvp-editor.spec.ts` and `manage-rsvp-modal.spec.ts` and **not** this task's to fix. This
    task must move the pass count up and the fail count not at all. No e2e suite exists.
  - Repo-only change: no `pnpm gen:api`, nothing under `src/app/core/api/`, all CLAUDE.md hard
    rules apply.
- **Explicitly NOT in scope — recorded so it is not lost, and not silently widened:**
  - **`<div role="button">` hosts, where the keydown handler is the only keyboard path.** Removing
    it would break keyboard access outright. Verified: `seating-plan.html` L152-159 (the "Rename
    table" div, `role="button" tabindex="0"`), `milestones.html` L105 and L223. Do not touch.
  - **`<input>` hosts, where keydown-on-Enter *is* the submit-on-Enter behaviour hard rule 9
    requires.** Verified: `seating-plan.html` L149, `config-manager.html` L787/L864,
    `rsvp-editor.html` L258. Do not touch.
  - **Conditionally-interactive `<div>`s — a different problem, deliberately deferred.**
    `people.html` L41-48 (`[attr.role]="isMine(person) ? 'link' : null"` +
    `[attr.tabindex]`) and `seating-plan.html` L131-138
    (`[attr.role]="canAssign(table) ? 'button' : null"`) carry `(click)` plus keydown on a plain
    `div` whose role and focusability appear only under a condition — so when the condition is
    false they are click targets with no role, no tabindex and no keyboard path at all. Real, but
    a distinct concern (non-semantic interactive elements) with its own fix (make them real
    `<button>`/`<a>`), and `people.html` additionally binds `keydown.space` to a `role="link"`,
    which links do not activate on Space. Leave both alone here; they want their own task.
  - **Widening the sweep.** The scan behind this task covered `src/app/**/*.html`. If you find the
    same `(click)` + `(keydown)`-on-a-native-`<button>` pattern outside that set (an inline
    template, a component added since), **report it — do not fix it in this PR.** The value of
    this task is that its blast radius is known and one file wide.
- **Refs:** T332 (where the bug was found and correctly deferred); T330/T331 (same file — this
  lands on top of both); `src/app/shared/confirm-dialog/confirm-dialog.spec.ts` L140-159 (browser
  key-sequence simulation precedent); `src/app/screens/guest-manager/modal/guest-create-modal.ts`
  L233-244 (why add-guest is latent, not visible); CLAUDE.md hard rules 9 and 14.
  Files: `src/app/screens/guest-manager/guest-manager.html`,
  `src/app/screens/guest-manager/guest-manager.spec.ts`. Nothing else.

### T334 — Guest manager: adopt a `limit` once the counts are server-side
- **Status:** blocked — waiting on `wedding-api` T235
- **Owner:** unassigned
- **Depends on:** `wedding-api` T235 (server-computed guest counts); ADR W-0009 (this screen is
  already cursor-driven and needs no rework to start paging)
- **Why:** ADR W-0009 wired every growth affordance to the API's `nextCursor`, but the screen still
  reads with **no** `limit`, so the API returns the whole collection, `nextCursor` is always `null`
  and "Load more" never renders. That is correct today — one call returns everything, so no second
  call is needed — and it stays correct until the two client-side aggregations below move server-side.
- **The coupling, stated so nobody "fixes" this by adding a page size on its own:**
  - The header tiles and every filter-chip badge come from `StatisticService`, which aggregates over
    the **entire** `UserProfile` collection. Under paging they read low until the last page lands.
  - Search and the status filters match client-side over loaded rows, so a paged list silently fails
    to find a guest who has not been fetched yet.
- **Acceptance:**
  - `StatisticService` reads the server aggregate (`wedding-api` T235) instead of folding over the
    collection; the tiles and chip badges are correct with only one page loaded.
  - The guest manager's list read passes a `limit`; "Load more", the scroll trigger and the
    end-of-list line light up with **no template change** — that is the design W-0009 shipped, and a
    template diff here means something regressed.
  - Decide and record what search does across unfetched rows: either server-side search, or an
    explicit, translated UI statement that search covers loaded guests only. **Do not ship silent
    partial search.**
  - Existing T330 cursor specs still pass; add specs for a first page + a `limit` on the wire.
  - `pnpm typecheck && pnpm lint && pnpm test` green, with only the documented pre-existing failures.
- **Refs:** ADR W-0009 §6 and "Why the screen cannot adopt a `limit` yet"; hub ADR-0038

### T335 — Couple: grant and revoke a delegation, with the required kind (desktop + mobile)
- **Status:** done
- **Owner:** unassigned
- **Depends on:** `wedding-api` T238 (the `{id, kind}` contract)
- **Why:** hub ADR-0039. The couple is the **only** author of a delegation, and today no screen in
  any repo can create one. Hard rule 18 governs this task.
- **Acceptance:**
  - Control lives in the couple's guest **profile editor**, and ships on **desktop and mobile in the
    same task**. `ScreenGuestManagerMobile.jsx` draws nothing here — build it anyway; half a grant
    surface is worse than none on the device the couple carries.
  - Search-and-pick over the guest list (empty until typed, ≤8 matches, self excluded, already-picked
    excluded, "No matching guests." empty result), **then a required second step: what is this person
    to the guest?** — `father | mother | brother | sister`, translated, no free text, no "other", no
    default. The DS draws no kind picker; compose one from existing primitives rather than waiting.
  - **Never offer the guest `relation.link` options here** (33 values, anchored to the couple) — hard
    rule 18(b).
  - Grant and removal accumulate in the profile **draft**: written by Save, discarded by Cancel, no
    separate confirmation, riding the existing envelope `version` and its 409 handling.
  - Profile **view** gets the read-only "RSVP answered by" field — name + kind per entry, accented
    when non-empty, `—` when empty.
  - The picker has a loading and an error state. `DelegationField.jsx` has neither; that is a gap in
    the mock, not a design decision.
  - ES/EN/FR copy for every string, including both empty states. Unit specs for the required-kind
    gate (Save is blocked with a name and no kind).
- **Non-goals:** no guest-side grant (hard rule 18(a)); no bulk grant; no notification; no "who does
  this guest answer for" inverse view.
- **Refs:** hub ADR-0039 §8, §12; `SPEC.md` J4a; hard rule 18

### T336 — Guest: read-only "who answers for you" on the profile modal
- **Status:** done
- **Owner:** unassigned
- **Depends on:** T335 (shares the display half of the control, `src/app/shared/delegate-chips/`,
  and its i18n keys); `wedding-api`'s extension of `UserProfileSchema`/`UserProfileDto` to carry
  `delegateTo` — both done
- **Why:** hub ADR-0039 — the arrangement must never be invisible to the person it is about. Read-only
  in **all** modes, including edit mode: the guest-side picker in `ProfileModal.jsx` is cut.
- **Acceptance:**
  - Chips showing each delegate's name **and the kind, rendered subject-side** ("Laura Mendoza · mi
    hermana") — this is the side where the kind is meaningful and translates (hard rule 18(c)).
  - No remove `×`, no picker, no search, in any mode.
  - Empty state: "Nobody answers for you — only you can reply." (ES/EN/FR).
  - Do **not** ship `ProfileModal.jsx:58`'s "The couple can also set this up on your behalf" — that
    describes a screen that is not being built.
- **Non-goals:** granting; resigning; showing who last answered (`submittedBy` is out of scope,
  ADR-0039 §10).
- **Refs:** hub ADR-0039 §6, §8, §10; `SPEC.md` → Users → Guest

### T337 — Delegate: the RSVP hub, names only, no relation line
- **Status:** done
- **Owner:** unassigned
- **Depends on:** `wedding-api` T239 (the mirror read), T336 (shared i18n keys)
- **Why:** hub ADR-0039 §6. A guest holding at least one delegation gets a hub instead of a bare
  editor: own reply first, then one card per subject. **No new endpoint** — `GET /v1/rsvp` already
  returns exactly the delegated RSVPs for a non-couple caller.
- **Acceptance:**
  - With **zero** delegations the RSVP screen is byte-for-byte what it is today. The hub is additive
    to J2, never a replacement — assert this with a spec.
  - Each card: the subject's party label (from the RSVP's own adults — it may name two people when a
    linked couple shares one reply), the state (Confirmed / Declined / Not answered yet), and the
    party size once answered. A header count of what is still outstanding.
  - **No relation line, on any card** (hard rule 18(c)). `meta={d.relation}` and the mock's "My
    parents" / "My grandmother" render data the API does not return and cannot return.
  - Opening a card opens the existing shared editor headed on-behalf-of with the subject's **name**,
    third-person copy ("They can't make it"), and a back link. Use the editor's `delegate`
    perspective labels, not `owner`.
  - The deadline blocks a delegate like any non-admin (410) — surface it the same way the guest's own
    editor does. Do not render the mock's hardcoded "Edit anything until 1 May"; the date is the
    CONFIG row's.
  - ES/EN/FR, including the pluralised outstanding-count sentence (a string switch will not survive
    three locales — use the i18n plural machinery).
- **Non-goals:** resigning a delegation; any write to `delegateTo`; per-item deep links from the
  profile mirror list.
- **Refs:** hub ADR-0039 §3, §6, §7; `SPEC.md` J3; hard rule 18

### T338 — One reading of a missing `attending`, and comments that match the schema
- **Status:** done
- **Target release:** 1.1.1
- **Owner:** unassigned
- **Depends on:** nothing
- **Why:** hub **ADR-0040**. `attending` is now required on every adult member, but the helpers still
  carry two opposite readings of its absence, written when it was optional:
  `adultHeadCount()` treats a missing flag as **not coming** (`=== true ? 1 : 0`), while
  `isPersonComing()` treats the identical absence as **coming** (`!== false`). Both are in
  `src/app/core/`, both feed the couple's numbers, and they cannot both be right. The attribute is
  required now, so absence should be unrepresentable rather than quietly meaning two things.
- **Acceptance:**
  - `isPersonComing()` and `adultHeadCount()` agree on what an absent `attending` means, and the one
    that is chosen is stated in the doc comment with the reason. Prefer reading the generated type
    (`attending: boolean`, non-optional) and treating absence as a defect rather than a state — but
    do not throw in a computed that feeds a screen.
  - The stale sentence *"a `kind: 'plus-one'` carries no `attending` flag and always counts"* is gone
    from `adultHeadCount()`'s doc comment (`statistic.service.ts`). It describes the pre-a97cbf2
    schema; the code below it already stopped doing that.
  - `canDeclineAlone()`'s doc comment keeps its **child** clause — `RsvpDtoChildrenInner` genuinely
    has no `attending` field, that is correct and deliberate (ADR-0040 §Decision) — and drops or
    rewrites any claim about the plus-one carrying no flag. Whether a plus-one *may* decline is T339;
    this task only stops the comments asserting something the contract contradicts.
  - `rsvp-draft.spec.ts` covers a member with `attending: false` and one with `attending: true` for
    each adult slot, so the chosen reading is pinned by a test.
- **Non-goals:** no behaviour change to the party editor; no change to `attendingCount()`'s
  solo-decline rule (ADR W-0007 §Amendment.3 accepted that knowingly).
- **Refs:** hub ADR-0040 §3/§4; `src/app/core/service/statistic.service.ts` → `adultHeadCount()`;
  `src/app/core/helper/rsvp-draft.ts` → `isPersonComing()`, `canDeclineAlone()`

### T339 — Can a plus-one decline? A required flag the editor cannot set
- **Status:** done — decided **(b) decline** (Product Owner, 2026-09-02); outcome written into hub ADR-0040 §4
- **Target release:** 1.1.1
- **Owner:** Product Owner (the decision), then unassigned (the implementation)
- **Depends on:** T338 (comments first, so the code states the current rule honestly)
- **Why:** hub **ADR-0040 §4**, which names this and deliberately does not settle it.
  `attending` is now **required** on a `kind: 'plus-one'` partner, but `canDeclineAlone()` returns
  `false` for that member type unless they hold an account, so the editor offers no control to set it
  and the value is in practice always `true`. Either the field means something for a plus-one — and
  the editor should let it be toggled — or it is structurally always true, and the normalization
  gained uniformity of shape without uniformity of meaning. Both are defensible; leaving it
  undecided is what is not.
- **The decision to make:** a plus-one is a named person with **no account**, invited as somebody's
  guest. If they drop out, is that (a) the inviting partner editing the party — removing the
  plus-one entirely — or (b) a decline, keeping the name with `attending: false`?
- **Acceptance (once decided):**
  - If **(a) removal is the answer:** no UI change. `canDeclineAlone()` keeps returning `false` for a
    plus-one, and a comment says *why* it is structurally always `true` rather than leaving the next
    reader to infer it from a missing branch. `wedding-api` T241 still matters — the API must not
    count a `attending: false` plus-one that some other writer could produce.
  - If **(b) decline is the answer:** the editor renders the same decline control it renders for an
    account-holding partner, `canDeclineAlone()` returns `true` for a plus-one, `impliedStatus()` and
    `attendingCount()` are checked against a party whose only second adult is a declined plus-one,
    and ES/EN/FR copy is added for the third-person case.
  - Either way the outcome is written back into hub ADR-0040 §4 so the question is closed on the
    record, not just in code.
- **Non-goals:** no change to who may edit the party; no new member type; no contract change —
  `attending` is already required on both `partner2` variants.
- **Refs:** hub ADR-0040 §4; `src/app/core/helper/rsvp-draft.ts` → `canDeclineAlone()`,
  `partnerHasAccount()`; ADR W-0007 §Amendment.3

---
