## Phase R — Design-system update (`wedding-ui-design` 8699c8c)

> **Why this phase exists.** DS commit `8699c8c` ("venue line on timeline, live maps on Travel,
> all-languages config editor") lands three changes the app has to follow. Two of them need **no**
> contract change — the fields already exist on `WeddingConfigResponseDto` and just aren't read yet.
> The third (Travel) is scoped down deliberately: see T296.
>
> **Read the DS diff before starting**: `git -C ../wedding-ui-design show 8699c8c`. The commit body is
> the spec; the JSX is the reference rendering, not code to port literally.
>
> **Two DS field names do not exist in this app and must not be created** (hard rule 15):
> - DS `agenda[].important` **is** the existing `CreateWeddingConfigDtoAgendaItemsInner.highlight`.
>   Same meaning ("what surfaces on the home screen"), same default. `invitee.html` already filters
>   the home preview on it. Use `highlight`. Do not add `important` anywhere.
> - DS `cfg.languages[].on` has no counterpart. Hub ADR-0009 fixes the set at **es / en / fr** with no
>   disable switch; `WeddingConfigResponseDto.language` is a label map, not on/off flags. Wherever the
>   DS says "enabled languages", render all three. Do not invent an enable flag.

### T295 — Venue name on every timeline row
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing — no contract change, no API work
- **Why:** ceremony and reception are at different addresses. The venue has to be visible *per
  moment*, not once per page, or a guest reads the whole timeline as happening in one place.
- **Acceptance:**
  - `shared/timeline-item` gains an optional `venue = input('')`, rendered as a **second** subtitle
    directly under `sub`, and **only when non-empty**. Per DS `TimelineItem.jsx`: `var(--text-micro)`
    (11px), `var(--text-muted)`, `letter-spacing: 0.04em`, `opacity: 0.85`, `margin-top: 3px`. The
    existing `@if (sub())` guard stays — a row with neither line renders neither.
  - The name is resolved **client-side** by joining the agenda item's existing `venueId` against
    `weddingConfig().venues[].name`. `venueId` is `string | null`; an unmatched or null id yields
    an empty string and the line simply does not render. **No new API field, no `venue` string on
    the agenda item** — hard rule 15.
  - Rendered on **both** timeline surfaces: `screens/schedule` (full schedule) and `screens/invitee`
    (home preview, the `event.highlight` block at `invitee.html:94`).
  - Venue names are couple-authored data, **not** translated — no new i18n keys, no `translate` pipe
    on the value.
  - Unit tests: venue line renders with a matching `venueId`; absent with `null`; absent with an id
    matching no venue; `sub` and `venue` both render together in the right order.
  - Full pre-merge gate green (`pnpm typecheck && pnpm lint && pnpm test`).
- **Refs:** DS `8699c8c` → `components/data-display/TimelineItem.jsx`, `TimelineItem.d.ts`,
  `schedule.data.js`; `src/app/core/api/model/create-wedding-config-dto-agenda-items-inner.ts`
  (`venueId`), `create-wedding-config-dto-venues-inner.ts` (`name`)

### T296 — Travel screen on real config data, with an address-driven embedded map
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing — deliberately scoped to today's contract (see *Out of scope* below)
- **Why:** `screens/travel` is still hardcoded English mock data (`travel.ts` `stays` array,
  `travel.html` literals) with no config wiring — the one screen that never got connected. The DS
  change replaces its hand-drawn SVG with a live map; doing that means reading real places first.
- **Acceptance:**
  - The screen reads `WeddingConfigResponseDto` from the existing `EntityNamesEnum.WEDDING_CONFIG`
    collection (same pattern as `screens/schedule`). The hardcoded `stays` array is gone.
  - **Two lists**, per DS: **Venues** (from `config.venues[]`) above **Stays nearby** (from
    `config.hotels[]`). The venue no longer appears as a row in the stays list.
  - Selecting any row re-centres the map and highlights that row. Rows are real `<button>`s with
    `aria-pressed`, reachable and operable by keyboard (hard rule 14). First row selected by default.
  - **The map is an address-driven pin embed**, built from fields that exist today:
    - venue → `https://www.google.com/maps?q=<encodeURIComponent(address, postalCode city, country)>&output=embed`
    - hotel → same, from `<name>, <config.city>` (hotels carry no address; `name` + city is the best
      the contract allows)
    - `loading="lazy"`, `referrerpolicy="no-referrer"`, and a translated `title` on the `<iframe>`.
  - The selected place's name overlays the map as a pill, per DS: `pointer-events: none`, single
    line, ellipsised.
  - Layout per DS: wide — sticky map beside the list; narrow — short map above a scrolling list.
    Follow the wide/narrow pattern already in `travel.scss`; **no new hardcoded breakpoints**
    (hard rule 4).
  - **ES/EN/FR** (hard rule 8). `travel.*` keys already exist in `public/i18n/*.json` but the template
    ignores them — every string in `travel.html` goes through `translate`. Add keys for the Venues
    heading and the map title; drop the now-dead `travel.venue` / `travel.river` SVG labels.
  - The SVG illustration and its `travel.scss` rules are removed, not left dormant.
  - Empty states: a config with no venues, or no hotels, renders the screen without a broken or
    blank map.
  - Unit tests: lists build from config; selecting a row changes the embed `src`; empty config
    renders without error.
  - Full pre-merge gate green.
- **Out of scope — do not build, do not ask the API for it:**
  - **Google "My Maps" custom pins** (DS `MY_MAP_ID`, the `/maps/d/embed` variant and its −56px
    header crop). There is no `myMapId` field in the wedding config and adding one is a hub + API
    change. Build the DS's own documented fallback — the plain `?q=…&output=embed` pin map — which is
    exactly what the DS renders when `MY_MAP_ID` is empty.
  - **Latitude/longitude.** `venues[]` has `address`/`city`/`postalCode`/`country`/`mapUrl` and no
    coordinates; `hotels[]` has no location at all. The DS's `ll`/`z` values are placeholders. Do not
    hardcode coordinates for real places into the bundle.
  - A hub ADR adding `myMapId` + coordinates can follow later and upgrade this screen in place.
- **Open question, flagged not gated:** this introduces a **new third-party embed** — Google as a
  data processor on a screen every guest opens. Hub ADR-0027 required a consent banner and a
  privacy-policy section for GA4; nothing covers Maps, and `privacyPolicy.*` in the i18n files
  mentions only Analytics. **Do not silently widen the Google data flow**: implement the screen, and
  surface this in the PR description for the user to decide whether it needs its own ADR. Do not
  invent a consent gate for it on your own initiative.
- **Refs:** DS `8699c8c` → `ui_kits/wedding-app/ScreenTravel.jsx`; hub ADR-0027 (consent + privacy
  policy precedent); `src/app/core/api/model/create-wedding-config-dto-venues-inner.ts`,
  `create-wedding-config-dto-hotels-inner.ts`

### T297 — Config manager: edit every language at once, and flag key moments
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing — `highlight` already exists on the agenda item
- **Why:** the FR/EN/ES tab bar lets a translation stay silently empty — you only find out when a
  guest switches language and sees a blank title. Showing every language side by side makes the gap
  visible at the point of editing.
- **Acceptance:**
  - **Agenda section:** the `lang-tabs` bar is gone. Each agenda card shows **one row per language**
    (es / en / fr, all three always — see the phase note on `cfg.languages[].on`), each row carrying
    a Title and a Description input, under a shared column header. `setAgendaText` takes an explicit
    language argument instead of reading the `lang` signal.
  - **Dietary section:** the `lang-tabs` bar is gone. Each dietary / allergy option becomes a grid
    row — index, one input per language, remove button — replacing the single-language tag pills.
    The trailing "+ Add option" input commits its typed text into **all three** languages as a
    starting point (DS: `addTag` fills `fr`/`en`/`es` alike), then each is edited inline.
  - **Narrow layout:** three side-by-side input columns do not fit a phone. Per DS
    `ScreenConfigManagerMobile.jsx`, narrow stacks the languages **vertically** instead — one full
    width input per language, each prefixed by a small accent language chip, under a
    "Title · all languages" / "Description · all languages" heading; the dietary rows become one
    bordered card per option with a stacked input per language and a single remove button on the
    first row. Same data, same handlers, different arrangement — via the existing wide/narrow
    pattern in `config-manager.scss`, no new hardcoded breakpoints (hard rule 4).
  - The existing **tag modal** (`tagModalOpen` / `tagModalCollection` / `tagModalLabel` and its
    template block) existed only to enter all languages at once. That is now the inline behaviour, so
    remove the modal and its state rather than leaving two ways to do it — **confirmed, delete it**.
    This drops a `shared/modal` usage; the 4 known lint errors in that component stay untouched.
  - The `lang` signal and `selectLang` become unused — remove them. `EDIT_LANGS` stays as the column
    order, but is **reordered to `['es', 'en', 'fr']`**: it was `fr`-first only because the DS tab bar
    had no notion of a primary language, and its code comment says as much. A permanently visible
    leftmost column *is* primary, so it should be the default language (hub ADR-0009). Update that
    comment to say why the order now matches the app's, rather than deliberately not matching it.
  - **Key moment toggle:** each agenda card gets a labelled toggle bound to the existing
    `highlight` field (reuse `shared/toggle`; `role="switch"`, `aria-checked`), plus the DS's accent
    left border on the card when set. Newly added agenda items default to `highlight: false`.
  - **Agenda filter:** All / Key moments / Optional, with live counts, using the existing
    `.segmented` control pattern already in `config-manager.html`. An empty filter result shows the
    DS's dashed "no moments in this filter" card.
  - `highlight` round-trips through save — the existing `update` call already sends the whole agenda
    item, so confirm rather than re-plumb.
  - No guest-side change is needed for *filtering*: `invitee.html:95` already filters the home
    preview on `event.highlight`, and `screens/schedule` already shows every item. **Verify both**
    and say so; do not otherwise rework either.
  - **One guest-side bug does need fixing**, because this task is what starts exposing it. In
    `invitee.html` the `@for` computes `let last = $last` over **all** agenda items, then filters
    with `@if (event.highlight)` inside. So `last` is true only for the final item overall — if that
    item is not a key moment, no rendered row gets `last`, and the last visible timeline row draws a
    trailing connector line into empty space. It only stays hidden while the final agenda item
    happens to be a key moment; the moment a couple toggles that one off, it shows. Filter to the
    highlighted items **before** iterating (a `computed` in `invitee.ts`, mirroring
    `schedule.ts`'s `items`) so `$last` refers to the rendered list. Cover it with a test.
  - **ES/EN/FR** for every new label (hard rule 8): filter options, column headers, "Key moment",
    the empty-filter card, the add-option placeholder.
  - Unit tests: editing one language leaves the other two untouched; adding an option fills all
    three; the toggle flips `highlight`; each filter selects the right subset and the empty state
    renders.
  - Full pre-merge gate green. Note the 4 pre-existing lint errors in `src/app/shared/modal/` are a
    known exception — leave them alone even though this task deletes a modal usage.
- **Refs:** DS `8699c8c` → `ui_kits/wedding-app/ScreenConfigManager.jsx`,
  `ScreenConfigManagerMobile.jsx` (`TagEditor`, `setAgendaML`, `setTag`, the agenda filter); hub
  ADR-0009 (fixed es/en/fr language set)

### Deliberately out of scope for Phase R
- **A `myMapId` config field, venue coordinates, or hotel addresses.** Would be a hub ADR plus a
  `wedding-api` contract change, and hub ADR-0037 §7 makes that a coordinated deploy, not a
  drive-by. T296 ships against the contract as it stands today.
- **An `important` field on the agenda item.** It is `highlight`, which already exists and is already
  read by the guest home screen. Adding a second field for the same concept would be a silent
  contract fork.
- **A language enable/disable switch.** Hub ADR-0009 fixes the set at es/en/fr.
- **Porting the DS's inline styles.** The JSX is a rendering reference; all styling goes to the
  component `.scss` from `src/styles/_tokens.scss` (hard rules 2 and 3).
