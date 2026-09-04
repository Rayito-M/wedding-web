## Phase V — Partner-account profile editing from both RSVP surfaces

> **Why this phase exists.** A guest reported: "I don't see the RSVP edit using the profile edit.
> All the partner with a 'guest' account should open the modal for profile edit. Only plus-one
> partner should be editable directly in the rsvp edit." Confirmed to apply to **both** RSVP-editing
> surfaces this app has.
>
> **Part 1 — the couple's guest manager** (`screens/guest-manager` → `app-manage-rsvp-modal` →
> `app-rsvp-editor perspective="couple"`). Static code review says this already works as described,
> via two features shipped earlier (T269, then T308 this session): a locked partner2 card
> (`partnerHasAccount(draft.partner2)`) renders an "Open their profile" link
> (`rsvp-editor.ts`'s `requestProfile()`/`canOpenProfile()`) that the chain
> `manage-rsvp-modal.ts`'s `onOpenProfile()` → `guest-manager.ts`'s `openGuestProfileEdit()` →
> `guest-profile-modal.ts`'s `open(userId, { edit: true })` resolves into `GuestProfileModal`
> landing straight in edit mode, seeded with that partner's own data. No bug was found in this
> chain by static review, and the full pre-merge gate is green including specs that cover each
> link of it. **T314 is a re-verification task**, not a rewrite: this repo's agent has no way to
> launch a browser or dev server (no Bash tool, and per CLAUDE.md this repo has no e2e suite —
> `pnpm test:e2e` does not exist), so instead of a live repro it does the most rigorous static
> re-verification available — closing a real gap found while reading the existing specs: every
> test that covers this chain (`guest-manager.spec.ts`'s T308 describe block,
> `guest-profile-modal.spec.ts`'s `open(userId, { edit: true })` case) exercises its own link in
> isolation, calling the *next* component's method directly rather than clicking through a really
> rendered DOM tree that has `GuestManager`, `ManageRsvpModal` and `GuestProfileModal` all mounted
> together — exactly the kind of gap that would hide an integration bug a user could actually hit.
> T314 closes it.
>
> **Part 2 — self-service "My RSVP"** (`screens/rsvp-edit` → `app-rsvp-editor
> perspective="owner"`) has no equivalent today — confirmed via code: `rsvp-edit.html` does not
> bind `app-rsvp-editor`'s `(openProfile)` output at all, and `canOpenProfile()` in
> `rsvp-editor.ts` gates the link on `perspective() === 'couple'` only. This is not a bug; Phase U
> explicitly scoped it out ("A linked-partner profile-editing UI … is a separate, explicitly-scoped
> follow-up") because nothing in the app could act on it yet. The user's request is exactly that
> follow-up, and it is now buildable: `PATCH /v1/profile/{id}`'s `assertCanActOnUser`
> (`wedding-api/src/common/policy/user-delegation.ts`) already authorizes a guest to edit a linked
> partner's profile (`targetUser.role === 'guest' && targetUser.partnerId === requester.id`), and
> `GET /v1/profile/{id}` has no authorization check beyond authentication. **In-repo ADR W-0006**
> (`docs/decisions/W-0006-self-service-partner-profile-edit.md`) records the design decisions this
> phase's intro would otherwise leave to the implementer to guess: generalize
> `ProfileModalService`/`app-profile-modal` (widen the existing "My profile" overlay to accept an
> optional edit target) rather than build a third profile-editing surface; keep `lockContact` on
> and `showRelation` off, matching the guest's own profile-modal call site's existing behavior
> unchanged (T312's precedent — not silently upgraded here either); the modal's fixed-header title
> distinguishes "My profile" from a partner's; and `PrivateLayout` — the only place that performs
> the actual write — resolves and fetches whichever profile is the real edit target instead of
> hardcoding "the signed-in user," since this is the first "edit someone else, as a non-admin" call
> site in this app. T315–T319 implement it, read ADR W-0006 first.

### T314 — Guest manager "open their profile" jump: full-chain re-verification + close the integration-test gap
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing
- **Why:** the user reported this flow "not working." Static review of the whole chain — the
  component code, T269's and T308's own acceptance criteria, and every existing spec — found no
  defect. This agent has no Bash tool and this repo has no e2e suite (`pnpm test:e2e` does not
  exist per CLAUDE.md), so a live browser repro is not available; the mandate instead is the most
  rigorous static re-verification available, which surfaced a real, specific gap: **no existing
  test renders `GuestManager`, `ManageRsvpModal` and `GuestProfileModal` together and clicks
  through the real DOM from the RSVP editor's "Open their profile" link to the rendered edit
  form** — every existing test calls the next component's method directly instead
  (`guest-manager.spec.ts`'s `it('the RSVP editor jump (openGuestProfileEdit) opens straight into
  edit mode', …)` calls `fixture.componentInstance.openGuestProfileEdit('guest-1')` directly, not a
  simulated click; `guest-profile-modal.spec.ts`'s `it('open(userId, { edit: true }) lands
  straight into edit mode, seeded like startEdit()', …)` calls `.open()` directly on a
  `GuestProfileModal` mounted alone). This is exactly the kind of gap that would hide a real
  integration bug (an event never actually bound in the rendered template, a `ViewChild` resolved
  before the child it targets exists, a change-detection edge under zoneless/OnPush) while every
  per-link unit test still passes.
- **Acceptance:**
  - A new test (extend `guest-manager.spec.ts`'s existing `describe('GuestManager — "open their
    profile" edit-mode jump (T308)', …)` block, or a new sibling `describe`, implementer's call)
    mounts `GuestManager` alone (it already declares `GuestProfileModal`, `ManageRsvpModal`,
    `GuestCreateModal` as `imports` and resolves them via `@ViewChild`, so no extra host harness is
    needed — `guest-manager.html` mounts both `app-guest-profile-modal` and `app-manage-rsvp-modal`
    unconditionally as siblings, lines ~276–283).
  - Seeds the `UserProfileDto` collection with **two** profiles — the primary guest (`id: 'guest-1'`)
    and their linked partner (`id: 'guest-2'`, distinct `firstName`/`lastName`/`nickname`/
    `guestInfo.relation` so a seeding mismatch would be visible in the assertion) — and the `RsvpDto`
    collection with one record shaped like `manage-rsvp-modal.spec.ts`'s existing
    `rsvpWithLinkedPartner()` fixture (`adults.partner2: { id: 'guest-2', kind: 'guest', ... }`),
    reusing that exact shape rather than inventing a parallel one.
  - Drives the flow through real DOM events end to end, not component-instance method calls: open
    the manage-RSVP overlay (either `fixture.componentInstance.openManageRsvp('guest-1')`, which is
    itself a real production entry point — the "Manage RSVP" button — or a simulated row click,
    implementer's call), expand the partner's card (`.card-head` click, mirroring
    `manage-rsvp-modal.spec.ts`'s `openPartnerCard()` helper), click the real
    `app-rsvp-editor .name-hint .profile-link` button rendered in the DOM — **not**
    `requestProfile()` or `openGuestProfileEdit()` called directly.
  - Asserts, after the click, on the real rendered output of `GuestProfileModal`: its edit-mode
    form is showing (not the read-only `'profile'` view), and the visible field values are
    guest-2's — e.g. the rendered `firstName`/`lastName` inputs' `.value`, not
    `fixture.componentInstance.profileModal.editDraft()` read internally. This is the assertion
    that would have caught a data-shape mismatch or an unbound event that `.editDraft()` read
    directly could not.
  - If this test fails against the current code (i.e. this task does find the bug the user
    reported that static review missed): fix it, and the PR description states plainly what was
    wrong and why static review didn't catch it — do not just make the new test pass by weakening
    the assertion.
  - If this test passes on the first try against unmodified code: say so explicitly in the PR
    description, and note that the user's report could not be reproduced by any means available in
    this environment — this closes the coverage gap regardless, but does not confirm or rule out an
    environment-specific issue (a stale deployed bundle, a data shape only the real API produces,
    browser-specific behavior) outside this repo's reach.
  - Full pre-merge gate green (`pnpm typecheck && pnpm lint && pnpm test`).
- **Refs:** T269, T308; `src/app/screens/guest-manager/guest-manager.ts`
  (`openGuestProfile`/`openGuestProfileEdit`, L214-226), `guest-manager.html` (L275-283);
  `src/app/screens/guest-manager/modal/manage-rsvp-modal.ts` (`onOpenProfile`, L172-177),
  `manage-rsvp-modal.spec.ts` (`rsvpWithLinkedPartner()`, `openPartnerCard()`);
  `src/app/screens/guest-manager/modal/guest-profile-modal.ts` (`open()`, L241-252);
  `src/app/shared/rsvp-editor/rsvp-editor.ts` (`canOpenProfile`/`requestProfile`, L359-368),
  `rsvp-editor.html` (L151-162, the `.profile-link` button)

### T315 — `ProfileModalService`: accept an optional edit target
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing
- **Why:** ADR W-0006 Decision 1 — the "My profile" overlay's open/close service currently only
  ever means "the signed-in user's own profile." This task widens it to also carry *whose* profile
  is being edited, with no behavior change for either existing call site.
- **Acceptance:**
  - `ProfileModalService.open()` becomes `open(targetUserId?: string): void`. A new private signal
    (e.g. `_targetUserId = signal<string | null>(null)`) is set to `targetUserId ?? null` on every
    call; a new public `readonly targetUserId: Signal<string | null>` is exposed
    (`asReadonly()`, mirroring `isOpen`'s existing pattern).
  - `close()` also resets `_targetUserId` back to `null` — so a stale partner id from a previous
    open cannot leak into the next no-argument (self) open. (`isOpen` already goes back to
    `false`; this is the equivalent reset for the new signal.)
  - `ScreenHeader`'s account-dropdown call site (`screen-header.ts:135`, `this.profileModal.open()`)
    and `People`'s "isMine" card (`people.ts:200`, `this.profileModal.open()`) are **not** touched —
    both keep calling `open()` with no argument, which continues to mean "self" (`targetUserId()`
    stays `null`).
  - Unit tests (`profile-modal.service.spec.ts`): `open()` with no argument leaves `targetUserId()`
    `null` (existing self-only behavior, now asserted explicitly); `open('u2')` sets `targetUserId()`
    to `'u2'`; `close()` resets both `isOpen()` and `targetUserId()`.
  - Full pre-merge gate green.
- **Refs:** ADR W-0006 (this repo) Decision 1; `src/app/core/service/profile-modal.service.ts`;
  `src/app/shared/screen-header/screen-header.ts:135`; `src/app/screens/people/people.ts:200`; T304
  (original service)

### T316 — `ProfileModal`: distinguish "My profile" from a partner's in the fixed header
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing (touches `profile-modal.ts`/`.html` only; independent of T315's service
  change, though both land before T317 wires them together)
- **Why:** ADR W-0006 Decision 5 — `resolvedTitle` always reads `shared.myProfile` today. Once this
  same component can be opened on a partner's profile (T317), claiming "My profile" while showing
  someone else's data would be actively misleading, not just imprecise.
- **Acceptance:**
  - `ProfileModal` gains `readonly isOwnProfile = input(true)` — defaulting `true` preserves every
    existing call site's behavior (there is exactly one today, `private-layout.html`) with no
    binding change required until T317.
  - `resolvedTitle` (currently `computed(() => { this.lang(); return
    this.translateService.instant('shared.myProfile'); })`, L116-119) branches on `isOwnProfile()`:
    `true` keeps `shared.myProfile`; `false` reads a new key, `profileModal.partnerTitle`.
  - New i18n key `profileModal.partnerTitle` in `public/i18n/{es,en,fr}.json` — "Partner's profile"
    / "Perfil de tu pareja" / "Profil de votre partenaire" (or equivalent; implementer's call on
    exact wording, matching this app's existing tone — no DS mock exists for this string since the
    DS's `ProfileModal.jsx` has no partner-edit mode, so there is nothing to match verbatim).
  - The identity block (avatar, name, nickname, role/relation pills, `profile-modal.html` L10-45)
    is **not** changed — it already reads reactively off `profile()`/`firstName()`/`lastName()`/
    `nickname()`, so it will correctly show the partner's identity once `profile()` is a partner's
    `UserProfileDto` (T317's job); confirm this in the PR rather than re-deriving it.
  - Unit tests (`profile-modal.spec.ts`): `resolvedTitle()` (or the rendered `app-modal[title]`)
    reads "My profile" when `isOwnProfile` is left at its default; reads the new partner copy when
    `isOwnProfile` is bound `false`.
  - Full pre-merge gate green.
- **Refs:** ADR W-0006 Decision 5; `src/app/shared/profile-modal/profile-modal.ts` (`resolvedTitle`,
  L116-119); `public/i18n/{es,en,fr}.json`; T303 (original build)

### T317 — `PrivateLayout`: resolve, fetch and write the real edit target, not always self
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T315 (`ProfileModalService.targetUserId()`), T316 (`isOwnProfile` input to bind)
- **Why:** ADR W-0006 Decision 4 — this is the first "edit someone else, as a non-admin" write path
  in this app. `PrivateLayout.onProfileSave()` and `ownProfile` both hardcode "the signed-in user,"
  an assumption this task must retire explicitly rather than let a partner-targeted save silently
  fall through to a self write.
- **Acceptance:**
  - `ownProfile` (`private-layout.ts` L101-109, currently keyed on
    `LoginService.currentUserClaims()?.sub` alone) is joined by — or replaced by, implementer's
    call, document which — a `resolvedProfile` computed keyed on
    `this.profileModal.targetUserId() ?? currentUser?.sub`, looked up against the same
    `userProfileCollection.entities$`.
  - Unlike the self case (already guaranteed cached before this modal can open, per this file's own
    existing doc comment on `ScreenHeader`'s init fetch), a partner's profile is **not**
    pre-loaded anywhere in a guest's own session. A `constructor()` `effect()` (or equivalent)
    calls `this.userProfileCollection.getByKey(targetUserId)` whenever
    `profileModal.targetUserId()` is a non-null id not already present in the cache — mirroring
    `guest-profile-modal.ts`'s existing "fetch by id if not already cached" shape, not a new
    pattern.
  - `<app-profile-modal>`'s binding in `private-layout.html` passes `[profile]="resolvedProfile()"`
    (was `ownProfile()`) and a new `[isOwnProfile]="!profileModal.targetUserId()"` (T316's input).
  - `onProfileSave()` (L163-189) reads `resolvedProfile()` instead of `ownProfile()` for both the
    early-return guard and the `id` it sends — `id: profile.id` now correctly resolves to whichever
    profile is the real target, partner or self, never assumed.
  - Its doc comment (L60-70, L152-162) is corrected: "resolves the signed-in user's `UserProfileDto`"
    becomes "resolves whichever profile `ProfileModalService.targetUserId()` points at, defaulting
    to the signed-in user's own" — and the "id is carried forward unchanged" line is confirmed
    still accurate (it is — `resolvedProfile().id` is still what's sent, just no longer assumed to
    equal the signed-in user's own id).
  - Unit tests (`private-layout.spec.ts`, extending the existing T304/T305 describe blocks or a new
    sibling): opening with `profileModal.open('guest-2')` (a second `UserProfileDto` seeded in the
    collection, distinct from the T305 fixture's `ownProfile()`) renders `app-profile-modal` with
    guest-2's data and `isOwnProfile` false; if guest-2 is **not** pre-seeded in the cache,
    `getByKey('guest-2')` is called (spy on `WeddingUserProfileService.profileControllerGetV1` or
    equivalent, mirroring how T305's existing tests spy on
    `profileControllerUpdateProfileByIdV1`); `save.emit(...)` while targeting guest-2 calls
    `updateSpy` with `id: 'guest-2'`, not the signed-in user's own id — this is the one assertion
    that would have caught a silently-reused self-only write. The existing T305 no-argument-`open()`
    tests (asserting `call.id === 'u1'`) must still pass unmodified — self-edit is not regressed.
  - Full pre-merge gate green.
- **Refs:** ADR W-0006 Decision 4; `src/app/layouts/private-layout/private-layout.ts`
  (`ownProfile` L101-109, `onProfileSave` L163-189), `private-layout.html`; T304/T305 (original
  self-only build); `src/app/screens/guest-manager/modal/guest-profile-modal.ts` (fetch-if-not-cached
  precedent)

### T318 — `rsvp-editor`: offer "Open their profile" in the `owner` perspective too
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** nothing (touches only `rsvp-editor.ts`/`.html`/`.spec.ts`; independent of
  T315-T317, though T319 needs this landed first to have any visible effect)
- **Why:** ADR W-0006 Decision 3 — the gate that gave the couple's editor sole ownership of this
  link ("the guest-manager is the one surface with a profile overlay to swap to") stops being true
  once the owner-perspective screen has one too (T319).
- **Acceptance:**
  - `canOpenProfile()` (`rsvp-editor.ts` L360-362, currently `return this.perspective() === 'couple'
    && !!card.accountId;`) widens to `return (this.perspective() === 'couple' || this.perspective()
    === 'owner') && !!card.accountId;`.
  - The `openProfile` output's class doc comment (L140-148, "it renders in the `couple` perspective
    alone, because the guest-manager is the one surface with a profile overlay to swap to. The
    guest's own screen binds nothing and gets no trigger.") is corrected to state both perspectives
    now render it, and that the guest's own screen (`rsvp-edit`, T319) does bind it, to
    `ProfileModalService.open()` (ADR W-0006) rather than an overlay swap.
  - No template change is needed in `rsvp-editor.html` — the `@if (canOpenProfile(card))` gate
    (L156) already renders `.profile-link` for whichever perspective the widened method now
    permits; `requestProfile()` (L365-368) is unchanged, it already just emits `card.accountId`
    regardless of perspective.
  - Two existing tests in `rsvp-editor.spec.ts` currently assert the **old** (soon-to-be-wrong)
    behavior and must flip: `it('renders no trigger in the owner perspective, even for a linked
    partner', …)` (L391-397) becomes an assertion that the trigger **does** render and its click
    **does** emit the partner's id, for the `owner` perspective — mirroring the existing `'couple'`
    case's assertions just above it (L359-381) rather than being deleted; `it('emits nothing when
    the guest surface calls the action programmatically', …)` (L399-413) is removed or repurposed —
    the premise "the guest surface" no longer has a distinct behavior from the couple's, so this
    test's name and intent are now false. Keep the plus-one case (`it('renders no trigger for a
    plus-one partner', …)`, L383-389) unchanged — that gate is `!!card.accountId`, untouched by this
    task, and still correctly excludes a plus-one in every perspective.
  - Add (or extend the flipped test to cover) the couple-perspective case's full assertions for
    `owner` too: trigger text, `.name-hint` sentence composition, and — critically — that a jump
    does **not** touch `draftChange` (`emitted.length` stays `0`), same as the couple case already
    asserts.
  - Full pre-merge gate green.
- **Refs:** ADR W-0006 Decision 3; `src/app/shared/rsvp-editor/rsvp-editor.ts` (`canOpenProfile`
  L360-362, `openProfile` output doc L140-148); `rsvp-editor.spec.ts` (L359-413); T269/T308 (couple
  perspective precedent, unchanged)

### T319 — `rsvp-edit`: wire "Open their profile" to the generalized `ProfileModalService`
- **Status:** done
- **Owner:** agent (implementer)
- **Depends on:** T315 (`ProfileModalService.open(targetUserId)`), T318 (the link now renders in
  `owner` perspective)
- **Why:** ADR W-0006 Decision 3 — this is the actual entry point the user asked for: from their
  own "My RSVP" screen, a guest whose partner has their own guest account can now reach that
  partner's profile-edit modal.
- **Acceptance:**
  - `rsvp-edit.ts` injects `ProfileModalService` and gains a handler (e.g. `onOpenProfile(userId:
    string): void { this.profileModal.open(userId); }`) — no local state, this screen owns no
    overlay of its own (ADR W-0006 Decision 3's shell-level pattern, same as `ScreenHeader`/`People`
    already do for the self case).
  - `rsvp-edit.html`'s `<app-rsvp-editor [draft]="draft()" perspective="owner" [showStatus]="true"
    (draftChange)="onDraftChange($event)" />` (L29-34) gains `(openProfile)="onOpenProfile($event)"`.
  - Unit tests (`rsvp-edit.spec.ts`): using a draft shaped like the couple-side fixture's
    linked-partner case (T318's tests / `manage-rsvp-modal.spec.ts`'s `rsvpWithLinkedPartner()`
    shape, ported to `RsvpDraft`), a real click on the rendered `app-rsvp-editor
    .name-hint .profile-link` calls through to `ProfileModalService.open` with the partner's id —
    inject `ProfileModalService` (or a test double with a spied `open`) into the `TestBed`, mirroring
    how `private-layout.spec.ts` already injects and asserts against it. Also assert the existing
    "no link for a plus-one partner" case still holds (T318's gate is unchanged for that path).
  - Full pre-merge gate green.
- **Refs:** ADR W-0006 Decision 3; `src/app/screens/rsvp-edit/rsvp-edit.ts`,
  `rsvp-edit.html` (L29-34); `src/app/core/service/profile-modal.service.ts` (T315);
  `src/app/layouts/private-layout/private-layout.spec.ts` (injection precedent)

### Deliberately out of scope for Phase V
- **Contact-field (`email`/`phoneNumber`) editing for a linked partner**, from either surface.
  `lockContact` stays on wherever this phase touches a profile-edit form — ADR W-0006 Decision 2.
- **Relation (`side`/`kind`/`link`) self-service editing**, from either surface — `showRelation`
  stays off, ADR W-0006 Decision 2, same as T312's existing precedent for the guest's own profile.
- **A live/browser repro of the user's original report for Part 1.** T314 is the most rigorous
  re-verification available in this environment (no Bash tool, no e2e suite); if it passes clean
  against unmodified code, the report is not reproduced here, but is not thereby proven wrong
  either — see T314's acceptance for what that outcome does and doesn't establish.
- **A full router-spanning integration test for Part 2** (mounting `PrivateLayout` with a routed
  `RsvpEdit` child and clicking all the way through). T317's and T319's own component-level tests
  (mirroring the granularity T304/T305 and T308 already established for the equivalent self-edit
  and couple-edit paths) are judged sufficient; unlike Part 1, there was no specific user report of
  this exact chain failing to motivate the extra integration-test cost.

> **DS re-sync: solo decline (commit `2bf80a927e347422dbbc5a595251aaaa2c704824`).** The design
> system's `RSVPEditor.jsx` gained `rsvpCanDeclineAlone`/`rsvpComing`/`rsvpAttending`/`selfCard` —
> an adult who has their **own guest account** can mark themselves not attending without leaving
> the RSVP (their meal/allergy data and, in this app, their account stay; the rest of the party is
> unaffected), a "Not attending" pill/summary line, and the party-total line becoming conditional
> ("Attending: X of N" vs "Total: N").
>
> **What already exists on the wire, so this is not a contract change:** `RsvpDtoAdultsPartner1`
> and `RsvpDtoAdultsPartner2OneOf` (the account-holder variant of the `partner2` union) already
> carry `attending?: boolean` — added when `kind` landed (ADR W-0004) and, per that ADR's amendment,
> deliberately unused since: *"nothing in this app reads or writes `attending` on `partner1`… a
> member-level `attending` flag has only ever had a purpose on `partner2`."* `RsvpDtoAdultsPartner2OneOf1`
> (the plus-one variant, no account) and `RsvpDtoChildrenInner` correctly have **no** `attending`
> field at all — which already matches the DS gate (`hasAccount` required). No `pnpm gen:api` is
> needed for any task below.
>
> **What is *not* settled** — flagged once as T320, not repeated per task — is what a solo decline
> *means* next to `RsvpDto.status` and the hub's audience/headcount logic. ADR W-0002
> ("Explicitly not decided") raised exactly this in 2026-08-21 and it was never picked up; T320 is
> that follow-up. Every implementation task below is scoped to stay clear of that undecided ground:
> this app's shape caps a party at two adults (`partner1` + optional `partner2`), so "an adult with
> their own account, in a party of more than one adult" collapses to **`partner2`, only when
> `partnerHasAccount(partner2)`** — `partner1` is never eligible (see T320 for why the DS's more
> general rule would technically allow it, and why that's excluded here), and neither are children
> (the contract already forbids it structurally).
>
> Sequence: T320 (escalate, non-blocking) can run any time. T321 (foundation: draft field, pure
> helpers, ADR, i18n keys) blocks T322–T324 (the three pieces of visible UI), which are otherwise
> independent of each other. T325 (aggregate surfaces — guest-list headcount, guest-manager partner
> line) is **blocked** on T320's answer and must not start before it lands.

### T320 — [ESCALATION → hub] RSVP solo decline: does it change audience / headcount semantics?
- **Status:** todo — **escalated, non-blocking** for T321–T324 (they only add UI over a wire field
  that already exists and write it as opaque guest-entered data). **Blocking** for T325.
- **Owner:** system-architect (decision, likely with `wedding-api`) → wedding-web implementer (mirror)
- **Depends on:** —
- **The gap, concretely:**
  - DS `rsvpCanDeclineAlone(p, people)` lets an adult with their own guest account independently
    set `attending: 'no'` while the RSVP's own `status` stays `attending` and the rest of the party
    is untouched. Translated to this repo's contract, that is `RsvpDtoAdultsPartner2OneOf.attending
    = false` sitting alongside `RsvpDto.status === 'attending'` on the same document.
  - Hub ADR-0030 §8 defines the `attending` and `attending-no-menu` announcement audiences purely
    off `RsvpDto.status`. Today a solo-declined partner would still be counted in both — still
    targeted by a "menu selection reminder" or a "thank you" they explicitly said they weren't
    coming to.
  - The couple's guest-list headcount (`StatisticService.guestStatistics`, this repo,
    `src/app/core/service/statistic.service.ts`) sums `ProfileRsvp.adults` — a raw count off
    `UserProfileListResponseDtoProfilesInnerGuestInfoRsvp`, which has no per-adult breakdown at
    all — so a solo decline would not reduce it either, at either the profile-summary or the
    `RsvpListResponseDtoItemsInner` (guest-manager table row) shape.
  - Nothing server-side is known to validate `rsvpCanDeclineAlone`'s eligibility rule (adult ∧
    has-own-account ∧ more than one adult in the party) — a client could in principle PATCH
    `attending: false` onto a plus-one's slot if the wire ever allowed it (it structurally doesn't,
    for `partner1`/`partner2` OneOf1/children — see the re-sync note above — which is the one
    piece of enforcement that does already exist, for free, as a side effect of ADR W-0004).
  - ADR W-0002 §"Explicitly not decided" already flagged the general question ("`attending` on the
    partner variant… deciding what it means next to the RSVP's own status is a modelling question
    for the API side") on 2026-08-21; it was never actioned. This is that follow-up, now with a
    concrete DS behaviour attached to it.
  - **Whether `partner1` is ever eligible.** The DS's rule is generic over "adults in the party";
    applied literally to this app's two-adult-max shape, `partner1` (the RSVP's own primary/owner)
    would qualify too whenever a `partner2` is present, since the primary always "has an account".
    That reading conflicts with ADR W-0004's amendment, which treats `partner1.attending` as inert
    and treats `RsvpDto.status` as the sole authority on the primary's own attendance. This repo's
    tasks below assume **`partner1` is never eligible** (T321's `canDeclineAlone` hard-codes it),
    but that is this repo's interim reading, not a hub ruling — confirm or correct it.
    **RESOLVED 2026-08-30 by the user**, who was asked this question directly and answered that
    `partner1` **should** be eligible — they are concurrently hand-editing `rsvp-create.ts` to seed
    `partner1.attending = true` on a "yes" answer, which only makes sense if the primary can later
    step back out. Recorded as ADR W-0007 §Amendment; the code change is **T326**. This resolves
    *only* the `partner1`-eligibility sub-question — everything else in this escalation (audiences,
    headcount, server-side validation) is still open and still blocks T325.
- **PARTIALLY RESOLVED 2026-08-30 by the user** (second ruling, after the `partner1` one above):
  *"an RSVP is declined when both adults have declined. If only one of them comes the RSVP is still
  confirmed."* So `status` is the party-level roll-up of the per-adult flags — see ADR W-0007
  §Amendment2.5, implementation is **T328**. This settles the `status` half. It does **not** settle
  the audience/headcount half below: knowing that a one-adult-declined party is still `attending`
  does not say whether the declined adult is still in the `attending-no-menu` audience, or still
  counted in the couple's headcount tiles. Those stay open and still block T325.
- **The question for the hub:** when an adult solo-declines, is their seat still counted in
  `attending`/`attending-no-menu` (and in the guest-list headcount, and in whatever a "final
  headcount to the caterer" internal milestone reads), or excluded from all of them? Does
  `partner1` ever get to solo-decline, or is that solely `partner2`'s affordance in this app's
  two-adult shape? Either answer is workable; it needs to be decided once, centrally, not implied
  by whichever repo ships a UI for it first.
- **Interim rule (in force until the hub says otherwise, recorded as in-repo ADR W-0007 in T321):**
  wedding-web renders and writes the toggle as opaque guest-entered data only. `StatisticService`,
  the guest-manager row/partner line, the profile modal's partner row, and any other
  count/audience-adjacent surface are **explicitly not touched** by T321–T324 — that follow-up is
  T325, and it stays `blocked` until this escalation resolves.
- **Refs:** hub ADR-0022 (single mutable RSVP, `status`), ADR-0024 (participants), ADR-0030 §8
  (`attending`/`attending-no-menu` audiences), `GLOSSARY.md` §RSVP / Response, §Audience,
  §Participant; in-repo ADR W-0002 §"Explicitly not decided", ADR W-0004 (where `attending` first
  landed on the wire, unused); DS commit `2bf80a927e347422dbbc5a595251aaaa2c704824`
  (`ui_kits/wedding-app/RSVPEditor.jsx`); `src/app/core/service/statistic.service.ts`;
  `src/app/core/api/model/{rsvp-dto-adults-partner1,rsvp-dto-adults-partner2-one-of,rsvp-dto-adults-partner2-one-of1,user-profile-list-response-dto-profiles-inner-guest-info-rsvp}.ts`

### T321 — Foundation: `attending` on the draft, pure helpers, in-repo ADR W-0007, i18n keys
- **Status:** done — implemented as specified below (`partner2`-only), then **immediately widened by
  T326** after the user resolved T320's `partner1` sub-question the other way. The acceptance
  criteria below are left as-written for the audit trail; where they say "never `partner1`", read
  T326 as the correction. Gate at time of completion: `typecheck` clean, `lint` = only the 4 known
  pre-existing `shared/modal` errors, `gen:api:check` clean, `test` = 7 pre-existing failures on
  `main` (unrelated: `people`/`rsvp-editor`/`rsvp-edit`/`manage-rsvp-modal` specs, verified present
  at clean HEAD), all 15 new `rsvp-draft.spec.ts` tests passing.
- **Owner:** agent (implementer)
- **Depends on:** —
- **Why:** Same shape as T264/T283's "foundation" tasks — land the model, the pure logic and the
  copy in one commit with **no template changes**, so T322–T324 each touch `rsvp-editor.html` for
  one concern and cannot conflict with each other in `public/i18n/*.json`.
- **Acceptance:**
  - `AdultDraft` (`src/app/core/helper/rsvp-draft.ts`) gains an optional `attending?: boolean`,
    typed exactly as the generated `RsvpDtoAdultsPartner1.attending` / `RsvpDtoAdultsPartner2OneOf.attending`
    already are — no new type, no hand-written union (Hard rule 15). Document, next to the field,
    that it is only ever meaningful on `partner2` and only when `partnerHasAccount(partner2)` is
    true, mirroring the existing doc comment on `AdultDraft.kind`.
  - `toRsvpDraft`: read `partner2.attending` with an `in` check (`'attending' in rsvp.adults.partner2
    ? rsvp.adults.partner2.attending : undefined`) — the same pattern ADR W-0004 already established
    for reading `.id` off the non-discriminating union. **`partner1.attending` is deliberately not
    read** (stays `undefined` in the draft) — carrying forward a field this repo does not act on
    would silently resurrect the "dead weight" ADR W-0004 documented.
  - `fromRsvpDraft`: the `partner2` object-literal branch that already carries an `id` (i.e. builds
    the `…OneOf` shape) gains `attending: draft.partner2.attending`. The `id`-less branch (`…OneOf1`)
    is **not** touched — that interface has no `attending` field, so adding one would not compile,
    which is the point: the wire already refuses this for a plus-one. `partner1`'s object literal is
    unchanged (still never emits `attending`).
  - New pure functions, exported from `rsvp-draft.ts` (or a sibling helper file under
    `src/app/core/helper/`, consistent with where `partnerHasAccount` already lives):
    - `canDeclineAlone(draft: RsvpDraft, key: PersonKey): boolean` — `true` **only** for
      `key === 'partner2'` when `draft.partner2` exists and `partnerHasAccount(draft.partner2)` is
      true. Hard-codes "never `partner1`, never a child" per T320's interim reading — doc comment
      says so and points at T320.
    - `isPersonComing(person: { attending?: boolean } | undefined): boolean` — `person?.attending
      !== false` (absent or `true` ⇒ coming; this is the boolean mirror of the DS's `rsvpComing`).
    - `attendingCount(draft: RsvpDraft): number` — total party size minus one when `partner2` both
      `canDeclineAlone` and has explicitly declined (`draft.partner2.attending === false`); the
      mirror of the DS's `rsvpAttending`, specialised to this app's fixed two-adult-max shape rather
      than a generic `people[]` walk.
  - New in-repo **ADR W-0007** (`docs/decisions/W-0007-partner-solo-decline.md`) recording: the
    scope decision (solo decline is `partner2`-with-account only, never `partner1`, never a child),
    the pointer to T320 as an open, non-blocking hub question, and the interim rule that
    count/audience-adjacent surfaces are untouched until T320 resolves (T325).
  - New i18n keys, all three of `public/i18n/{en,es,fr}.json`, under `rsvp.editor`:
    - `attendingOfTotal`: `"Attending: {{attending}} of {{total}}"` (existing `total`:
      `"Total: {{count}}"` is kept, for the equal case)
    - `person.notAttending`: `"Not attending"`
    - `attending.sectionLabel`: `"Attending"` (the small uppercase label, matching `person.meal` /
      `person.allergies`'s register)
    - `attending.label`: `"{{name}} will be there"` and `attending.fallbackName`: `"They"` — used
      together the same way `removeDialogMessage()` already composes `fullName(card) ||
      translate.instant(fallbackKey)`
    - `attending.hint.coming`: `"Switch this off if they cannot make it — their account, meal and
      allergy details stay, so they can be switched back any time."`
    - `attending.hint.declined`: `"They stay on this RSVP and can be switched back to attending
      right up to the day."`
    - **No first-person (`I will be there` / "your account…") variant is added.** The DS's
      `selfCard()` first-person copy is only reachable when the person viewing the card *is* the
      account it belongs to — in this app that would require the DS's unbuilt `partner` perspective
      (ADR W-0003 §Decision.3: not added until a call site exists). Adding unreachable copy here
      repeats the exact mistake that decision already named ("an unreachable perspective means
      untranslated keys nobody notices"). If/when a `partner` perspective is built, this is a copy
      addition, not a template change — `attending.label`/`attending.hint.*` become
      perspective-keyed the same way `party`/`note`/etc. already are.
  - Unit spec additions (`rsvp-draft.spec.ts`): `canDeclineAlone` — false for `partner1`, false for
    a child key, false for an absent `partner2`, false for a plus-one `partner2`, true only for an
    account-holding `partner2`; `isPersonComing` — true when `attending` is `undefined`/`true`,
    false only when explicitly `false`; `attendingCount` — matches `cards().length` (i.e. `total`)
    whenever nobody has solo-declined, drops by exactly one when an account-holding `partner2` has
    `attending: false`, and is unaffected by a plus-one `partner2` or a child ever "declining"
    (they structurally cannot). `toRsvpDraft`/`fromRsvpDraft` round-trip spec: an account-holding
    `partner2.attending: false` survives `toRsvpDraft` → `fromRsvpDraft`; a plus-one `partner2`'s
    serialised output has no `attending` key at all (mirrors the existing "no `kind` on a serialised
    child" assertion from ADR W-0004's consequences).
  - `pnpm typecheck && pnpm lint && pnpm test` green; `pnpm gen:api:check` clean (no client
    regeneration is needed or expected — confirm this explicitly rather than assuming it).
- **Refs:** in-repo ADR W-0004 (`attending`'s origin, the `in`-check precedent), ADR W-0002
  ("Explicitly not decided"), new ADR W-0007; T320; DS `RSVPEditor.jsx` `rsvpCanDeclineAlone`,
  `rsvpComing`, `rsvpAttending` (commit `2bf80a927e347422dbbc5a595251aaaa2c704824`);
  `src/app/core/helper/{rsvp-draft.ts,partner-account.ts}`; `public/i18n/{en,es,fr}.json`

### T322 — `app-rsvp-editor`: per-person "Attending" toggle (any adult `canDeclineAlone` allows)
- **Status:** done — verified independently by the coordinator (diff reviewed, gate re-run):
  `typecheck` clean, `lint` 4 known pre-existing errors only, `test` 395 passed / 7 failed (the same
  7 pre-existing; +7 new tests all passing). Template gates on `@if (canDeclineAlone(draft(),
  card.key))` with no key special-casing; `setAttending` writes to `partner1` or `partner2` per
  `key`. Reuses `button[app-toggle]` (which owns its own `aria-checked`) and the existing
  `.label.options-label`; one new SCSS class (`.attending-hint`), tokens only.
- **Owner:** agent (implementer)
- **Depends on:** T321, **T326**
- **⚠️ Scope corrected 2026-08-30:** written when solo decline was `partner2`-only; the user has
  since ruled `partner1` eligible (ADR W-0007 §Amendment, T326). Every "only ever the `partner2`
  card" phrasing below is superseded. **Gate purely on `canDeclineAlone(draft(), card.key)` and do
  not special-case any key in the template or the component** — that helper is the single source of
  truth and T326 has already widened it. `setAttending(key, …)` must therefore write to whichever
  adult slot `key` names (`partner1` or `partner2`), not to `partner2` unconditionally; guard it the
  way `setAdultFirstName` already guards, and no-op for a child key. Spec coverage must include the
  primary card's toggle rendering and working — the opposite of what the bullets below assert.
- **Why:** The DS's `Toggle` section inside an open card — "Anyone with their own guest account
  can decline on their own without leaving the RSVP." This repo already has the exact component
  the DS calls for: `button[app-toggle]` (`src/app/shared/toggle/toggle.ts`), already used
  elsewhere in this app (`rsvp-create.html`'s "With my partner" / "With children" rows) — no new
  shared component is needed, this is wiring only.
- **Acceptance:**
  - `RsvpEditor`'s `imports` gains `Toggle`.
  - In `rsvp-editor.html`, inside an open card's body, a new "Attending" block renders **only**
    when `canDeclineAlone(draft(), card.key)` is true (in this app: only ever the `partner2` card,
    and only when it's the account-holding branch) — positioned after the existing name-hint /
    "Open their profile" block and before the "Meal" chips, matching the DS's structural order.
  - The block: the `attending.sectionLabel` uppercase label, a `button[app-toggle] [checked]="!
    <declined>" (toggled)="setAttending(card.key, $event)"` whose projected content is
    `attending.label` translated with `{ name: fullName(card) || translate.instant('rsvp.editor.attending.fallbackName') }`,
    and a hint paragraph switching between `attending.hint.coming` / `attending.hint.declined` on
    the current value. Third-person copy only, per T321 (no perspective branch here).
  - New protected method `setAttending(key: PersonKey, comingChecked: boolean): void` — emits a
    fresh draft with `partner2.attending` set to `comingChecked` (`true` clears any prior decline;
    `false` records it). Guard exactly like `setAdultFirstName`/`toggleDiet`: no-op for any key
    other than `partner2`, and no-op if `!draft.partner2`.
  - `PersonCard` (or a new computed keyed off it) exposes whatever the template needs to gate the
    block — reuse `canDeclineAlone(this.draft(), card.key)` directly rather than adding a redundant
    `PersonCard` field, unless the template ergonomics genuinely need one (judgment call, but don't
    duplicate the source of truth).
  - Unit spec additions (`rsvp-editor.spec.ts`): the block is absent for the primary card and for
    a child card in every fixture; absent for a plus-one `partner2`; present for an account-holding
    `partner2`, defaulting to checked/"coming" when `attending` is `undefined`; clicking it emits a
    draft with `partner2.attending: false` and the hint switches to `attending.hint.declined`;
    clicking again restores `attending: true` (not `undefined` — an explicit `true` is fine, the
    component does not need to reproduce "absent means yes" on write, only on read via
    `isPersonComing`). **Re-verify** the existing "Open their profile" suite (the `linkedPartner`
    fixture, lines ~334–400) still passes unmodified — the new block sits in the same card body and
    must not perturb its class-name-scoped queries.
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** T321; DS `RSVPEditor.jsx` L229-235 (the `Toggle` block), L27 (`rsvpComing`);
  `src/app/shared/rsvp-editor/{rsvp-editor.ts,rsvp-editor.html,rsvp-editor.spec.ts}`;
  `src/app/shared/toggle/toggle.ts`; precedent `src/app/screens/rsvp-create/rsvp-create.html` L36-48

### T323 — `app-rsvp-editor`: "Not attending" pill and summary line
- **Status:** done — verified independently by the coordinator (diff reviewed, gate re-run):
  `typecheck` clean, `lint` 4 known pre-existing errors only, `test` 399 passed / 7 failed (the same
  7 pre-existing; +4 new tests all passing). One `isDeclinedSolo(card)` gate feeds both the header
  pill and `summaryFor`'s leading bit, built from `canDeclineAlone` + T322's `isAttending` so it
  cannot drift from the toggle. `app-pill tone="soft"` — an existing tone (`'soft' | 'accent'`), the
  component's own default; none invented. No SCSS needed (`.name-row`'s flex+gap already fits a
  second pill).
- **Owner:** agent (implementer)
- **Depends on:** T321, **T326**
- **⚠️ Scope corrected 2026-08-30:** as T322 — `partner1` is now eligible (ADR W-0007 §Amendment).
  `isDeclinedSolo(card)` must read `canDeclineAlone(draft(), card.key)` for **any** card and look up
  that card's own draft person, so the pill and the summary prefix render on the primary card too.
  The bullets below saying the primary never shows them are superseded.
- **Why:** DS `summary(p)` prepends `'Not attending'` when `rsvpCanDeclineAlone(p, people) &&
  !rsvpComing(p)`, and the collapsed card header shows the same text as a second `<app-pill>`
  beside the role pill (`RSVPEditor.jsx` L141, L161).
- **Acceptance:**
  - `summaryFor(card)` (`rsvp-editor.ts`) prepends `translate.instant('rsvp.editor.person.notAttending')`
    as the **first** bit whenever `canDeclineAlone(this.draft(), card.key) && !isPersonComing(<that
    person's draft data>)` — ahead of age/diet/allergy bits, matching the DS's ordering.
  - `rsvp-editor.html`'s card header gains a second `<app-pill tone="soft">` (or whichever tone
    reads correctly against the existing role pill — check the DS's untoned `<Pill>` against this
    repo's `app-pill` tone options and pick the one the design spec calls for; do **not** invent a
    new tone) rendered under the same gate, immediately after the existing role pill.
  - Both gates read the same underlying condition — factor it into one `protected` method on the
    component (e.g. `isDeclinedSolo(card: PersonCard): boolean`) built from `canDeclineAlone` +
    `isPersonComing`, rather than duplicating the boolean expression in two template/TS spots.
  - Unit spec additions: for an account-holding `partner2` with `attending: false` — the pill
    renders in the collapsed header with the exact translated text, and `summaryFor` (or the
    rendered `.summary` text) leads with "Not attending" ahead of any diet/allergy bits. For the
    same partner2 with `attending: true`/`undefined`, and for every plus-one/child/primary
    fixture — neither the pill nor the summary prefix renders, regardless of whatever stale
    `attending` value might exist in the fixture (children/plus-ones can never reach this gate,
    but a test asserting that explicitly is cheap insurance against a future refactor of the gate).
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** T321, T322 (shares the same `canDeclineAlone`/`isPersonComing` gate); DS `RSVPEditor.jsx`
  L139-148 (`summary`), L161 (header pill); `src/app/shared/pill/pill.ts` (tone options);
  `src/app/shared/rsvp-editor/{rsvp-editor.ts,rsvp-editor.html,rsvp-editor.spec.ts}`

### T324 — `app-rsvp-editor`: party total line — "Attending: X of N" vs "Total: N"
- **Status:** done — verified independently by the coordinator (diff reviewed, gate re-run):
  `typecheck` clean, `lint` 4 known pre-existing errors only, `test` 405 passed / 7 failed (the same
  7 pre-existing; +6 new tests all passing), `gen:api:check` no drift. `.total` span is conditional
  on `attendingCount(draft()) === total()`; `total()` unchanged (declined members stay on the
  roster). Completes the port of DS commit `2bf80a9`.
- **Owner:** agent (implementer)
- **Depends on:** T321, **T326**
- **⚠️ Scope corrected 2026-08-30:** `attendingCount` now subtracts for `partner1` too, and can
  subtract twice (ADR W-0007 §Amendment, T326). Add a spec case for both adults declined in a party
  with children — e.g. 2 adults + 2 children renders `"Attending: 2 of 4"`. The template change
  itself is unaffected: it already reads `attendingCount(draft())` and needs no key awareness.
- **Why:** DS L260: `rsvpAttending(value) === rsvpTotal(value) ? 'Total: ' + rsvpTotal(value) :
  'Attending: ' + rsvpAttending(value) + ' of ' + rsvpTotal(value)`. Today `rsvp-editor.html` L30
  always renders `'rsvp.editor.total' | translate: { count: total() }` — unconditionally.
- **Acceptance:**
  - `rsvp-editor.html`'s `.party-meta .total` span becomes conditional: when
    `attendingCount(draft()) === total()`, render the existing `rsvp.editor.total` key unchanged
    (no visible regression for every party with nobody solo-declined — i.e. every party today);
    otherwise render the new `rsvp.editor.attendingOfTotal` key with `{ attending:
    attendingCount(draft()), total: total() }`.
  - `total()` itself is unchanged (`cards().length` — still the full party size, declined-solo
    members are **not** removed from the roster, only reflected in the count text and the pill/
    summary from T323).
  - Unit spec additions: a party with no `partner2`, or a `partner2` who is a plus-one, or an
    account-holding `partner2` with `attending` `true`/`undefined` — renders `"Total: N"` exactly as
    before (regression guard — this is the overwhelmingly common case and must not visibly change).
    An account-holding `partner2` with `attending: false` — renders `"Attending: {{N-1}} of {{N}}"`
    with the correct numbers for a party of primary + declined partner (2 → "Attending: 1 of 2")
    and for primary + declined partner + children (verifies children are never subtracted).
  - `pnpm typecheck && pnpm lint && pnpm test` green.
- **Refs:** T321; DS `RSVPEditor.jsx` L258-261; `src/app/shared/rsvp-editor/{rsvp-editor.ts,
  rsvp-editor.html,rsvp-editor.spec.ts}`; `public/i18n/{en,es,fr}.json` (`rsvp.editor.attendingOfTotal`)

### T325 — [blocked on T320] Reflect solo decline in count/audience-adjacent surfaces
- **Status:** blocked — do not start before T320 resolves.
- **Owner:** agent (implementer), decision inherited from T320
- **Depends on:** T320 (hub answer), T321–T324 (the toggle/pill/total must exist first)
- **Why:** T320 identified at least three surfaces this repo owns that read RSVP attendance without
  any awareness a party member can now solo-decline, and deliberately left them untouched pending
  the hub's answer: `StatisticService.guestStatistics` (guest-list headcount tiles), the
  guest-manager row / guest-profile-modal partner line (which currently shows account-vs-plus-one
  status only, per T257/T258, with no attendance state), and anything reading `RsvpListResponseDtoItemsInner`
  for a per-row party summary. This task is a placeholder for whichever of those the hub's answer
  says must change — it cannot be scoped in detail until that answer exists.
- **Acceptance (to be finalised once T320 resolves — do not treat the below as final):**
  - If the hub rules that a solo-declined adult is excluded from `attending`/`attending-no-menu`
    and from headcount: `StatisticService` and any admin-facing "N adults attending" surface must
    stop counting them, sourced from whatever contract shape the hub's answer implies (this may
    itself require a `wedding-api` contract change and a `pnpm gen:api`, since
    `UserProfileListResponseDtoProfilesInnerGuestInfoRsvp.adults` is currently an opaque count with
    no per-adult breakdown — flag that explicitly rather than inventing a client-side workaround).
  - If the hub rules it is *not* excluded (a display-only affordance with no aggregate effect):
    this task closes with no code change beyond a one-line note in ADR W-0007 recording the
    decision and why nothing changed.
  - Either way: no change here may alter `RsvpDto.status` itself or its meaning — that stays the
    RSVP's own single source of truth for "did this party answer, and how" (hub ADR-0022).
- **Refs:** T320 (the question), ADR W-0007 (T321, records the interim rule this task closes out);
  `src/app/core/service/statistic.service.ts`; `src/app/screens/guest-manager/`;
  hub ADR-0030 §8

### T326 — Widen solo decline to `partner1` (ADR W-0007 §Amendment)
- **Status:** done — verified independently by the coordinator (diff reviewed, gate re-run):
  `typecheck` clean, `lint` 4 known pre-existing `shared/modal` errors only, `test` 388 passed /
  7 failed — the same 7 pre-existing failures on `main`, no new ones. `canDeclineAlone` now returns
  `!!draft.partner2` for `partner1`; `attendingCount` subtracts per declined eligible adult;
  `partner1.attending` is read and written symmetrically with `partner2`.
- **Owner:** agent (implementer)
- **Depends on:** T321 (landed the narrow version this widens)
- **Why:** T320's `partner1` sub-question was put to the user and **resolved 2026-08-30: `partner1`
  is eligible.** T321 shipped the deliberately narrow `partner2`-only reading hours earlier; this is
  the correction, recorded in ADR W-0007 §Amendment. Must land **before** T322–T324, so those three
  build their UI over the final gate rather than over a rule that is about to change under them.
- **Acceptance:**
  - `canDeclineAlone(draft, key)` (`src/app/core/helper/rsvp-draft.ts`) becomes the design system's
    rule applied literally, for this app's two-adult-max shape:
    - `key === 'partner1'` → `true` **iff** `draft.partner2` exists (the DS's "more than one adult
      in the party" clause; the primary always has an account, so there is no account check).
      Deliberately **not** also requiring `partnerHasAccount(draft.partner2)` — see ADR W-0007
      §Amendment.3, which flags the account-less-plus-one-attending-alone case as a known,
      accepted-for-now consequence. Say so in the doc comment; do not quietly add the stricter gate.
    - `key === 'partner2'` → unchanged (`!!draft.partner2 && partnerHasAccount(draft.partner2)`).
    - any child key → unchanged `false` (structural: no `attending` on `RsvpDtoChildrenInner`).
  - `toRsvpDraft` now **reads** `rsvp.adults.partner1.attending` into the draft (plain property
    access — `RsvpDtoAdultsPartner1` is not a union, so no `in` check is needed or wanted here;
    keep the `in` check for `partner2`, which is a union). Remove T321's "deliberately not read"
    comment rather than leaving it to contradict the code.
  - `fromRsvpDraft` now **writes** `attending: draft.partner1.attending` on the `partner1` object
    literal, symmetrically with the account-holding `partner2` branch.
  - `attendingCount(draft)` subtracts for **each** adult who both `canDeclineAlone` and has
    `attending === false` — so a party of two adults who have both solo-declined counts 0 adults
    (plus any children). Today's implementation subtracts at most one; that is now wrong.
  - `AdultDraft.attending`'s doc comment is rewritten: it is meaningful on `partner1` (whenever a
    `partner2` exists) and on an account-holding `partner2`; it does not exist on the wire for a
    plus-one `partner2` or a child. Delete the "treat it as inert" / ADR W-0004 language — that is
    what the amendment supersedes.
  - **Do not touch** `src/app/screens/rsvp-create/rsvp-create.ts`. The user is hand-editing it
    concurrently to seed `attending` on answer; it is theirs, it is in flux, and it is out of scope
    here. If T326's changes appear to conflict with it, report that — do not resolve it.
  - Spec updates (`rsvp-draft.spec.ts`): T321's `it('is false for partner1, even alongside an
    account-holding partner2')` now asserts the **opposite** and must be flipped, not deleted.
    Add: `partner1` is *not* eligible when there is no `partner2` (party of one adult); `partner1`
    *is* eligible when `partner2` is a plus-one (the §Amendment.3 case — assert it explicitly so the
    known-odd behaviour is pinned and visible, with a comment pointing at the ADR); `attendingCount`
    drops by two when both adults have declined; round-trip — `partner1.attending: false` now
    survives `toRsvpDraft` → `fromRsvpDraft` (T321's `it('never reads partner1.attending off the
    DTO')` is now false and must be replaced, not left passing by coincidence).
  - `pnpm typecheck && pnpm lint && pnpm test` — typecheck clean, lint no new errors beyond the 4
    known `shared/modal` ones, and **no new test failures beyond the 7 pre-existing on `main`**
    (`people`/`rsvp-editor`/`rsvp-edit`/`manage-rsvp-modal`). Report the counts, do not claim green.
- **Refs:** ADR W-0007 §Amendment (the ruling); T320 (`partner1` sub-question, now resolved);
  T321 (what this widens); DS `RSVPEditor.jsx` `rsvpCanDeclineAlone` (commit `2bf80a9`);
  `src/app/core/helper/rsvp-draft.ts`, `rsvp-draft.spec.ts`

### T327 — Restore the partner "Open their profile" jump in the `owner` perspective + repair stale spec doubles
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** —
- **Why:** ADR W-0007 §Amendment2.6 — the user ruled that **every** edit to an account-holding adult
  goes through their profile, never the RSVP editor. That makes the "Open their profile" jump the
  *only* route to a locked name/nickname, so it must be reachable wherever a locked adult card
  renders. It currently is not: `canOpenProfile` (`rsvp-editor.ts` L431-436) reads
  `perspective() === 'couple' || card.accountId === loginService.currentUserClaims()?.sub`. The
  self-clause was evidently added so the primary (always `nameLocked`) can reach their own profile —
  correct and wanted — but it **replaced** T318's `owner`-perspective clause instead of joining it,
  so a guest can no longer open their *partner's* profile from their own RSVP. That is precisely
  what commit `da89aeb` ("generalize profile editing to allow guests to edit linked partner
  profiles") and T318/T319 shipped, and T318's own test now fails.
- **This is also the whole of the 7-failure red baseline on `main`.** All 7 trace to one incomplete
  refactor: production code moved to `LoginService.currentUserClaims()` (which does exist,
  `login.service.ts` L283) while the spec doubles were not updated to implement it.
- **Acceptance:**
  - `canOpenProfile` returns `true` for: the `couple` perspective (any account-holding card,
    unchanged); **and** any card whose `accountId` is set when the perspective is `owner` — which
    covers both the viewer's own card and their linked partner's. Keep the self-match clause or
    fold it into the `owner` clause, whichever reads cleaner, but do **not** regress the couple path
    and do **not** offer the jump for a plus-one or child (no `accountId` — the existing
    `!!card.accountId` gate in `requestProfile` and the template already handle this; verify).
  - Spec doubles for `LoginService` in `people.spec.ts` and `rsvp-editor.spec.ts` implement
    `currentUserClaims()` returning a shaped `AppJwtClaimsDto | undefined`. Do not weaken the
    assertions to make them pass — the 3 `people.spec.ts` nickname-search tests and the 2
    `rsvp-editor.spec.ts` tests assert real behaviour and must pass **as written**, except:
  - `it('offers an editable, 30-character-clamped nickname field for the primary guest')`
    (`rsvp-editor.spec.ts` ~L254, from T299) asserts the **opposite** of ADR W-0007 §Amendment2.6 —
    the primary is `nameLocked`, so their nickname renders as the read-only `.locked-nickname-block`,
    not an `input`. Flip it to assert the locked block (mirroring whatever the partner-with-account
    case already asserts), and note the ADR in the test name. Do not delete it.
  - Investigate and fix `rsvp-edit.spec.ts` (1) and `manage-rsvp-modal.spec.ts` (1) — the latter
    ("discards unsaved edits when the couple jumps to the partner profile") depends on the jump
    firing at all, so it may resolve with `canOpenProfile`; confirm rather than assume.
  - **`pnpm test` reaches 0 failures.** This task's whole point is a green baseline; report the
    count. `pnpm typecheck` clean; `pnpm lint` no new errors beyond the 4 known `shared/modal` ones.
- **Refs:** ADR W-0007 §Amendment2.6; T318, T319 (what regressed), commit `da89aeb`;
  `src/app/shared/rsvp-editor/rsvp-editor.ts` (`canOpenProfile` L431-436, `cards()` `nameLocked`
  L206/L220); `src/app/core/service/login.service.ts` L283; `people.spec.ts`, `rsvp-editor.spec.ts`,
  `rsvp-edit.spec.ts`, `guest-manager/modal/manage-rsvp-modal.spec.ts`

### T328 — Derive `RsvpDto.status` from the per-adult `attending` flags
- **Status:** todo
- **Owner:** agent (implementer) — but see the open API question below before starting
- **Depends on:** T321–T326 (the flags and the UI exist); T327 (green baseline) strongly preferred
- **Why:** ADR W-0007 §Amendment2.5, decided by the user: **an RSVP is `declined` when every
  eligible adult has declined; if at least one adult still comes it stays confirmed.** `status` is
  the party-level roll-up of the per-adult flags, not an independent axis. Today nothing enforces
  this — T322's toggle can drive `attendingCount` to 0 adults while `status` stays `attending`,
  which §Amendment2.5 defines as an inconsistent state.
- **Acceptance (design first — do not code before the open question below is settled):**
  - A pure helper alongside the others in `src/app/core/helper/rsvp-draft.ts` deriving the implied
    status from a draft: every eligible adult declined ⇒ `declined`; otherwise the existing
    `status` stands. Children never affect it (they cannot decline; a party of declined adults plus
    children is still a declined party — confirm this reading with the user if it feels wrong).
  - Decide and document **where** the roll-up is applied: on write in the editor's own
    `setAttending`, or at the screen/save boundary (`rsvp-edit`, `manage-rsvp-modal`). Prefer the
    save boundary — the editor is a controlled component over a draft and silently rewriting
    `status` mid-edit would surprise, and would fight the explicit status control the editor already
    renders when `showStatus` is true.
  - **RESOLVED — the roll-up is symmetric, both directions.** §Amendment2.5's wording ("declined
    when both adults have declined … if only one of them comes the RSVP is still confirmed") states
    a biconditional, so: every eligible adult declined ⇒ `declined`; at least one adult coming ⇒
    `attending`, including re-toggling a previously-`declined` party back. Read from the user's own
    words rather than re-asked.
  - **`pending` is not touched by the roll-up.** A party that has not answered yet has no declines
    to roll up (`attending` defaults to absent ⇒ coming, so `attendingCount` is always the full
    party), and silently promoting `pending` to `attending` would fabricate an answer the guest
    never gave. Guard on this explicitly and test it.
  - **Out of scope — the inverse direction (`status` → per-adult flags).** Choosing "declined" on
    the party-level status control does **not** write `attending: false` onto each adult here. Note
    the user is separately hand-editing `rsvp-create.ts` to seed flags from the party answer on that
    screen; if the two need to agree, that is a follow-up, not this task.
  - Unit specs for every branch, including the both-declined-plus-children case.
- **OPEN — ask before implementing:** does the **API** enforce this roll-up, or is the client the
  only thing maintaining the invariant? Per CLAUDE.md hard rule 17 this bundle is not redeployed
  with the API, so a client-only invariant means an older bundle can write an inconsistent state
  the newer API accepts. This is the natural companion to T320's still-open audience/headcount half
  and probably wants answering in the same pass, in `wedding-api`.
- **Refs:** ADR W-0007 §Amendment2.5; T320 (still-open audience/headcount half); hub ADR-0022
  (`status` as the RSVP's single source of truth); `src/app/core/helper/rsvp-draft.ts`

### T329 — Fix T328's roll-up: bidirectional sync + "absent flags are not evidence"
- **Status:** todo
- **Owner:** agent (implementer)
- **Depends on:** T328 (whose implementation is in the working tree, uncommitted, and **defective**)
- **Why:** T328 shipped a data-corrupting defect, caught by probe before commit. `impliedStatus`
  recomputes `status` from the per-adult flags, but nothing writes flags when the guest uses the
  party-level status control, and an absent `attending` reads as "coming". Result, verified:
  a party of two account-holding adults with `status: declined` and untouched flags serialises as
  **`attending`**. Reachable from `rsvp-edit` (`[showStatus]="true"`, `setStatus` writes only
  `status`, then `fromRsvpDraft` overwrites it) — **a guest who declines has the decline silently
  reverted on save.** Fails toward the expensive direction: a headcount that includes people who
  said no. See ADR W-0007 §Amendment3.
- **Acceptance:**
  - **`impliedStatus` acts only on explicit flags** (ADR W-0007 §Amendment3.8), in this order:
    1. `draft.status === 'pending'` ⇒ return unchanged (existing guard, keep).
    2. no eligible adult (`canDeclineAlone` false for both keys) ⇒ return `draft.status` unchanged
       (existing guard, keep).
    3. every eligible adult explicitly `attending === false` ⇒ `declined`.
    4. otherwise at least one eligible adult explicitly `attending === true` ⇒ `attending`.
    5. **otherwise return `draft.status` unchanged** — this is the new clause, and the one that
       protects RSVPs already in production that predate the flags entirely.
  - **`setStatus` writes the flags too** (`rsvp-editor.ts` L327-329, ADR W-0007 §Amendment3.7):
    `declined` ⇒ `attending: false` on every adult for which `canDeclineAlone` is true;
    `attending` ⇒ `attending: true` on the same set. `pending` leaves flags untouched. Adults who
    are not eligible (a plus-one `partner2`; `partner1` in a party of one) are never written to —
    the wire has no field for them. Emit one draft, as `setStatus` already does; do not emit twice.
  - **Restore the masked regression guard.** `'keeps the party on a declined save'`
    (`rsvp-draft.spec.ts`) had `partner1: adult({ id: 'usr_self', attending: false })` added to its
    fixture so it would pass. Remove that addition, returning the fixture to a declared
    `status: DECLINED` with **no** explicit flags, and let it assert — correctly — that the
    serialised status is still `declined`. Under clause 5 it now passes honestly. Restore its
    original comment intent (a guard against `fromRsvpDraft` special-casing status wrongly) rather
    than the replacement comment that rationalised the failure.
  - Re-check the other test T328 rewrote, `'round-trips the party through a decline and back to
    attending'`: with `setStatus` now syncing flags, decide whether driving it via explicit flags is
    still the honest representation of what the app does, or whether it should drive `status` and
    let the sync do the work. Prefer whichever matches real call flow; say which you chose and why.
  - New specs: the exact defect as a permanent guard (two account-holding adults, `status: declined`,
    no flags ⇒ serialises `declined`); the same with `status: attending` and no flags ⇒ `attending`;
    `setStatus('declined')` sets both eligible adults' flags false and leaves a plus-one/child
    untouched; `setStatus('attending')` clears prior declines; `setStatus('pending')` touches no
    flags; and a full round trip proving party-level decline → save → reload → still declined.
  - `pnpm typecheck && pnpm lint && pnpm test` — 0 failures (baseline before T328 was 412/412; T328
    added 8, this task adds more). `lint` no new errors beyond the 4 known `shared/modal` ones.
- **Refs:** ADR W-0007 §Amendment3 (both clauses), §Amendment2.5 (superseded in part); T328;
  `src/app/core/helper/rsvp-draft.ts` (`impliedStatus`, `fromRsvpDraft`), `rsvp-draft.spec.ts`;
  `src/app/shared/rsvp-editor/rsvp-editor.ts` (`setStatus` L327-329);
  CLAUDE.md hard rule 17 (why legacy documents matter here)

---
