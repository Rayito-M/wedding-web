# ADR W-0008: Guest manager list growth — client-side windowing, not a paged fetch

- **Status:** accepted
- **Date:** 2026-08-30
- **Deciders:** wedding-web architect (this repo)
- **Scope:** wedding-web (in-repo). No contract change, no glossary change, no design-system
  change, no `pnpm gen:api`.

## Context

The design system replaced the guest manager's numbered pagination with a growing list
(`../wedding-ui-design`, commit `6a76ebaaca9c36a0ab405cd6e91176610e8af7e8`, files
`ui_kits/wedding-app/ScreenGuestManager.jsx` and `ScreenGuestManagerMobile.jsx`). Both prototypes
hold a `shown` counter that starts at 12 and grows by `BATCH = 12` on scroll or on an explicit
"Load more" press, with `loadingMore` flipping the button label to "Loading…" for 550 ms.

The prototypes' own comments — `BATCH = 12; // how many rows the next page of the API returns` and
`// Stands in for the next API page` — say plainly that the DS is *modelling* a paged endpoint it
does not have. The question for this repo is whether we have one.

**We do not, on this screen.** `screens/guest-manager` reads `UserProfileDto` rows out of the
shared `@ngrx/data` `UserProfile` collection (`core/data/user-profile-data.service.ts`), whose
`getAll()` calls the generated `WeddingUserProfileService.profileControllerGetAllV1()`. That
method takes **no** request-parameter object at all — its only arguments are `observe` /
`reportProgress` / `options` — and `UserProfileListResponseDto` is `{ profiles, notFoundIds? }`
with no cursor, no total and no `hasMore`. `GET /v1/profile` returns the entire list in one
response.

A cursor-paged endpoint *does* exist next door: `GuestsControllerListV1RequestParams` carries
`cursor` and `limit` and `GET /v1/guests` returns `GuestListResponseDto`. It is not what this
screen reads, and switching to it is not a swap: the row renders `guestInfo.partner` and the
`guestInfo.rsvp` summary (status / adults / children) that `UserProfileDto` carries and `GuestDto`
does not, the shared `UserProfile` collection is also what the profile and RSVP modals write back
into, and the couple-only `lastSeen` gating (hub ADR-0035/0036) is reasoned about on the profile
DTO today. Re-homing the screen onto `/v1/guests` would be a data-layer migration with its own
ADR, not a UI task.

## Decision

1. **The window is client-side.** `shown` slices the already-fetched, already-filtered,
   already-sorted array. There is no incremental fetch, and **no `limit`/`offset`/`cursor`/`page`
   parameter is to be invented** on `profileControllerGetAllV1` — the generated client is the
   contract and it has none. Nothing under `src/app/core/api/` is hand-edited.

2. **`BATCH = 12`, matching the DS**, replacing the current `pageSize = 10`. The batch size is a
   presentation constant, not an API page size; name and comment it as such so a later reader does
   not mistake it for a wire concern.

3. **No simulated latency and no `loadingMore` state.** The DS's 550 ms `setTimeout` exists only
   to make a fake fetch look real. Slicing an in-memory array is synchronous, so faking a spinner
   would be inventing a delay the user does not have. Consequently the DS strings "Loading…" and
   "Loading more…" are **not** implemented and get no i18n keys — three locale files of dead
   strings is worse than the omission. The "Load more" button keeps one label; the footer's right
   slot shows "Scroll for more" while more rows remain and is empty otherwise.

4. **Growth is announced, not just drawn.** Because there is no loading affordance to convey
   progress, the footer's "Showing X of Y" line carries `aria-live="polite"` so a screen-reader
   user hears the count change after a scroll-triggered or button-triggered grow. This is the
   accessibility substitute for the DS's visual "Loading…" swap.

5. **Both the scroll trigger and the button ship.** The scroll trigger (fire when
   `scrollHeight - scrollTop - clientHeight < 120`) is the DS's primary affordance, but it is
   mouse/touch-centric and never fires at all when the container is not yet overflowing. The real
   `<button>` is what makes the feature keyboard-operable and is therefore not optional.

6. **Any change to the window resets it.** Changing filter, search query or sort column/direction
   sets `shown` back to `BATCH` *and* scrolls the list container back to the top — otherwise a
   user sorted-and-scrolled to the bottom lands mid-list on a 12-row window with the scroll
   position clamped, and may re-trigger a grow they did not ask for.

## Consequences

- The guest manager stops paginating and starts growing, matching the DS on both tiers, with no
  API change and no regeneration of the client.
- The `guest_manager.pagination.*` i18n group (`prev`, `next`, `of`, `noResults`) is used nowhere
  else and is replaced by `guest_manager.list.*` in all three locale files.
- If the guest list ever grows past what one `GET /v1/profile` should return, this ADR is the
  thing to supersede — the replacement is a data-layer migration onto the cursor-paged
  `/v1/guests`, and `shown`/`BATCH` would then become a real page cursor. Nothing in the UI built
  here assumes otherwise: `hasMore` is already a derived boolean, not a page arithmetic.

## Deliberately out of scope (this ADR)

- Moving the screen off the `UserProfile` collection onto `/v1/guests`.
- Virtual scrolling / row recycling. The rendered row count is bounded by what the user has
  explicitly grown to, and the list is ~150 rows; a virtualizer is not warranted.
- Sorting semantics, which are T331's subject, not this one's.
