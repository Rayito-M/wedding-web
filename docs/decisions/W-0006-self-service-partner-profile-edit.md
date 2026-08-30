# ADR W-0006: Self-service partner profile editing — generalize `ProfileModalService`/`app-profile-modal`, not a distinct surface

- **Status:** accepted
- **Date:** 2026-08-30
- **Deciders:** wedding-web architect (this repo)
- **Scope:** wedding-web (in-repo). No contract change, no glossary change, no design-system
  change, no `pnpm gen:api`.

## Context

A guest reported: "I don't see the RSVP edit using the profile edit. All the partner with a
'guest' account should open the modal for profile edit." Confirmed to apply to **both**
RSVP-editing surfaces in this app.

**Surface 1 — the couple's guest manager** (`screens/guest-manager` → `app-manage-rsvp-modal` →
`app-rsvp-editor perspective="couple"`) already does this, via T269 and T308: a locked partner2
card (`partnerHasAccount(draft.partner2)`, i.e. `kind === 'guest'`) renders an "Open their
profile" link that swaps the RSVP overlay for `app-guest-profile-modal`, landing straight in edit
mode. Static review plus this phase's T314 (a full-chain integration test spanning
`GuestManager`/`ManageRsvpModal`/`GuestProfileModal`) found no defect in this chain.

**Surface 2 — self-service "My RSVP"** (`screens/rsvp-edit` → `app-rsvp-editor
perspective="owner"`) has no equivalent. `canOpenProfile()` in `rsvp-editor.ts` gates the link on
`perspective() === 'couple'` only, so an `owner`-perspective guest whose partner has their own
account sees the locked name and the "name managed by their own account" hint, but no link — this
was Phase U's deliberate scope cut ("A linked-partner profile-editing UI … is a separate,
explicitly-scoped follow-up") because at the time nothing in the app could act on it.

It is now possible, confirmed against the `wedding-api` source directly:

- `GET /v1/profile/{id}` has no authorization check beyond authentication — any signed-in guest
  can already read their partner's `UserProfileDto` (contact fields excluded, per
  `profileFromUserDocument`, unless the caller is admin/self — irrelevant here since this ADR
  never surfaces email/phone for a partner target either, see Decision 2).
- `PATCH /v1/profile/{id}` (`assertCanActOnUser` in `wedding-api/src/common/policy/
  user-delegation.ts`) authorizes the caller when `targetUser.role === 'guest' &&
  targetUser.partnerId === requester.id` — i.e. exactly the "guest editing their own linked
  partner" case this ADR is for, in addition to admin/self/delegate.
- The already-shipped `UpdateUserProfileDto` write shape (Phase U, T306) needs no change: it
  merges `firstName`/`lastName`/`preferredLang`/`nickname` for any authorized caller and `relation`
  only when the target is a guest — this ADR never sends `relation` (Decision 2).

Two designs were on the table: generalize the existing "My profile" overlay
(`ProfileModalService` + `app-profile-modal`, built in Phase T/U) to accept an optional edit
target, or build a distinct, smaller "edit my partner" surface reusing only the lower-level
`app-profile-fields`/`app-relation-fields`.

## Decision

1. **Generalize, don't triplicate.** `ProfileModalService`/`app-profile-modal` are widened to
   accept an optional target user id instead of always meaning "the signed-in user." A third
   profile-editing surface would re-fragment exactly what Phase U just consolidated
   (`app-profile-fields` unified three hand-rolled forms into one), and the user's own words —
   "open the modal for profile edit" — describe the existing modal, not a stripped inline form.
   `ProfileModalService.open(targetUserId?: string)`: omitted means "the signed-in user's own
   profile" (both existing call sites — `ScreenHeader`'s account dropdown, `People`'s "isMine"
   card — keep calling `open()` with no argument, unchanged). `PrivateLayout` remains the sole
   place that performs the write (unchanged ownership split from T304/T305); it resolves
   *whichever* profile is targeted, not always its own.

2. **What's editable: the real profile-edit form, with `lockContact` on and `showRelation` off —
   matching the guest's own `profile-modal` call site exactly, not a scoped-down inline form.**
   The RSVP editor's inline name/nickname lock is a different, narrower surface for a different
   moment (declining to let the RSVP editor itself rename a linked account); this ADR is about
   what opens when the guest explicitly asks to manage that account. `lockContact` stays **on**:
   email/phone render read-only even while editing, same as every other non-admin profile-edit
   surface in this app — a partner editing contact details they cannot even fully see (`GET
   /v1/profile/{id}` excludes email/phone for a non-self, non-admin caller) is a bigger step than
   this request implies, and nothing about the user's ask requires it. `showRelation` stays
   **off**, carrying forward T312's explicit precedent verbatim: the API now technically allows a
   guest to write `relation`, but that is not silently wired in anywhere it wasn't explicitly
   asked for — including here. Both are follow-ups with their own sign-off if ever wanted.

3. **Entry wiring.** `rsvp-editor.ts`'s `canOpenProfile()` widens from `perspective() === 'couple'`
   to `perspective() === 'couple' || perspective() === 'owner'` — the gate that used to read "only
   the couple has a surface to swap to" is no longer true. `rsvp-edit.html` binds
   `app-rsvp-editor`'s (previously unbound) `(openProfile)` output to
   `ProfileModalService.open($event)`. This mirrors the shell-level pattern already established
   for the toast stacks (T285) and the guest's own profile modal (T304): a full route (not a modal)
   reaching a shell-mounted overlay it has no direct parent/child relationship with.

4. **Write-target correctness — explicit, not inherited from the self-only assumption.**
   `PrivateLayout.onProfileSave()` today hardcodes `this.ownProfile()` (`LoginService
   .currentUserClaims()?.sub`). This is the first "edit someone else, as a non-admin" call site in
   this app — every prior write (`private-layout.ts` self-edit, `guest-profile-modal.ts` couple/
   admin-edit) assumed either self or admin. `PrivateLayout` gains a `resolvedProfile` computed
   keyed off `ProfileModalService.targetUserId() ?? <own id>`, looked up against the same shared
   `UserProfileDto` collection; unlike the self case (already guaranteed cached by `ScreenHeader`'s
   init fetch), a partner's profile is **not** pre-loaded anywhere in the guest's own session, so
   opening the modal on a target id also triggers a `getByKey()` fetch. The write
   (`EntityCollectionService.update({ id: resolvedProfile().id, ...changes })`) always uses the
   *resolved* profile's id, never a silently-assumed self id.

5. **Title distinguishes self vs. partner.** `app-profile-modal`'s fixed header currently always
   reads "My profile" (`shared.myProfile`). Editing a partner's profile through the same component
   must not claim to be the guest's own. `ProfileModal` gains a small `isOwnProfile = input(true)`
   input; `resolvedTitle` reads a new `profileModal.partnerTitle` key ("Partner's profile" / ES /
   FR) when `false`. The identity block below the fixed header (avatar, name, nickname, role/
   relation pills) already reads reactively off the `profile` input and needs no change — it will
   correctly show the *partner's* identity once `profile()` is the partner's `UserProfileDto`.

6. **No extra client-side authorization check.** The API's `assertCanActOnUser` is the
   authorization boundary; this app performs none of its own beyond the existing rule that the
   "Open their profile" link only ever renders on a card where `partnerHasAccount()` is true — by
   construction (ADR W-0002/W-0004) a `partner2` card with `kind: 'guest'` on *this* guest's own
   RSVP is that guest's linked account, which is exactly what `targetUser.partnerId ===
   requester.id` recognizes server-side. If the PATCH is ever rejected (e.g. a data
   inconsistency), the existing generic save-error handling already in `PrivateLayout`/
   `app-profile-modal` (T305) covers it — no new error path is introduced.

## Consequences

- A guest can now open, from their own "My RSVP" screen, a full profile-edit modal for a partner
  who has their own guest account — reusing the exact component the guest already uses for their
  own profile, not a new surface.
- `ProfileModalService`, `PrivateLayout`, `ProfileModal`, and `rsvp-editor.ts`/`.html` each change
  in a small, isolated way (see T315–T319); no new component is built, no DS change is required.
- The two existing no-argument `ProfileModalService.open()` call sites (`ScreenHeader`, `People`)
  are unaffected.
- `email`/`phoneNumber`/`relation` editing for a linked partner remain explicitly out of scope,
  same as they are for the guest's own profile — a deliberate, stated non-decision, not an
  oversight.

## Deliberately out of scope (this ADR)

- Contact-field (`email`/`phoneNumber`) editing for a partner — `lockContact` stays on (Decision
  2).
- Relation (`side`/`kind`/`link`) self-service editing anywhere, including here — `showRelation`
  stays off (Decision 2), same as T312's precedent for the guest's own profile.
- A "who is my linked partner" discovery UI — this is only reachable from a card the RSVP editor
  already knows is a linked account (`accountId` on `PersonCard`), never a general lookup.
