## Phase P — Last seen in the guest list (hub ADR-0035, DS `717120b`)

### T290 — The relative-day label helper + ES/EN/FR copy
- **Status:** done — `lastSeenLabel()` in `src/app/core/helper/last-seen-label.ts`; keys under
  `guest_manager.lastSeen.*` (plus `table.lastSeen`/`profile.lastSeen`) in `public/i18n/{en,es,fr}.json`.
  The absolute-date fallback formats through `DatePipe` with **no `timezone` override** — Angular's
  `DatePipe` parses a bare `YYYY-MM-DD` by constructing a *local*-time `Date` from its y/m/d (not the
  native ISO-8601 UTC-midnight parse), so passing an explicit override (`'UTC'`, `'+0000'`) actually
  *reintroduces* a day-shift on the reader's own offset — the opposite of "don't re-timezone it"; the
  spec (`last-seen-label.spec.ts`) caught this empirically before the fix. `pnpm gen:api` was run as
  part of this task (wedding-api T223 had already shipped) — see T291's note for the drift it surfaced.
- **Owner:** agent (implementer)
- **Depends on:** `pnpm gen:api` after wedding-api T223 lands in the contract
- **Acceptance:**
  - A small pure helper turning the API's raw `YYYY-MM-DD` into the displayed label: **"Today",
    "Yesterday", "Last week", "Last month"**, falling back to an **absolute date** for older values,
    and **"Never signed in"** when the value is absent/`null`.
  - **All phrasing lives here, never on the server.** The API ships a date and no label (hub
    ADR-0035 §6) — which is exactly what makes this ordinary translation work. Keys in
    `public/i18n/{en,es,fr}.json`; **do not** build a sentence by lower-casing a label the way the
    DS's `ProfileCard.jsx` does (`Last seen ${lastSeen.toLowerCase()}`) — that is an English grammar
    assumption and it will not survive ES/FR. Each locale gets whole phrases.
  - **There is no time of day.** The DS's `ScreenConfigManager` mocks render `'Today, 09:12'`; that
    field does not exist in the data and must not be invented or faked (hub ADR-0035 §1).
  - Bucket boundaries are computed against the **displayed date only** — the server already resolved
    the `Europe/Madrid` day, so do **not** re-timezone it or reconstruct an instant from it.
  - Unit spec covering each bucket, the absolute-date fallback, the absent value, and all three
    locales.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** hub ADR-0035 §6; `../wedding-ui-design` `717120b`; `public/i18n/{en,es,fr}.json`

### T291 — Guest-list column + guest-detail row
- **Status:** done — column in `guest-manager.html`/`.scss` (7th grid column, DS `717120b` ratios) +
  mobile secondary line under the status tag; detail row in `guest-profile-modal.html`. **New:**
  `GuestLastSeenService` (`src/app/core/service/guest-last-seen.service.ts`) — the guest manager reads
  its rows from the `UserProfile` entity collection (`GET /v1/profile`), an allow-list schema that
  structurally never carries `lastSeen` (ADR-0035 Context fact 3); this repo has no `Guest` entity
  wired yet (`entity-metadata.ts`'s own comment: "`Guest`… added as its task lands"). So this task adds
  a small read-only service that walks `GET /v1/guests`' cursor pagination directly (same
  inject-the-generated-client pattern `guest-create-modal.ts` already uses for that endpoint) and
  exposes `id → lastSeen` for the column/row to join against by guest id — it does not replace
  `UserProfile` for anything else the screen reads. There is no `ProfileCard` component in this repo
  (`guest-manager.html`/`guest-profile-modal.html` are bespoke markup, not a shared component the DS's
  `showContact` gate maps onto) — both surfaces this task touches already sit behind `adminGuard`
  (`/guests` route), which is that gate's real-world equivalent here.
  **Also:** `pnpm gen:api` (T290's dependency) picked up an unrelated upstream rename
  (`NotificationsService`→`WeddingNotificationsService`, `AudiencesService`→`WeddingAudiencesService`,
  wedding-api commit `9890da9`) that left `notification-center.service.spec.ts` and
  `milestones.spec.ts` referencing service names the regenerated client no longer exports, breaking
  `pnpm test`/`pnpm typecheck` app-wide; both were fixed to the new names as a drive-by (required for
  gate green, unrelated to T290/T291's own logic).
- **Owner:** agent (implementer)
- **Depends on:** T290
- **Acceptance:**
  - A read-only **"Last seen"** column on the admin guest list and the matching row in the guest
    detail view, per DS `ScreenGuestManager.jsx` / `ScreenGuestManagerMobile.jsx`. Mobile carries the
    field too — as a secondary line under the status tag — so it is **not** dropped on small screens.
  - Wired to the DS `ProfileCard`'s sanctioned `lastSeen` prop, which takes a **pre-formatted label**
    (or `null` for never) — the component does not format, T290 does. It renders behind
    `ProfileCard`'s couple-only `showContact` gate, whose meaning `717120b` widened to "email, phone
    and last-seen".
  - **Read-only everywhere.** No edit control, no clear button, no sort or filter in this task
    (deferred, hub ADR-0035 §10) — and never an input, because the API ignores the field on write.
  - **Admin surfaces only.** It must appear on **no** guest-facing screen, including the guest's own
    profile — the generated client will not carry it there, and nothing should reintroduce it.
  - The DS mocks derive values from row id (`SEEN[r.id % SEEN.length]`, and `status === 'no' && id %
    3 === 0 → 'Never'`). That is **placeholder wiring, not a rule** — it is not a finding that
    declined guests never sign in, and it must not be reproduced.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** hub ADR-0035 §6/§10; `SPEC.md` J4; `../wedding-ui-design` `717120b`
  (`ScreenGuestManager.jsx`, `ScreenGuestManagerMobile.jsx`, `components/data-display/ProfileCard.jsx`);
  in-repo T290

### T292 — People directory: show `lastSeen` for a couple viewer
- **Status:** done — `LoginService.isCouple` (new computed, also now backing `adminGuard` instead of
  its old inline check) gates a new `.last-seen` line on each `people.html` card, using T290's
  `lastSeenLabel()` over `UserProfileDto.lastSeen` and a new whole-phrase `people.lastSeen` key
  (`"Last seen: {{label}}"` / ES/FR equivalents) in `public/i18n/{en,es,fr}.json`. Gated on the
  signal, never on `person.lastSeen`'s presence — see hub ADR-0036 and the CLAUDE.md hard rule 16
  update for why presence alone is ambiguous. Matches DS `717120b`'s `ScreenPeople.jsx`
  (`showContact={role === 'couple'}` on `ProfileCard`), which this repo had not implemented before
  since T291 explicitly scoped the People screen out.
- **Owner:** agent (implementer)
- **Depends on:** hub ADR-0036 (widens ADR-0035 §6/§9), `wedding-api` commit `0318c1c`, hub contract
  commit `f94cfe2`, `pnpm gen:api`
- **Refs:** hub ADR-0036; `../wedding-ui-design` `717120b` (`ScreenPeople.jsx`, `people.data.js`)

### T293 — Guest manager: drop the `GuestLastSeenService` workaround
- **Status:** done — T291 shipped before `UserProfileDto` carried `lastSeen` at all, so it added
  `GuestLastSeenService` (a side-fetch of `GET /v1/guests`, cursor-paginated, joined by guest id) as a
  workaround. Hub ADR-0036 makes that redundant: `/guests` sits behind `adminGuard`, so every caller
  of `guest-manager.ts`/`guest-profile-modal.ts` is already the couple, and `UserProfileDto.lastSeen`
  — already loaded in the `UserProfile` collection both screens read from — is always populated for
  them. Deleted `guest-last-seen.service.ts`; both screens now call `lastSeenLabel(profile)` directly
  off the already-cached `UserProfileDto`. No behavior change for the guest-manager screen itself.
- **Owner:** agent (implementer)
- **Depends on:** hub ADR-0036, `pnpm gen:api`
- **Refs:** hub ADR-0036; in-repo T291

### Deliberately out of scope for Phase P
- **Sorting or filtering the guest list by last seen** — additive later if the couple asks (hub
  ADR-0035 §10). A filter that *acts* on inactivity ("email everyone inactive 30 days") is
  permanently out: it would turn an observation into an automated trigger, which nothing in this
  system has.
- **Any guest-facing surface**, including showing guests their own date (hub ADR-0035 §6). Still true
  after T292: `/people` is a guest-reachable *route*, but a guest viewing it never receives a
  populated `lastSeen` from the API — only a couple viewer of that same route does (hub ADR-0036).
  "Guest-facing surface" here always meant "visible to a guest", not "a route guests can open".
- **A last-seen column in the CSV export** — deliberately absent, and the API does not provide it.
- **Presenting last seen as evidence that someone read an announcement.** It is not a read receipt
  and may not be labelled or grouped as one (hub ADR-0035 §8).
- **The DS `ScreenConfigManager` couple-account screen**, which renders a `lastSeen` with a time of
  day. Not scoped by ADR-0035, and its time component does not exist.

---
