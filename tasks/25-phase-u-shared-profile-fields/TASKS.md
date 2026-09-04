## Phase U — Shared profile-editing fields, nickname cap raised to 30, edit-mode jump
(`wedding-ui-design` `b5c718d8dc214bafe7f67ee296c53f371ae31080` + an already-regenerated API client)

> **Why this phase exists.** Two independent upstream changes landed together and both touch the
> guest-profile-editing surface, so they ship as one phase, ordered so the urgent one goes first.
>
> **1. DS commit `b5c718d8dc214bafe7f67ee296c53f371ae31080`** ("extract shared ProfileFields/
> RelationFields components") bundles three changes, read directly off the DS repo at its current
> HEAD (`components/core/ProfileFields.jsx`/`.d.ts`, `RelationFields.jsx`/`.d.ts`,
> `ui_kits/wedding-app/ProfileModal.jsx`):
> - `ProfileModal.jsx`, `ScreenGuestManager.jsx`, and `ScreenGuestManagerMobile.jsx` now all render
>   the same extracted `<ProfileFields>` (which itself composes `<RelationFields>`) instead of three
>   hand-rolled copies of the same first/last/nickname/email/phone/language/side/group/relation form.
>   This app has the identical triplication today, minus the DS's desktop/mobile split (hard rule 4
>   means this app never had that split to begin with) — three call sites: `shared/profile-modal`
>   (the guest's own profile), `screens/guest-manager/modal/guest-profile-modal` (the couple editing
>   a guest), `screens/guest-manager/modal/guest-create-modal` (the couple creating a guest). The
>   commit's own body addresses this repo directly: "review ProfileFields/RelationFields API surface
>   for consistency before wiring into any remaining profile-editing screens." T309-T313 are that
>   review and the migration.
> - `ProfileFields.jsx` hardcodes `PSEUDO_MAX = 30` — the nickname cap Phase S (T298-T300) deliberately
>   narrowed to 8 is now raised to 30 everywhere: `ProfileModal.jsx`, `RSVPEditor.jsx`, and
>   `ScreenRSVPCreate.jsx` all move to it. This app has the 8-char clamp hardcoded in **five** places;
>   T307 raises it in the two not touched by the ProfileFields migration (`rsvp-editor`, `rsvp-create`)
>   and owns the one shared `shared.nickname.hint` copy change; T310-T313 raise it in the other three
>   as part of migrating them, reusing that same copy — **do not edit `shared.nickname.hint` twice.**
> - `ScreenGuestManager.jsx`/`ScreenGuestManagerMobile.jsx`'s "open their profile" jump (from a
>   locked party member who has their own guest account) now opens straight into edit mode instead of
>   the read-only profile view. T308 is that behavior change, scoped to that one entry path only —
>   a normal guest-table row click still opens read-only-first.
>
> **2. An already-regenerated API client** (uncommitted at the start of this phase —
> `git status --short` shows exactly `src/app/core/api/api/wedding-user-profile.service.ts`,
> `src/app/core/api/model/update-user-profile-dto.ts`, and a partially-fixed
> `src/app/core/data/user-profile-data.service.ts`). `UpdateUserProfileDto` (the PATCH
> `/v1/profile/{id}` write model) dropped `role` (was required) and `guestInfo`, and added a flat
> `relation?: CreateGuestDtoRelation`. **`UserProfileDto` (every read path) is unaffected** — this is
> a write-model-only change. T306 is the fix; it is small, urgent (confirmed `pnpm typecheck` failure
> today), and unblocks nothing else structurally, but should land first so later tasks in this phase
> build on the corrected `.update()` call shape rather than the currently-broken one.
>
> **A capability the new DTO unlocks but that gets no UI here — flagged, not built.** The endpoint's
> new doc says "the user themselves, admins, delegated users, **or a linked partner**" can update a
> profile now. Nothing in the DS commit adds partner-editing UI either. **Deliberately out of scope**
> for this phase — see the trailer below.
>
> **A related question, decided explicitly rather than left ambiguous.** `ProfileModal.jsx`'s
> `<ProfileFields>` call passes `readOnly={!editing}` with `showRelation` at its default (`true`),
> so in the DS mock the guest's own side/group/relation becomes editable while editing — newly
> possible now that `relation` is a flat, guest-writable field on `UpdateUserProfileDto`. This app's
> `shared/profile-modal` (built in Phase T, before this DTO change existed) deliberately does **not**
> do this — it links out to `/people` and shows relation read-only there, per T303's acceptance. T312
> carries that choice forward **unchanged**: `app-profile-fields` gets built with `showRelation`
> support (T310), but `profile-modal`'s call site passes `showRelation` off, matching its existing
> behavior. Self-service relation editing in the guest's own profile modal is **not** silently added
> here — if the couple wants that, it is a follow-up task with its own explicit sign-off, not a side
> effect of a component-dedup refactor.
>
> **Hard rule 15, applied within this phase.** `guest-profile-modal.ts` and `guest-create-modal.ts`
> each declare an identical local `type RelationSide = 'bride' | 'groom' | 'both'` that duplicates
> the generated `GuestListResponseDtoItemsInnerRelationOneOf.SideEnum` (same three values) — a
> pre-existing violation this phase is well-placed to fix while consolidating the relation UI into
> one component (T309). `RelationKind` (`'family' | 'friends' | 'colleagues' | 'other'`) has **no**
> generated counterpart — the wire's `kind` is untyped `string` — so it may stay a local UI union,
> just declared once (T309) instead of twice.

### T306 — Fix `UpdateUserProfileDto` write path for the new contract shape
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing
- **Why:** the API contract already changed and the generated client already reflects it — the
  write path does not currently typecheck. Hard rule 17(a): this is not a "both sides ship together"
  situation, but the sooner this lands the sooner the SPA's one profile-write path is correct again.
- **Acceptance:**
  - `UserProfileDataService.update()` (`src/app/core/data/user-profile-data.service.ts`): remove the
    `if (!changes.role) return throwError(...)` guard (lines ~52-56) — `role` is no longer part of the
    write contract, and no replacement guard is needed. Line 63's
    `guestInfo: changes.guestInfo ? { relation: changes.guestInfo.relation } : undefined` becomes
    `relation: changes.guestInfo?.relation` (flat) — this is the exact line the current
    `TS2353: Object literal may only specify known properties, and 'guestInfo' does not exist in type
    'UpdateUserProfileDto'` points at.
  - The method's doc comment (lines 41-49) is rewritten to match the real contract: `firstName`,
    `lastName`, `nickname`, `preferredLang` are merged for any role when present; `relation` is
    merged only for a guest target; `role` is no longer accepted by the DTO at all. Drop the "`role`
    is required by the DTO … callers must pass the existing value through" sentence — it is now false.
  - `guest-profile-modal.ts`'s `saveProfile()` (~lines 319-327): drop `role: profile.role,`; change
    `guestInfo: { relation }` to `relation` (flat).
  - `private-layout.ts`'s `onProfileSave()` (~lines 163-190): drop `role: profile.role,`. Its doc
    comment (lines 152-162) drops the "id/role are carried forward unchanged" line — `id` still is,
    `role` no longer applies to this call at all.
  - `user-profile-data.service.spec.ts`: the two `changes: { role: UserProfileDto.RoleEnum.GUEST, … }`
    fixtures (~lines 41, 57) drop `role` — `update()` no longer requires or reads it. Add a case
    asserting a `guestInfo.relation` change round-trips onto the flat `relation` field.
  - `guest-profile-modal.spec.ts`: confirm it still typechecks and passes — it builds `UserProfileDto`
    read-fixtures with `role`/`guestInfo` (~lines 27-28), which is the unaffected read model, so no
    fixture change is expected there; verify and say so.
  - `private-layout.spec.ts`: the `call.updateUserProfileDto` assertion (~lines 209-217) drops
    `role: 'guest'` and `guestInfo: undefined` — the expected object becomes
    `{ id: 'u1', firstName: 'Laura', lastName: 'Ortega', nickname: 'Lu', preferredLang: 'en' }` (no
    `relation` key either — this call site never sends one).
  - Confirmed **untouched, do not edit**: `statistic.service.ts` and `guest-manager.ts` (both read
    `profile.guestInfo?.rsvp` off the unaffected `UserProfileDto`), `guest-create-modal.ts` (reads
    `profile.role`/`profile.guestInfo` off an existing guest for the partner-link check — read model),
    `people.ts` (`person.guestInfo?.relation`, read model), `login.service.ts`/`role.ts`
    (`AppJwtClaimsDto.RoleEnum` — an unrelated type, not `UpdateUserProfileDto.RoleEnum`).
  - Full pre-merge gate green (`pnpm typecheck && pnpm lint && pnpm test`).
- **Refs:** hub API contract change, already regenerated via `pnpm gen:api` →
  `src/app/core/api/api/wedding-user-profile.service.ts`,
  `src/app/core/api/model/update-user-profile-dto.ts`; `src/app/core/data/user-profile-data.service.ts`;
  `src/app/screens/guest-manager/modal/guest-profile-modal.ts`;
  `src/app/layouts/private-layout/private-layout.ts`; hard rule 17

### T307 — Nickname max length: 8 → 30 in the RSVP editor and self-service RSVP create
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing
- **Why:** the wire always allowed `maxLength: 30`; Phase S's 8-char cap was a deliberate DS-narrower
  choice (see that phase's intro), and the DS itself has now widened its own mock to 30. This task
  raises the cap for the two call sites this phase does **not** otherwise touch (`rsvp-editor`,
  `rsvp-create`); T310-T313 raise it in the other three as part of migrating them to the new shared
  fields component, reusing the one copy change this task makes.
- **Acceptance:**
  - `rsvp-editor.ts`'s `setAdultNickname` (~lines 339-348): `value.slice(0, 8)` → `value.slice(0, 30)`;
    its doc comment ("the wire allows up to 30, but the DS's narrower cap is deliberate") is corrected
    — the cap is no longer narrower than the wire.
  - `rsvp-editor.html`: the nickname `app-input`'s `maxlength="8"` → `maxlength="30"`.
  - `rsvp-create.ts`'s `setPartnerNickname` (~lines 262-269) and the child-nickname setter's identical
    clamp: `.slice(0, 8)` → `.slice(0, 30)`, same doc-comment correction on both.
  - `rsvp-create.html`: the partner and child nickname inputs' `maxlength="8"` → `maxlength="30"`.
  - The shared i18n key `shared.nickname.hint` (`public/i18n/{es,en,fr}.json`, established in T298)
    changes its copy from "(max 8 characters)" to "(max 30 characters)" (and the ES/FR equivalents) —
    this is the **one** place this copy lives across the whole app; do not duplicate it.
  - Unit tests: the nickname setters clamp at 30, not 8 — update whichever existing test asserted the
    old 8-char boundary.
  - Full pre-merge gate green.
- **Out of scope:** `profile-modal`, `guest-profile-modal`, `guest-create-modal`'s nickname caps — they
  move to 30 as part of T310-T313; touching them here would mean two PRs editing the same lines.
- **Refs:** DS `b5c718d8dc214bafe7f67ee296c53f371ae31080` → `ProfileModal.jsx`, `RSVPEditor.jsx`,
  `ScreenRSVPCreate.jsx`, `components/core/ProfileFields.jsx`'s `PSEUDO_MAX = 30`;
  `src/app/shared/rsvp-editor/{rsvp-editor.ts,.html}`; `src/app/screens/rsvp-create/{rsvp-create.ts,.html}`;
  `public/i18n/{es,en,fr}.json`; Phase S (T298-T300)

### T308 — "Open their profile" from the RSVP editor lands in edit mode
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing (touches `guest-profile-modal.ts` — if T311 is in flight at the same time,
  sequence against it; both land in that file)
- **Why:** the couple is opening this jump on a locked party member specifically to go fix something
  about their account (e.g. a typo in their name) — DS's `ScreenGuestManager.jsx`/
  `ScreenGuestManagerMobile.jsx` now skip the read-only view for this one entry path.
- **Acceptance:**
  - `GuestProfileModal` gains a way to open directly into edit mode **without duplicating**
    `startEdit()`'s existing seed-from-loaded-profile logic (~lines 251-262) — e.g. an
    `open(userId, opts?: { edit?: boolean })` overload, or a new `openEdit(userId)` that internally
    calls `open()` then reuses `startEdit()`'s seeding. Implementer's call on the exact shape; the
    external requirement is just: one path ends in `viewMode() === 'profile'`, the other in `'edit'`,
    seeded identically to what `startEdit()` already produces.
  - `guest-manager.ts`'s `openGuestProfile(userId)` (~lines 214-216), the entry point for a normal
    guest-table row click, keeps opening read-only-first — unchanged, its existing "one entry point,
    swapped overlays" doc comment stays accurate for that path.
  - A separate path serves `rsvp-editor`'s `(openProfile)` output (emitted from
    `requestProfile()`/`canOpenProfile()`, rsvp-editor.ts ~lines 359-368) specifically — either
    `guest-manager.html`'s `(openProfile)="openGuestProfile($event)"` (~line 281) is repointed to a
    new method, or `openGuestProfile` grows an optional parameter it forwards. Either way, the two
    triggers (row click vs. this RSVP-editor jump) must resolve to different `viewMode`s.
  - Unit tests: a guest-table row click opens the profile in `'profile'` mode, unchanged; the RSVP
    editor's "open their profile" jump opens straight into `'edit'` mode, seeded with the guest's
    current firstName/lastName/nickname/relation exactly as `startEdit()` already seeds it.
  - Full pre-merge gate green.
- **Refs:** DS `b5c718d8dc214bafe7f67ee296c53f371ae31080` →
  `ScreenGuestManager.jsx`/`ScreenGuestManagerMobile.jsx` (`openProfile` vs. the new `openProfileEdit`);
  `src/app/screens/guest-manager/modal/guest-profile-modal.ts` (`open()` L227-234, `startEdit()`
  L251-262); `src/app/screens/guest-manager/guest-manager.ts` (`openGuestProfile()` L214-216) and
  `guest-manager.html` (~line 281); `src/app/shared/rsvp-editor/rsvp-editor.ts` (`openProfile` output,
  L148, emitted L367)

### T309 — Build `app-relation-fields` (and move `app-guest-seg` to `shared/`)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing
- **Why:** `guest-profile-modal.html` and `guest-create-modal.html` each hand-roll an identical
  side/group(kind)/relationship(link) block today; this extracts it once, mirroring DS
  `RelationFields.jsx`. `app-profile-fields` (T310) composes this, same as the DS's `ProfileFields`
  composes `RelationFields`.
- **Acceptance:**
  - `app-guest-seg` moves from `src/app/screens/guest-manager/modal/guest-seg/` to
    `src/app/shared/guest-seg/` (three files, unchanged content) — its own doc comment currently says
    it "lives locally next to the two sibling modals that use it"; that's no longer true once
    `app-relation-fields` (also `shared/`) needs it, so the comment is corrected. The two existing
    importers (`guest-create-modal.ts`, `guest-profile-modal.ts`) update their import paths; no
    behavior change.
  - New `src/app/shared/relation-fields/{relation-fields.ts,.html,.scss}`, mirroring DS
    `RelationFields.jsx`/`.d.ts`: `value = input<{ side: GuestListResponseDtoItemsInnerRelationOneOf.SideEnum; kind: RelationKind; link: string }>(...)`,
    a change output (name it per this repo's convention — e.g. `valueChange`, mirroring
    `rsvp-editor`'s `draftChange` — not the DS's `onChange`) that emits the full next value, same
    "patch" semantics as the DS (`{ ...current, ...partial }`), `columns = input<1 | 2>(2)`,
    `showSide = input(true)`, `readOnly = input(false)`, `sideLabel`/`groupLabel`/`hint` as
    `input<string>()` — pre-translated strings the host supplies (this component owns no i18n copy of
    its own beyond what it's handed, since the hint's voice differs by caller — DS's own doc: "voice
    depends on who is editing").
  - **`RelationKind`** (`'family' | 'friends' | 'colleagues' | 'other'`) is declared **once**, here,
    and exported for every call site to import — replacing the identical local declarations in
    `guest-profile-modal.ts` and `guest-create-modal.ts`.
  - **`RelationSide`** is dropped everywhere in favor of the generated
    `GuestListResponseDtoItemsInnerRelationOneOf.SideEnum` (hard rule 15 — see phase intro); both call
    sites' local `type RelationSide = 'bride' | 'groom' | 'both'` are deleted once T311/T313 migrate.
  - The family-relation `<select>` vs. free-text `<input>` split and the full `LinkEnum` option list
    port as-is from `guest-profile-modal.html`'s existing block (~lines 219-262) — existing behavior,
    not new UI. `familyRelations`/`linkPlaceholderKey`-equivalent logic moves into this component.
  - No call site is wired yet (T311/T313's job) — this task only builds and unit-tests the component
    in isolation, same as T303's precedent.
  - Unit tests: `readOnly` renders the DS's read-only info rows instead of controls; `showSide=false`
    hides the side control; picking a `group`/`kind` clears the previous `link` value (existing
    `selectKind` behavior, ported); the family/non-family `link` control swap renders correctly;
    `valueChange` emits the full `{side, kind, link}`, not a partial.
  - Full pre-merge gate green.
- **Refs:** DS `b5c718d8dc214bafe7f67ee296c53f371ae31080` → `components/core/RelationFields.jsx`/`.d.ts`;
  `src/app/screens/guest-manager/modal/guest-profile-modal.html` (~lines 203-262, fields being ported);
  `src/app/screens/guest-manager/modal/guest-seg/` (moving);
  `src/app/core/api/model/guest-list-response-dto-items-inner-relation-one-of.ts` (`SideEnum`); hard
  rule 15; T303 (standalone-build precedent)

### T310 — Build `app-profile-fields` (composes `app-relation-fields`)
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T307 (the corrected `shared.nickname.hint` copy and 30-char cap must exist before
  baking them into this component), T309 (composes `app-relation-fields`)
- **Why:** the second half of the DS extraction — `firstName`/`lastName`/`nickname`/`email`/
  `phoneNumber`/`preferredLang`, plus the relation block, in one place instead of three.
- **Acceptance:**
  - New `src/app/shared/profile-fields/{profile-fields.ts,.html,.scss}`, mirroring DS
    `ProfileFields.jsx`/`.d.ts`: a `value` input covering `firstName`, `lastName`, `nickname`,
    `email`, `phoneNumber`, `preferredLang`, and — when `showRelation()` is true — the relation block
    (nested `relation: { side, kind, link }` or flattened alongside the rest; implementer's call,
    document it), a change output emitting the full next value, `columns = input<1 | 2>(2)`,
    `readOnly = input(false)`, `showLanguage = input(true)`, `showRelation = input(true)`,
    `lockContact = input(false)` (renders email/phone as read-only rows even while editing),
    `contactHint`/`relationHint`/`relationTitle` as `input<string>()`.
  - Composes `app-relation-fields` (T309) internally when `showRelation()` is true, forwarding
    `columns`/`readOnly`/`relationHint` — mirrors the DS composition, never re-authors the relation UI.
  - Uses `app-input` (`TextInput`) for the text fields, matching all three existing call sites' current
    markup.
  - Nickname clamps at **30** characters (T307's corrected cap) — export a named constant (e.g.
    `NICKNAME_MAX_LENGTH = 30`) rather than a bare literal, and reuse the already-updated
    `shared.nickname.hint` key (T307) — do not add a second nickname-hint key.
  - **Language picker:** this app has two existing patterns — `guest-create-modal`'s `app-guest-seg`
    pills over a hardcoded EN-first `preferredLangs` array, and `profile-modal`'s config-driven
    `weddingConfigPublic()?.language` list. Pick whichever is the closer fit for a shared,
    config-agnostic component (implementer's call, documented in the PR); do not invent a third
    pattern. `GuestProfileModal`'s edit form has **no** language control today (an admin does not set
    a guest's `preferredLang`) — `showLanguage = false` is exactly what that call site needs, so
    confirm the prop makes that possible.
  - ES/EN/FR for every label this component owns directly (First name / Last name / Nickname / Email
    / Phone / Preferred language) — reuse the existing `guest_manager.form.*` / `shared.nickname.*`
    keys already established (T298/T300); do not create parallel duplicates.
  - No call site is wired yet (T311-T313's job) — build and unit-test in isolation, same as T303's
    precedent.
  - Unit tests: `readOnly` renders static values; `lockContact` locks email/phone even while
    `readOnly()` is false; `showRelation`/`showLanguage` toggle their respective blocks off; nickname
    clamps at 30; the change output receives the full next value, matching the DS's `patch` semantics.
  - Full pre-merge gate green.
- **Refs:** DS `b5c718d8dc214bafe7f67ee296c53f371ae31080` → `components/core/ProfileFields.jsx`/`.d.ts`;
  `src/app/shared/profile-modal/{profile-modal.ts,.html}`,
  `src/app/screens/guest-manager/modal/{guest-profile-modal.html,guest-create-modal.html}` (fields
  being ported); `src/app/shared/relation-fields/` (T309); T303 (standalone-build precedent)

### T311 — Migrate `guest-profile-modal` to `app-profile-fields`
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T306 (corrected `.update()` call shape), T308 (edit-mode-entry change lands first —
  same file), T310
- **Acceptance:**
  - `guest-profile-modal.html`'s edit-mode form (~lines 175-274: firstName, lastName, nickname, side,
    kind, link, plus the always-read-only email/phone `readonly-grid`) is replaced by one
    `<app-profile-fields>`, with `lockContact` on (email/phone stay read-only — this admin form never
    writes them, per its own existing doc comment) and `showLanguage` off (no language control exists
    in this form today — confirm and preserve, don't add one).
  - `guest-profile-modal.ts`'s local `RelationSide`/`RelationKind` type aliases (~lines 32-33) are
    deleted; the form now imports `RelationKind` from `shared/relation-fields` and uses the generated
    `SideEnum` (T309).
  - `editForm`'s FormGroup either wraps `app-profile-fields`'s value/change contract (host still owns
    `Validators.required` on firstName/lastName/link, `markAllAsTouched()` on invalid submit — existing
    behavior) or is replaced by the component's own draft state with validation re-homed to the host's
    `saveProfile()` — implementer's call, document which was chosen and why; validation behavior
    (required fields block save, same as today) must not regress either way.
  - `saveProfile()` keeps calling `EntityCollectionService.update()` with the flat `relation` field
    (T306's shape) — this task changes how the fields are *rendered/edited*, not the save call shape.
  - `clampNickname()` and its `maxlength="8"` are removed — `app-profile-fields` now owns the 30-char
    clamp (T310).
  - The read-only `'profile'` view mode (~lines 20-173) is **not** touched — it doesn't hand-roll the
    edit-fields duplication this task targets, only the edit form does.
  - Unit tests updated for the new component boundary: required-field validation still blocks save;
    nickname still round-trips and clamps at 30; the relation fields still shape into
    `CreateGuestDtoRelation` correctly (family vs. non-family `link`).
  - Full pre-merge gate green.
- **Refs:** DS `b5c718d8dc214bafe7f67ee296c53f371ae31080` → `ScreenGuestManager.jsx`;
  `src/app/screens/guest-manager/modal/{guest-profile-modal.ts,.html}`;
  `src/app/shared/profile-fields/`, `src/app/shared/relation-fields/` (T309/T310)

### T312 — Migrate `profile-modal` ("My profile") to `app-profile-fields`
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T310
- **Acceptance:**
  - `profile-modal.html`'s hand-rolled firstName/lastName/nickname/email/phone/language fields are
    replaced by one `<app-profile-fields>`, with `lockContact` on (unchanged existing behavior —
    email/phone stay visually-editable-looking but read-only, per T303) and **`showRelation` off** —
    this call site keeps its existing "link out to `/people`, read-only there" behavior verbatim (see
    phase intro). Do **not** wire relation editing into this modal's `save` output as a side effect of
    this migration, even though `app-profile-fields`/`app-relation-fields` now technically support it
    and the API's `relation` field is now guest-writable — that is a separate, explicitly-scoped
    follow-up, not this task.
  - `ProfileDraft`'s local shape and `setField`/`setNickname` either delegate to
    `app-profile-fields`'s value/change contract or are removed in favor of it — implementer's call,
    document which.
  - `setNickname`'s `.slice(0, 8)` clamp is removed — `app-profile-fields` now owns the 30-char clamp
    (T310); `save`'s emitted payload shape (`firstName`, `lastName`, `nickname?`, `preferredLang` —
    still no `email`/`phoneNumber`, still no `relation`) is **unchanged**.
  - The identity block (avatar, name, quoted nickname, role/relation pills) at the top of the modal —
    which is **not** part of `ProfileFields`/`app-profile-fields` in the DS either — is untouched.
  - Unit tests updated for the new component boundary: `save` still emits only the same writable
    fields it does today (never email/phone/relation); the People link is still a real `routerLink`.
  - Full pre-merge gate green.
- **Refs:** DS `b5c718d8dc214bafe7f67ee296c53f371ae31080` → `ProfileModal.jsx`;
  `src/app/shared/profile-modal/{profile-modal.ts,.html}`; `src/app/shared/profile-fields/` (T310);
  T303 (email/phone-read-only precedent, carried forward unchanged)

### T313 — Migrate `guest-create-modal` to `app-profile-fields`/`app-relation-fields`
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T310
- **Acceptance:**
  - `guest-create-modal.html`'s firstName/lastName/nickname/email/phone/side/kind/link/preferredLang
    fields (~lines 20-100+) are replaced by `<app-profile-fields>`, with `lockContact` **off** (this
    modal creates a guest and `CreateGuestDto.phoneNumber` is required — contact fields must stay
    editable here, unlike the other two call sites) and `showRelation` on. The **partner-linking
    section** (the DS switch + candidate list, `createForm.controls.partner`) is **not** part of
    `ProfileFields` in the DS either — it stays exactly as it is today, sitting around the shared
    fields, not inside them.
  - `guest-create-modal.ts`'s local `RelationSide`/`RelationKind` type aliases (~lines 31-32) are
    deleted, same as T311 — imports `RelationKind` from `shared/relation-fields`, uses the generated
    `SideEnum`.
  - `createForm`'s required-field validation (firstName, lastName, phoneNumber pattern, email pattern,
    link) is preserved — implementer's call on whether it stays as `Validators` the host reads out of
    `app-profile-fields`'s emitted value, or is re-homed some other way; `createGuest()`'s existing
    "form invalid → `markAllAsTouched()` + bail" behavior must not regress.
  - `clampNickname()` and its `maxlength="8"` are removed — `app-profile-fields` now owns the 30-char
    clamp (T310).
  - `guestDraft()` keeps building `CreateGuestDto` exactly as it does today (this task changes
    rendering/editing, not the create-payload shape or the two-call create-then-link flow).
  - Unit tests updated for the new component boundary: required-field validation still blocks create;
    nickname still round-trips and clamps at 30, still omitted (not sent as `''`) when blank; the
    relation shapes into `CreateGuestDtoRelation` correctly; the partner-linking section is unaffected.
  - Full pre-merge gate green.
- **Refs:** DS `b5c718d8dc214bafe7f67ee296c53f371ae31080` → `ScreenGuestManager.jsx`'s `addGuest()`
  draft; `src/app/screens/guest-manager/modal/{guest-create-modal.ts,.html}`;
  `src/app/shared/profile-fields/`, `src/app/shared/relation-fields/` (T309/T310)

### Deliberately out of scope for Phase U
- **A linked-partner profile-editing UI.** `UpdateUserProfileDto`'s new "or a linked partner" caller
  is a real, already-shipped API capability, but nothing in the DS commit adds UI for it either —
  there is no "edit my partner's profile" entry point in this app today (profile editing is scoped to
  "my own profile" via `ProfileModalService`/`LoginService`, or "the couple editing any guest" via
  guest-manager). Building that entry point is a separate, explicitly-scoped follow-up. **Superseded
  by Phase V (T315-T319), which builds exactly this.**
- **Self-service relation editing in `profile-modal`.** See the phase intro's flagged decision —
  `app-profile-fields` gains `showRelation` support (T310) because `guest-profile-modal`/
  `guest-create-modal` need it, but T312 explicitly passes it off, preserving the guest's own profile
  modal's existing "link out to People, read-only" behavior. Turning it on is a follow-up with its own
  sign-off, not a side effect of the dedup migration.
- **A desktop/mobile component split mirroring the DS's `ScreenGuestManagerMobile.jsx`.** Hard rule 4:
  this app has no separate mobile screens: responsive CSS in the one component handles it. The DS's
  3-way duplication (desktop, mobile, `ProfileModal`) only ever mapped to this app's 3 call sites, not
  6.
