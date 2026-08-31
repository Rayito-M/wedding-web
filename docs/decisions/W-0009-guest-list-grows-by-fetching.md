# ADR W-0009: The guest list grows by fetching — the cursor decides, not a batch size

- **Status:** accepted
- **Date:** 2026-08-31
- **Deciders:** wedding-web architect (this repo)
- **Supersedes:** W-0008 (guest manager list growth — client-side windowing)
- **Scope:** wedding-web (in-repo). Consumes the contract change in hub ADR-0038; requires
  `pnpm gen:api`.

## Context

W-0008 decided the guest manager's growing list was a **client-side window**: `shown` started at 12
and grew by 12, slicing an array `GET /v1/profile` had already returned in full. That was the right
call at the time and it said why — the endpoint took no cursor and no limit, so there was nothing to
fetch and `BATCH = 12` was a presentation constant, not a page size.

W-0008 also named its own successor condition: *"If the guest list ever grows past what one
`GET /v1/profile` should return, this ADR is the thing to supersede."* Hub ADR-0038 removed the
premise instead — `GET /v1/profile` is now cursor-paged and returns `{ items, nextCursor, count }`.
With a real cursor on the wire, a "Load more" button driven by an invented batch size is no longer a
reasonable stand-in; it is a button that offers work the API has already said does not exist.

## Decision

1. **`hasMore` is `typeof nextCursor === 'string'`, and nothing else.** The API's cursor is the only
   input. `null` (collection exhausted) and `undefined` (nothing read yet) both mean *no further
   call would return rows*, so neither the button nor the scroll trigger offers anything. No row
   count is compared against any batch size anywhere in this screen — `BATCH` and `shown` are
   deleted, not re-tuned.

2. **The cursor lives on `UserProfileDataService`, not in the component.** `@ngrx/data`'s
   collection carries entities, not page state, so the data service records `nextCursor` from each
   list response into a signal and the screen reads it. One place writes it: the list read.

3. **Growth is a real fetch, so it reports a real busy state.** `loadMore()` calls
   `getWithQuery({ cursor })` and is guarded on the collection's own `loading$` — a scroll that
   keeps firing near the bottom must not queue a second request for the same cursor. The "Load
   more" button goes `disabled` while a page is in flight. This does not contradict W-0008 §3,
   which refused to **fake** a busy state for a synchronous array slice; the latency is now real.
   Still no "Loading…" label and still no new i18n keys — the disabled state carries it.

4. **"End of list" marks an end the user actually reached.** It renders only after a fetch-backed
   grow has happened (`pagesFetched > 0` and no cursor left). With the whole collection already in
   hand there is no end to announce, and announcing one under every short table is noise.

5. **A filter, search or sort change scrolls back to the top and keeps every fetched row.** W-0008
   §6 also reset the window to one batch; there is no window to reset now, and discarding rows that
   cost a request because someone typed in the search box would be the fake-pagination problem
   inverted. The scroll reset survives for the reason W-0008 gave: a user at the bottom of a
   re-sorted list must not land mid-list with a clamped scroll position.

6. **The screen reads with no `limit`, so today `nextCursor` is always `null` and "Load more" never
   renders.** Every loaded row is drawn, in one scrolling container. This is the honest end state of
   the user-facing rule *the affordance exists only if a new API call is needed* — one call returns
   everything. Nothing in this screen assumes it stays that way: adopt a `limit` and the button,
   the scroll trigger and the end-of-list line all begin working with no template change.

## Why the screen cannot adopt a `limit` yet

Not an oversight — a coupling, recorded so the next reader does not "fix" it by adding a page size:

- The header tiles **and every filter-chip badge** (`All · 152`, `Attending · 91`) come from
  `StatisticService`, which aggregates over the **entire** `UserProfile` collection. Paging the
  fetch makes all of them read low until the last page lands.
- Search and the status filters match client-side over loaded rows, so a paged list silently fails
  to find a guest who has not been fetched.

Those counts have to move server-side first (`wedding-api` T235), and then this screen can pass a
`limit` (T334).

## Consequences

- The `BATCH = 12` constant, the `shown` signal and the `visibleGuests` slice are gone; the template
  renders `sortedGuests()` directly.
- `guest_manager.list.*` keeps its existing keys — no locale files change. `showing` now reads
  "filtered rows out of every guest row loaded" rather than "window out of total".
- T330's window tests are replaced by cursor tests driven through `HttpTestingController`: the list
  read is answered with a real page envelope, so a test can only pass by reading `nextCursor` the
  way the component does.
- The API serves a deprecated `profiles` alias alongside `items` until `wedding-api` T234 drops it
  (hub ADR-0037 §7). This repo reads `items` only.

## Deliberately out of scope (this ADR)

- Moving the header/chip counts server-side, and therefore adopting a `limit` (`wedding-api` T235 / T334).
- Server-side search, filtering and sorting.
- Moving the screen off the `UserProfile` collection onto `/v1/guests` — still a data-layer
  migration with its own ADR, for the reason W-0008 gave: `GuestListResponseDto` has no `rsvp`.
- Virtual scrolling. The rendered row count is the loaded row count (~150); a virtualizer is not
  warranted, and if the list grows enough to warrant one, the cursor is already there to page with.
