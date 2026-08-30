# ADR W-0007: `partner2`-with-account solo decline — scope and interim rule pending T320

- **Status:** accepted (interim) — **amended 2026-08-30, see §Amendment: `partner1` is eligible
  after all.** §Decision.1 and §Decision.2 as originally written are superseded; the rest stands,
  and the audience/headcount half of T320 remains open.
- **Date:** 2026-08-30
- **Deciders:** wedding-web architect (this repo)
- **Scope:** wedding-web (in-repo). No contract change, no glossary change, no design-system
  change, no `pnpm gen:api`.

## Context

The design system (`ui_kits/wedding-app/RSVPEditor.jsx`, commit
`2bf80a927e347422dbbc5a595251aaaa2c704824`) lets any adult with their own guest account decline
independently of the rest of the party, without changing the RSVP's own overall answer:

```js
const rsvpCanDeclineAlone = (p, people) =>
  rsvpIsAdult(p) && !!p.hasAccount && ((people || []).filter(rsvpIsAdult).length > 1);
const rsvpComing = (p) => p.attending !== 'no';
const rsvpAttending = (v) => {
  const ppl = (v && v.people) || [];
  return ppl.filter((p) => rsvpComing(p) || !rsvpCanDeclineAlone(p, ppl)).length;
};
```

This maps onto a field that already exists on the wire. `RsvpDtoAdultsPartner1` and
`RsvpDtoAdultsPartner2OneOf` (the account-holding variant of the `partner2` union) both carry
`attending?: boolean` — added when `kind` landed (ADR W-0004) and, per that ADR's amendment,
deliberately unused since: "nothing in this app reads or writes `attending` on `partner1` … a
member-level `attending` flag has only ever had a purpose on `partner2`." `RsvpDtoAdultsPartner2OneOf1`
(the plus-one variant, no account) and `RsvpDtoChildrenInner` correctly have **no** `attending`
field at all. No `pnpm gen:api` is needed for this ADR or the task that follows from it (T321).

ADR W-0002 §"Explicitly not decided" already flagged the general shape of this question on
2026-08-21 ("`attending` on the partner variant … deciding what it means next to the RSVP's own
`status` is a modelling question for the API side") and it was never actioned. Bringing the DS's
concrete `Toggle` behaviour into this repo makes the question no longer abstract, so it is
re-raised as **T320**, escalated to the hub, non-blocking for the UI tasks that read/write the
field as opaque data (T321–T324) but **blocking** for any surface that aggregates headcount or
audience off it (T325).

## Decision

1. **Solo decline is `partner2`-with-account only. Never `partner1`, never a child.** This repo's
   `canDeclineAlone(draft, key)` (`src/app/core/helper/rsvp-draft.ts`) hard-codes `key ===
   'partner2' && partnerHasAccount(draft.partner2)`. The DS's rule is generic over "any adult with
   their own account in a party of more than one adult," which — applied literally to this app's
   two-adult-max shape — would also make `partner1` eligible whenever a `partner2` is present,
   since the primary always "has an account." That reading is rejected here because it conflicts
   with ADR W-0004's amendment, which treats `partner1.attending` as inert dead weight and
   `RsvpDto.status` as the sole authority on the primary's own attendance: letting `partner1` also
   solo-decline via a second, competing flag would reintroduce exactly the ambiguity that
   amendment closed. Children are excluded because the contract structurally forbids it —
   `RsvpDtoChildrenInner` has no `attending` field at all, so there is nothing to toggle.

2. **Whether `partner1` should ever be eligible is an open hub question (T320), not settled here.**
   This decision records this repo's interim reading for the tasks that build on it — it is not a
   claim that the hub will agree. If T320 resolves the other way, `canDeclineAlone` is the single
   place to change (mirroring how ADR W-0002 designed `partnerHasAccount` to be the one place to
   change for its own discriminator question).

3. **The toggle is written as opaque guest-entered data. Nothing downstream of it is touched by
   this ADR or by T321–T324.** `RsvpDto.status` and its hub-defined audiences (ADR-0030 §8:
   `attending`/`attending-no-menu`) are unaffected by a solo decline — a `partner2` who declines
   alone remains, on the wire, exactly what they already were: a member of a party whose RSVP
   `status` is whatever `status` already says. This repo does not decide, and does not implement,
   any adjustment to:
   - `StatisticService.guestStatistics` (`src/app/core/service/statistic.service.ts`), which sums
     `ProfileRsvp.adults` — a raw count with no per-adult breakdown in its source type
     (`UserProfileListResponseDtoProfilesInnerGuestInfoRsvp`);
   - the guest-manager table row or the profile modal's partner row;
   - any other count- or audience-adjacent surface.

   That follow-up is **T325**, and it stays blocked until T320 resolves — building it now would
   imply this repo has answered a question that belongs to the hub.

4. **The three pure helpers this ADR licenses are additive, not aggregating.** `canDeclineAlone`,
   `isPersonComing`, and `attendingCount` (§Decision.1 above; `src/app/core/helper/rsvp-draft.ts`)
   operate only on the in-memory `RsvpDraft` the editor already holds — they read and derive from
   `partner2.attending`, they do not write it anywhere else, and `attendingCount` is a *local*
   party-size figure (this RSVP's own draft), not the couple-wide headcount `StatisticService`
   computes. Nothing about them requires or implies an answer to T320; they exist so T322 (the
   toggle UI) and T323 (the "Not attending" pill/summary) have a single, tested source of truth
   instead of five call sites each re-deriving the same three lines of logic.

## Amendment (2026-08-30) — `partner1` **is** eligible; §Decision.1 and §Decision.2 superseded

**Decided by the user**, in this repo, in direct response to §Decision.2 being put to them as an
open question. This is a real user ruling on a question this ADR raised, not an inference — but note
it is a *wedding-web* ruling on scope, and it does **not** answer the audience/headcount half of
T320, which stays open and still blocks T325.

The user is concurrently hand-editing `src/app/screens/rsvp-create/rsvp-create.ts` to seed
`partner1.attending = true` (and a linked, `kind: 'guest'` `partner2.attending = true`) whenever the
party answers "yes" — i.e. answering the RSVP marks everyone present, and the editor is then the
surface on which any individual with their own account steps back out. That is coherent only if
`partner1` can subsequently decline; a primary permanently pinned to `attending: true` would make
the seeding pointless.

Superseding, therefore:

1. **Solo decline is available to any adult with their own account, in a party of more than one
   adult** — which in this app's two-adult-max shape means: `partner1` whenever a `partner2` exists,
   and `partner2` whenever `partnerHasAccount(partner2)`. This is now the design system's
   `rsvpCanDeclineAlone` rule applied **literally**, no longer narrowed. Children remain excluded,
   structurally and permanently: `RsvpDtoChildrenInner` has no `attending` field to toggle.

2. **`partner1.attending` is no longer inert.** ADR W-0004's amendment ("nothing in this app reads
   or writes `attending` on `partner1`") is superseded on this specific point. `toRsvpDraft` now
   reads it and `fromRsvpDraft` now writes it, symmetrically with `partner2`. The tension
   §Decision.1 originally cited — a second flag competing with `RsvpDto.status` for authority over
   the primary's attendance — is resolved by scope, not by suppression: `RsvpDto.status` remains the
   authority on **whether the party answered and how** (hub ADR-0022), while `partner1.attending`
   says only **whether this one person occupies their seat** within a party that already answered
   "yes". A party whose `status` is `declined` is not a party with per-member declines; it is a
   party that said no, and the per-member flags are not consulted.

3. **Open, and deliberately not resolved here:** whether `partner1` may decline when the *only*
   other adult is a plus-one with no account. The DS rule permits it (it gates on the count of
   adults, not on their account status), and this amendment follows the DS literally, so it is
   permitted — but the resulting state is odd (an account-less plus-one attending alone, with no
   way to reach the app themselves). Flagged in T326 as a known consequence to revisit if it proves
   wrong in practice, not as a silent design choice.

## Amendment 2 (2026-08-30) — `status` follows the per-adult flags; edits go through the profile

Both **decided by the user**, answering questions put to them directly.

5. **An RSVP is `declined` when *every* eligible adult has declined. If at least one adult is still
   coming, the RSVP stays confirmed.** This settles the relationship §Amendment.2 left half-open:
   `RsvpDto.status` and the per-adult `attending` flags are not independent axes. `status` is the
   party-level roll-up of the per-adult flags — "did anyone from this party come?" — while
   `attending` answers "does this specific person occupy their seat?". A party of two where one
   adult declines is an **attending** RSVP with one empty seat, not a partially-declined one.
   Consequence: `attendingCount(draft) === 0` adults and `status === 'attending'` is an
   inconsistent state the editor must not be able to produce. Implementing that roll-up is **T328**
   — nothing in T321–T326 enforces it yet.

6. **Any change to an adult who has their own guest account goes through their profile, never
   through the RSVP editor.** This is why `cards()` sets `nameLocked: true` unconditionally for
   `partner1` (who always has an account) and `partnerHasAccount(partner2)` for the partner — it is
   deliberate, not the bug it was mistaken for. The RSVP editor owns *attendance, meals and
   allergies*; the profile owns *identity*. The corollary is load-bearing: because the editor locks
   those fields, the "Open their profile" jump is the **only** way to edit them, so that jump must
   be reachable for every account-holding adult card, from the guest's own RSVP as well as the
   couple's guest-manager. `canOpenProfile` currently fails that for the partner card in the
   `owner` perspective — see **T327**.

## Explicitly not decided (would need a hub ADR — this is T320)

- Whether a solo-declined adult is still counted in the `attending`/`attending-no-menu`
  announcement audiences (ADR-0030 §8), which today are defined purely off `RsvpDto.status`.
- Whether the couple's guest-list headcount, or any internal "final headcount to the caterer"
  milestone, should exclude a solo-declined seat.
- Whether the API validates solo-decline eligibility server-side, or accepts whatever the client
  writes. Now more pressing than when this ADR was written: `partner1.attending` is a live field
  again, so "the wire structurally forbids it" is no longer the free enforcement it was for
  plus-ones and children.

Either answer is workable; per T320, it needs to be decided once, centrally, not implied by
whichever repo ships UI for it first.

## Consequences

- `AdultDraft` gains `attending?: boolean`, read from and written to `partner2` only (never
  `partner1`, per ADR W-0004's amendment); `toRsvpDraft`/`fromRsvpDraft` follow the same `in`-check
  pattern ADR W-0004 established for `id`.
- Three new pure, tested helpers exist for T322–T324 to build the toggle, pill and summary line
  against, without duplicating the eligibility rule or the "coming" predicate at each call site.
- `StatisticService`, the guest-manager row/partner line, and the profile modal's partner row are
  **explicitly untouched** — they continue to read exactly what they read today, until T325 (which
  stays blocked on T320).

## References

- Hub: ADR-0022 (single mutable RSVP, `status`), ADR-0024 (participants), ADR-0030 §8
  (`attending`/`attending-no-menu` audiences); `GLOSSARY.md` §RSVP / Response, §Audience,
  §Participant
- In-repo: ADR W-0002 §"Explicitly not decided"; ADR W-0004 (`attending`'s origin, unused; the `in`-
  check precedent)
- DS: `ui_kits/wedding-app/RSVPEditor.jsx` `rsvpCanDeclineAlone`, `rsvpComing`, `rsvpAttending`
  (commit `2bf80a927e347422dbbc5a595251aaaa2c704824`)
- Code: `src/app/core/helper/{rsvp-draft.ts,partner-account.ts}`;
  `src/app/core/api/model/{rsvp-dto-adults-partner1,rsvp-dto-adults-partner2-one-of,rsvp-dto-adults-partner2-one-of1,rsvp-dto-children-inner}.ts`;
  `src/app/core/service/statistic.service.ts`
- Tasks: `TASKS.md` T320 (hub escalation), T321 (this ADR + foundation), T322–T324 (UI),
  T325 (aggregate surfaces, blocked on T320)
