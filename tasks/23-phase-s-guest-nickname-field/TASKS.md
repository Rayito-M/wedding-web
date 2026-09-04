## Phase S — Guest nickname field (`wedding-ui-design` `76aa9fa`)

> **Why this phase exists.** DS commit `76aa9fa` ("guest nickname field, profile moves from screen
> to account modal") bundles two independent changes; this phase is the first of the two (the
> second, the profile-modal move, is Phase T — they touch different surfaces and ship
> independently). An optional `nickname` — max 8 characters, rendered in quotes beside the legal
> name, never in place of it — is editable everywhere a person's name itself is editable, and
> locked read-only wherever the name is locked (a `partner2` who already has their own guest
> account, ADR W-0002 §Decision.3).
>
> **The generated API client already has the field — do not run `pnpm gen:api` for this phase.**
> `nickname?: string` is already present on `UserProfileDto`, `UpdateUserProfileDto`, `GuestDto`,
> `CreateGuestDto`, `UpdateGuestDto`, `UserDto`, `RsvpDtoAdultsPartner1`,
> `RsvpDtoAdultsPartner2OneOf`/`OneOf1`, `RsvpDtoChildrenInner`, and their siblings — confirmed via
> `grep -rl nickname src/app/core/api/model/`. Every task below is wiring a field that already
> compiles, never adding one to `src/app/core/api/`.
>
> **A deliberate, flagged constraint mismatch — do not "fix" it either direction.** The hub OpenAPI
> contract defines `nickname` as `{ minLength: 1, maxLength: 30 }` when present. The DS mockups cap
> every nickname input at **8 characters client-side** (`v.slice(0, 8)`) and show a
> "(max 8 characters)" hint everywhere. Follow the DS's narrower 8-char cap — it never rejects
> anything the server would accept, so it's safe — and do not widen it to 30. Separately, because
> the wire requires `minLength: 1` whenever the property is *present*, clearing a nickname to empty
> must omit/undefined the field on write, never send `nickname: ''`.

### T298 — Foundation: nickname i18n keys + `UserProfileDataService.update()` DTO-mapping fix
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing
- **Why:** every task below adds a nickname field to a form that ultimately writes through
  `UserProfileDataService.update()`; that mapping has to exist once before any of them can round-trip
  a save. Centralizing the copy here too keeps five PRs from inventing five slightly different
  labels for the same field.
- **Acceptance:**
  - `UserProfileDataService.update()` (`src/app/core/data/user-profile-data.service.ts`) maps
    `changes.nickname` onto `UpdateUserProfileDto.nickname`. Because the wire's `minLength` is 1
    whenever the field is present, a cleared/empty nickname must be sent as `undefined`, never
    `''` — mirror `guest-create-modal.ts`'s existing `email: email || undefined` pattern in
    `guestDraft()`, not a new one. Update the method's doc comment, which currently lists only
    firstName/lastName/preferredLang/role/guestInfo as editable.
  - New shared i18n keys, ES/EN/FR, reused by every task below: recommend `shared.nickname.label` /
    `shared.nickname.placeholder` / `shared.nickname.hint` (mirroring the existing `shared.partner.*`
    grouping, `public/i18n/en.json` ~line 561), the hint being the DS's "(max 8 characters)". Also
    add `rsvp.editor.person.nicknameLabel` / `nicknamePlaceholder` to the namespace that already
    carries `firstNamePlaceholder`/`lastNamePlaceholder` (`public/i18n/en.json` ~line 213-222), for
    the RSVP editor's per-row placeholder ("e.g. Ju" / "e.g. Teo" per DS `RSVPEditor.jsx` /
    `ScreenRSVPCreate.jsx` — confirm the sample names against the DS rather than inventing new ones).
  - Unit test: `UserProfileDataService.update()` — a `nickname` change round-trips into
    `UpdateUserProfileDto.nickname`; an empty-string nickname produces `undefined` on the DTO, never
    `''`.
  - Full pre-merge gate green (`pnpm typecheck && pnpm lint && pnpm test`).
- **Refs:** DS `76aa9fa` → `ProfileCard.jsx`, `ScreenGuestManager.jsx` (`Pseudo`/`GmPseudo`); hub
  `contracts/openapi.json` (`nickname: { minLength: 1, maxLength: 30 }`);
  `src/app/core/api/model/update-user-profile-dto.ts`;
  `src/app/core/data/user-profile-data.service.ts`; `public/i18n/{es,en,fr}.json`

### T299 — Shared `app-rsvp-editor`: nickname, locked when the name is locked
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T298
- **Why:** this is the one editor behind the guest's own RSVP screen, the couple's manage-RSVP
  modal, and self-service create (in-repo ADR W-0003) — one change here reaches all three.
- **Acceptance:**
  - `AdultDraft` and `ChildDraft` (`src/app/core/helper/rsvp-draft.ts`) gain an optional
    `nickname?: string`. `toRsvpDraft`/`fromRsvpDraft` carry it both ways against
    `RsvpDtoAdultsPartner1.nickname` / `RsvpDtoAdultsPartner2OneOf(1).nickname` /
    `RsvpDtoChildrenInner.nickname` — trimmed, and omitted (not sent as `''`) when blank, same rule
    as T298.
  - `PersonCard` (`rsvp-editor.ts`) gains a `nickname: string` field, populated from the draft for
    every role.
  - `rsvp-editor.html`: a Nickname `app-input` beside/under the name fields for every **non-locked**
    card (primary, unlocked partner, child) — `maxlength="8"` plus a `.slice(0, 8)` clamp in the
    setter, mirroring `setChildAge`'s existing `.slice(0, 2)` clamp already in this file. The DS's
    "(max 8 characters)" hint (`shared.nickname.hint`) renders under it. For a `nameLocked` card
    (`partner2` with their own account), the nickname is **not editable** — render it read-only
    beside the locked name in quotes, `font-style: italic`, `--text-muted` (DS `ProfileCard.jsx`),
    only when non-empty, and add no nickname input at all for that card.
  - New setters `setAdultNickname(key, value)` / `setChildNickname(index, value)`, following the
    exact shape of `setAdultFirstName`/`setChildFirstName` — including `partner2NameLocked()`'s
    existing early-return guard reused for the nickname setter too.
  - Collapsed-card display (`fullName()`, the `.name` span) is unchanged — nickname never replaces
    or appends to the name there; it only ever shows on its own quoted line, per the DS's "never in
    place of it" rule.
  - `rsvp-create.ts`/`.html`: `PartnerDraft` and `ChildDraft` (this screen's own local types,
    distinct from `rsvp-draft.ts`'s) gain `nickname?: string`, following the exact shape
    `firstName`/`lastName` already have there. `toCreateDraft()` reads it off
    `partner2.nickname`/`c.nickname`; `submit()`'s `typedPartner`/children mapping writes it back,
    trimmed, omitted when blank. Template: a Nickname input under the partner block and under each
    child row (DS `ScreenRSVPCreate.jsx`) — for a linked partner (`hasLinkedPartner()`), render the
    nickname read-only the same way the linked partner's name already is, never an editable input.
  - Unit tests: nickname round-trips through `toRsvpDraft`/`fromRsvpDraft` and stays `undefined`
    (not `''`) when cleared; a locked `partner2`'s nickname renders read-only with no input;
    `rsvp-create`'s partner/child nickname fields submit correctly and are absent from the payload
    when blank.
  - Full pre-merge gate green.
- **Out of scope:** raising the 8-char cap to the wire's 30 — see the phase intro.
- **Refs:** DS `76aa9fa` → `RSVPEditor.jsx`, `ScreenRSVPCreate.jsx`;
  `src/app/core/helper/rsvp-draft.ts`; `src/app/shared/rsvp-editor/{rsvp-editor.ts,.html,.scss}`;
  `src/app/screens/rsvp-create/{rsvp-create.ts,.html}`; in-repo ADR W-0003, ADR W-0002 §Decision.3
  (name-lock rule reused for nickname)

### T300 — Guest manager: nickname in search, create form, and edit-profile form
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T298
- **Acceptance:**
  - `guest-manager.ts`'s `filteredGuests` search predicate (~line 91-92) also matches
    `profile.nickname`, case-insensitively, alongside the existing name match — mirrors DS
    `ScreenGuestManager.jsx`'s `(r.pseudo || '')` clause.
  - `guest-create-modal.ts`'s `createForm` gains a `nickname` control (optional; `maxlength="8"` +
    slice clamp, same pattern as T299). `guestDraft()` sends it through the same `|| undefined`
    clearing rule as `email`. Template (`guest-create-modal.html`): a Nickname field beside
    first/last name, with the `shared.nickname.hint` text.
  - `guest-profile-modal.ts`'s `editForm` gains a `nickname` control, **always editable** — this
    admin form has no lock concept (confirmed against DS `ScreenGuestManager.jsx`, where
    firstName/lastName are plain unlocked `Input`s here too). `startEdit()` seeds it from
    `profile.nickname ?? ''`; `saveProfile()` includes it in the `userProfileCollection.update(...)`
    call. Template (`guest-profile-modal.html`): a Nickname field beside first/last name.
  - The read-only profile view (`viewMode() === 'profile'`) shows the nickname in quotes beside the
    guest's display name when set, per DS `ProfileCard.jsx` — never replacing it.
  - Unit tests: search matches on nickname; create/edit forms round-trip nickname, including
    clearing it to `undefined` (not `''`).
  - Full pre-merge gate green.
- **Refs:** DS `76aa9fa` → `ScreenGuestManager.jsx` (`Pseudo`, `GmPseudo`, search filter);
  `src/app/screens/guest-manager/guest-manager.ts`;
  `src/app/screens/guest-manager/modal/{guest-create-modal,guest-profile-modal}.{ts,html}`

### T301 — People directory: nickname in search + card
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T298
- **Acceptance:**
  - `people.ts`'s `filteredPeople` computed also matches `person.nickname` (DS `ScreenPeople.jsx`'s
    `${firstName} ${lastName} ${pseudo || ''}` join) — fold it into the same lowercased name string
    being matched today, or a parallel check, whichever keeps the existing "search name or relation"
    branching intact.
  - `people.html`'s card gains a quoted nickname line beside the name (`.name-row`), `font-style:
    italic`, `--text-muted`, rendered only when `person.nickname` is set — never replacing
    `person.firstName`/`lastName`.
  - Drive-by: the stale class doc at the top of `people.ts` ("Presentational scaffold only (T237)…
    not wired to any API") is fixed — this screen has been real (`EntityCollectionService`,
    `LoginService`, `todayInMadrid`) since at least T290/T292; update the comment instead of leaving
    it contradict the code below it.
  - Unit test: search matches on nickname alone (no name/relation match).
  - Full pre-merge gate green.
- **Refs:** DS `76aa9fa` → `ScreenPeople.jsx`; `src/app/screens/people/{people.ts,people.html}`

### T302 — Profile scaffold: nickname field (fixture only)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T298 (reuses the same copy, once translated)
- **Why:** user-confirmed in scope even though this screen persists nothing yet and may be retired
  by Phase T.
- **Acceptance:**
  - `FORM_SEED`/`ProfileForm` (`profile.ts`) gains a `nickname` field; the identity-card/edit-form
    template (`profile.html`) gets a Nickname field styled identically to the existing first/last
    name fields — same `editing()` view-vs-edit toggle, same hardcoded-English label pattern this
    screen already uses throughout (this screen has no i18n at all today; adding i18n for one field
    while every other label stays hardcoded would be a worse inconsistency than matching what's
    already here — leave full i18n for whoever migrates or replaces this screen).
  - No persistence changes — `save()` still only flips the `editing`/`saved` signals, exactly as
    today.
  - **If Phase T's route-removal task (T304) has already landed and deleted
    `src/app/screens/profile/`, this task is moot** — do not recreate the screen; note that in the
    PR instead.
  - Full pre-merge gate green.
- **Refs:** DS `76aa9fa` → `ScreenProfile.jsx`; `src/app/screens/profile/{profile.ts,profile.html}`

### Deliberately out of scope for Phase S
- **Raising the client-side nickname cap above 8 characters** to match the wire's `maxLength: 30`.
  The narrower cap is a deliberate DS/UX choice, not a bug — see the phase intro.
- **A server-side or `EntityCollectionService`-query-level nickname search.** Every search site
  above is confirmed client-side filtering over an already-loaded list (`guest-manager`, `people`);
  there is no guest-search endpoint to extend.
- **Regenerating `src/app/core/api/`.** `nickname` is already present on every DTO listed in the
  phase intro; T298 only touches the hand-written mapping in `UserProfileDataService`.
