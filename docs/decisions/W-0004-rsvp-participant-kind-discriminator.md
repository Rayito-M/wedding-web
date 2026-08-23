# ADR W-0004: `kind` is the partner-slot discriminator (amends W-0002)

- **Status:** accepted, amended 2026-08-23 (same day — see "Amendment" below; the upstream Zod
  defect recorded in the original text was fixed within the day)
- **Date:** 2026-08-23
- **Deciders:** wedding-web architect (this repo)
- **Scope:** wedding-web (in-repo). **Consumes** a contract change made upstream; proposes no
  contract change, no glossary change, no design-system change.
- **Scope of `kind` itself, since the name invites a wider reading:** it is a property of the
  **`adults.partner2` slot only** — *not* a party-wide participant discriminator.
  `adults.partner1` has never carried one, and `children[]` carried one for about a day before the
  API removed it (2026-08-23 re-sync). Anywhere an earlier draft of this ADR or of `TASKS.md`
  said "every participant carries a `kind`", it was wrong and has been corrected.

## Context

ADR W-0002 §Decision.1 made the presence of `id` the sole client-side signal that a partner has
their own guest account, and §Consequences said in as many words:

> `partnerHasAccount` is the single place to change if the contract ever gains a real
> discriminator (e.g. a `kind` field), instead of five call sites.

The contract has now gained exactly that. `RsvpUserSchema` in `wedding-api`
(`src/common/documents/rsvp.ts`) carries `kind: z.enum(['guest', 'plus-one', 'child'])`, and
`adults.partner2` is a `z.discriminatedUnion('kind', …)`. The API's **first** cut also put `kind`
on children; a re-sync the same day removed it again (`RsvpChildrenParticipantSchema` now omits
`kind` alongside `lastName`), and the hub contract was updated to match. The end state:

| Generated type | Shape |
|---|---|
| `RsvpDtoAdultsPartner2` | `RsvpDtoAdultsPartner2OneOf \| RsvpDtoAdultsPartner2OneOf1` — a real union, no longer a merged interface |
| `…OneOf` | `id` **required**, `firstName`, `lastName`, `kind` **required**, `attending?`, `options?` |
| `…OneOf1` | `firstName`, `lastName`, `kind` **required**, `options?` — **no `id`** |
| `RsvpDtoChildrenInner` | `firstName`, `age`, `options?` — **no `kind`**, after the re-sync |
| `RsvpDtoAdultsPartner1` | unchanged — **no `kind`** (the contract omits it for the primary guest) |

*(Superseded by the 2026-08-23 amendment below: `…OneOf`/`…OneOf1`'s `kind` degrades from an enum to
plain `string`, and `RsvpDtoAdultsPartner1` gains an optional `attending?: boolean`. The table above
is left as originally written, for the record of what T270/T271 actually built against.)*

Three things follow. First, the `anyOf`-merge wrinkle W-0002 documented is gone: `partner2` is a
genuine union, so the two `as unknown as RsvpDtoAdultsPartner2` casts (in
`core/helper/rsvp-draft.ts` and `screens/rsvp-create/rsvp-create.ts`) are both wrong and no longer
necessary — a literal without `id` structurally *is* `…OneOf1`. Second, and urgently: both write
paths build `partner2` with **no `kind` at all**, so the payload no longer satisfies the schema.
Third, the committed client in `src/app/core/api/` is one hunk stale — it still carries the
short-lived `kind` on `RsvpDtoChildrenInner` — so it must be regenerated before anything is
written against it (T270's first step). Between the two, the repo does not typecheck: 10 errors at
`HEAD`, 6 after regeneration, and **every survivor is `partner2`'s** — four `.id` reads off a
union whose second member has none, and two `PartnerDraft` literals missing `kind`.

Note what `kind` does **not** buy: the generated `KindEnum` is the full three-value enum on *both*
union members, so TypeScript cannot narrow `RsvpDtoAdultsPartner2` by `kind` — only the presence
of `id` distinguishes the two members structurally. *(This paragraph describes the state T270/T271
were built against. See "Amendment (2026-08-23)" below: the generated `KindEnum` no longer exists
at all, which changes nothing about the `id`-based narrowing conclusion but does break every
reference to the enum itself.)*

## Decision

1. **`kind` is the sole discriminator. There is no `id` fallback.** A partner is an account holder
   when `kind === 'guest'`, and only then; an `id` present next to `kind: 'plus-one'` does not
   make one. This **supersedes** W-0002 §Decision.1 outright rather than layering on top of it.
   The reason it can be this clean is external: the backend has already migrated the stored
   documents (user decision, 2026-08-23), so there are no `kind`-less RSVPs in the wild and the
   client needs no defensive branch. See §Decision.3.

2. **The draft carries `kind` verbatim rather than re-deriving it on write.** `AdultDraft` (the
   local editing shape in `core/helper/rsvp-draft.ts`) gains an **optional** `kind`, typed with
   the **generated** `RsvpDtoAdultsPartner2OneOf.KindEnum` — never a hand-written
   `'guest' | 'plus-one' | 'child'` union, which CLAUDE.md Hard rule 15 forbids.
   *(Superseded by the 2026-08-23 amendment below: the generated `KindEnum` no longer exists, so
   `AdultDraft.kind` is typed plain `string` — the same type the generated `…OneOf`/`…OneOf1`
   interfaces themselves give the field. This is still not a hand-written union; there is simply
   nothing generated left to defer to.)* It is read on
   `toRsvpDraft`, carried through every mutation, and written back on `fromRsvpDraft`.
   **`ChildDraft` gains nothing** — children have no `kind` in the contract.

   *Optional, on the shared adult type, rather than required on a new partner-only type.* Both
   adult slots are `AdultDraft` today, and three consumers treat them uniformly —
   `unnamedAdultCount()` builds an `AdultDraft[]` from both, `withPersonOptions()` keys off
   `PersonKey`, and the editor's card builder flattens both into one `PersonCard[]`. Splitting the
   type to make one field non-optional would fork all three for no behavioural gain. The invariant
   the type therefore cannot express — *`kind` belongs to `partner2`; `partner1` never has one and
   `fromRsvpDraft` never emits one for it* — is stated in the doc comment and asserted in
   `rsvp-draft.spec.ts` instead. If a partner-only draft type is ever wanted for other reasons,
   this is a cheap thing to revisit.

3. **No legacy-default rule is implemented, deliberately.** An earlier draft of this ADR specified
   read-side defaults for records with no `kind` (`partner2` with an `id` → `'guest'`, otherwise
   `'plus-one'`). That rule is **explicitly not needed and must not be reintroduced**: the backend
   migrated the stored documents when the schema changed, so `kind` is always present on the wire.
   Recorded here with its reason so a future reader does not read the absence as an oversight and
   add a fallback back in. What remains is a single **creation** rule, about data this app
   originates rather than data it reads: **a `partner2` created in this app — added in the editor
   or typed into the create wizard — is stamped `'plus-one'`**, because this app cannot provision
   an account (W-0002 §Decision.5). There is no corresponding rule for children; there is nothing
   to stamp. Nothing is inferred at write time; the write path emits what the draft holds.

4. **`partnerHasAccount()` stays a `boolean`, not a type predicate** — and *not* because of the
   fallback that §Decision.3 just removed. Two independent reasons, either sufficient:
   - **The union does not narrow on `kind`.** openapi-generator gives *both* members the same
     full three-value `KindEnum`, so neither has a unit-typed discriminator. TypeScript narrows a
     discriminated union only when the property is a literal type in at least one member;
     `p.kind === 'guest'` therefore narrows `p.kind` inside the block and eliminates **neither**
     `…OneOf` nor `…OneOf1`. A `partner is …OneOf` predicate would be an assertion the compiler
     cannot check, not a narrowing it derives. **This reason is contingent on the current
     generator output**, which is itself downstream of the API declaring the same three-value
     enum on both union members. If those are ever narrowed per variant (`z.literal('guest')` vs.
     `z.enum(['plus-one', 'child'])`), the generated members would gain unit-typed discriminators,
     the union *would* narrow on `kind`, and this reason would evaporate — revisit it then. Reason
     (b) below would still stand on its own.
     *(Superseded by the 2026-08-23 amendment below: the contingency above was triggered — the
     upstream schema now declares `kind` as a distinct `z.literal(...)` per variant — but it did
     not resolve the way this paragraph predicted. Read the amendment before touching this
     helper.)*
   - **The helper spans three unrelated input types** (the profile partner, `RsvpDtoAdultsPartner2`,
     and the local `AdultDraft`). Narrowing an `AdultDraft` to a generated API interface would be
     unsound at the call sites that pass one (`unnamedAdultCount`, the editor's card builder).

   Callers that need the account id read it with an `in` check
   (`'id' in partner ? partner.id : undefined`) — the one narrowing the union actually supports.

   **Consequence, stated so it is not discovered as a bug:** `adults.partner1` carries no `kind`,
   so `partnerHasAccount(partner1)` is now `false` where the `id` rule made it `true`. No caller
   passes `partner1` today — `unnamedAdultCount` asks only about `partner2`, and the editor
   hard-codes `nameLocked: false` for the primary card — and none may start to.

5. **The casts go.** Neither write path may keep `as unknown as`, `any`, or `@ts-expect-error` for
   this model; the payload is built as `…OneOf` (with `id`) or `…OneOf1` (without) and assigned to
   the union directly. The stale `// reason:` comments describing the "anyOf-merge artifact" are
   deleted with them — a comment that documents a defect that no longer exists is worse than none.

6. **Declining never prunes the party** (user decision, 2026-08-23). Setting an RSVP to `declined`
   is a change of *answer*, not a deletion of the party: `partner2` and `children`, with their
   meal details, stay in the draft, in the PATCH payload and in the stored document, so switching
   back to attending re-renders everyone the guest had already entered. Removing a participant
   stays an explicit act (the card's remove control, or un-ticking "With my partner" *while
   attending*) and is unaffected. This is what the design system's new reassurance line promises
   in as many words — "Your party and meal details are kept — switch back any time and nothing is
   lost" — so the copy and the behaviour have to agree, and today they do not:
   `rsvp-create.submit()` sends `adults` without `partner2` when the answer is "no", which
   replaces the stored `adults` and destroys a server-linked partner. (`children` survives the
   same path only by accident — an omitted key leaves the stored array untouched, so the two
   halves of the party are not even destroyed consistently.)

## Amendment (2026-08-23): the upstream Zod fix removes `KindEnum` entirely

The "Recorded external dependency" section below described a real defect: `z.discriminatedUnion`
gave both `partner2` variants the same three-value `kind` enum, so Zod threw on any payload that
exercised the union. The API fixed this the same day by giving each variant its own
`z.literal('guest')` / `z.literal('plus-one')` instead of sharing the enum — the union is now
genuinely disjoint and the server-side defect is gone. **This is not the outcome §Decision.4's
contingency note anticipated, and the difference matters:**

- §Decision.4 reason (a) predicted that narrowing the schema per variant would make
  openapi-generator emit **unit-typed discriminators**, so the TypeScript union would finally
  narrow on `kind` and reason (a) would "evaporate." That does not happen. openapi-generator turns
  a Zod `z.enum([...])` into a generated `KindEnum` namespace + union type, but it turns a Zod
  `z.literal('guest')` into a JSON Schema `const`, and openapi-generator has **no code path that
  emits a literal type — or any enum at all — for a `const`**. The generated field degrades to
  plain `kind: string` on both `RsvpDtoAdultsPartner2OneOf` and `…OneOf1`, and the `KindEnum`
  namespace disappears from the generated client entirely (confirmed by inspecting the
  regeneration: `grep -r KindEnum src/app/core/api/` returns nothing).
- The predicted alternative — "the union would narrow on `kind`" — is therefore the opposite of
  what happened: there is now **less** type information than before, not more. Reason (a) does not
  evaporate; it strengthens into its own limit case — there is no generated discriminator of any
  kind (shared or unit-typed) left to narrow on, so a `partner is …OneOf` predicate would be even
  more clearly an unchecked assertion than the original text argued. Reason (b) is untouched. The
  conclusion — `partnerHasAccount()` stays a plain `boolean` — stands, now for a reason with no
  contingency attached.
- Every reference to `RsvpDtoAdultsPartner2OneOf.KindEnum` (or the profile-partner equivalent) in
  this repo's source now fails to compile. The fix is a direct string-literal comparison —
  `kind === 'guest'` / `kind === 'plus-one'` — against the values the contract's `const`s actually
  carry. **This is not the hand-written union Hard rule 15 forbids**: the rule prohibits
  redeclaring a *type* the generated client already models; comparing a field the generated
  interface types as `string` to a literal it can already hold is an ordinary equality check, not
  a type declaration. `AdultDraft.kind` (§Decision.2) is retyped `string` for the same reason — it
  mirrors the generated field's own type, not a new invented one.
- `RsvpDtoAdultsPartner1` separately gains an optional `attending?: boolean`, because
  `rsvpMemberPrimarySchema` (the renamed schema behind `partner1`) now omits only `kind` from the
  shared member schema, not `attending` too — a narrower omission than before, not a new field this
  repo asked for. This is judged harmless dead weight, not a modelling error worth flagging
  upstream: the primary guest's attendance is `RsvpDocument.status`, and a member-level `attending`
  flag has only ever had a purpose on `partner2` (letting an already-provisioned account holder
  show pending/declined independent of the RSVP's own status). Nothing in this app reads or writes
  `attending` on `partner1`; `fromRsvpDraft()`'s `partner1` object literal does not set it, and the
  field being optional means it does not need to.
- The non-discriminated `z.union` behind the profile-partner type
  (`UserProfileListResponseDtoProfilesInnerGuestInfoPartner`, built in
  `wedding-api/src/modules/profile/dto/profile.dto.ts`, untouched by the Zod discriminator defect
  or its fix) had its two members reordered upstream, which swaps which generated interface name —
  `…AnyOf` vs. `…AnyOf1` — carries which shape. This is cosmetic for this repo: nothing consumes
  either split interface directly (both are folded into the merged
  `UserProfileListResponseDtoProfilesInnerGuestInfoPartner`, which is what `partnerHasAccount()`
  and its one call path actually read, by `kind`, not by structural position).

## Consequences

- Reading `id` off `RsvpDtoAdultsPartner2` now needs an `in` check at four sites
  (`core/helper/rsvp-draft.ts`, `core/helper/partner-account.ts`, `screens/rsvp/rsvp.ts`,
  `screens/invitee/invitee.ts`). That is the price of a union that finally tells the truth.
- `partnerHasAccount()` remains the single behavioural switch, as W-0002 intended; only its body
  changes. No call site changes shape.
- Test fixtures that construct an `RsvpDto` with a `partner2` must now supply `kind` — the
  compiler enforces it, which is the point. **Child fixtures are unaffected**, and a spec asserts
  that a serialised child has no `kind` property, so nobody adds one back out of symmetry.
  *(Amended 2026-08-23: fixtures assert `kind` against the string literal `'guest'` / `'plus-one'`,
  not a `KindEnum` member — there is no longer one to import.)*
- The client must be regenerated before any of this lands: the committed
  `rsvp-dto-children-inner.ts` still carries the `kind` the contract re-sync removed.
- §Decision.6 is a **behaviour change, not a refactor**: `rsvp-create.submit()` stops pruning the
  party on a "sadly no", so a first-time decline no longer wipes a server-linked partner.

## Recorded external dependency — owned by the user, not by this repo

- **Resolved 2026-08-23 (same day recorded).** `z.discriminatedUnion('kind', [RsvpUserSchema,
  RsvpParticipantSchema])` gave both members the same three-value `kind` enum. Zod v4 threw
  `Duplicate discriminator value "guest"` the first time that union was exercised (reproduced
  against `zod@4.4.3`), so **any** `partner2` payload failed server-side regardless of what this
  repo sent. Sending `kind` correctly was necessary but not sufficient. **The user took ownership
  of this; no task existed for it in `TASKS.md`.** The API fixed it by giving each `partner2`
  variant its own `z.literal(...)` instead of sharing the enum (see the "Amendment" section
  above), which resolves the save-blocking defect **and** removes the generated `KindEnum` this
  repo's code referenced — the follow-on type breakage is `TASKS.md` T275, not a new instance of
  this same dependency. A live save round trip against a running API is unblocked as of this
  amendment, but T275 does not itself claim to have verified one — see its acceptance list.

## References

- Hub: `contracts/openapi.json` (`RsvpDto.adults.partner2` `oneOf`; `RsvpDto.children[]` after the
  2026-08-23 re-sync — `{ firstName, age, options? }`, no `kind`); ADR-0022 (single mutable RSVP),
  ADR-0024 (participants, diet & menu); `GLOSSARY.md` §Plus-one
- API: `wedding-api/src/common/documents/rsvp.ts`, `src/modules/rsvp/rsvp.service.ts`
- In-repo: ADR W-0002 §Decision.1 (amended by this ADR), §Decision.5; ADR W-0003; CLAUDE.md Hard
  rule 15
- Code: `src/app/core/helper/{rsvp-draft.ts,partner-account.ts}`,
  `src/app/screens/rsvp-create/rsvp-create.ts`, `src/app/shared/rsvp-editor/rsvp-editor.ts`
- Tasks: `TASKS.md` T270, T271, T274, T275 (propagates the amendment above into code)
