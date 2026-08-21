# ADR W-0002: Rendering a partner as "own guest account" vs. "plus-one"

- **Status:** accepted
- **Date:** 2026-08-21
- **Deciders:** wedding-web architect (this repo)
- **Scope:** wedding-web (in-repo). No contract change, no glossary change, no design-system change.

## Context

The design system (`../wedding-ui-design`, commits `9e44df2` → `f26c721`) reworked partner
handling across four screens — `ScreenGuestManager`, `ScreenGuestManagerMobile`,
`ScreenRSVPCreate`, `ScreenRSVPEdit`. The common thread is a single visual/behavioural
distinction the app does not currently make:

- A partner who **has their own guest account** — DS calls this `linkedId != null` /
  `fullGuest` / `match` / `p.linked`. Their name is *owned by that account*: the DS renders
  it read-only (plain text, or `<Input disabled>`), tints the name in `--accent`, and adds
  the hint "Name managed by their own guest account." / "Linked to their guest account —
  the name comes from the guest list."
- A partner who is a **plus-one** — a participant on someone else's invitation with no
  account. Their name is typed and editable, and reads muted (`--sub`).

This maps cleanly onto vocabulary that already exists in the hub: `GLOSSARY.md` §Plus-one
("Not a separate Guest entity … a `type:'partner'` participant on their RSVP … no login or
Guest record", hub ADR-0024). Nothing new is being invented; the UI is being taught to show
a distinction the domain already has.

The contract already carries it. Both places the web reads a partner model it as an
OpenAPI `anyOf` whose **only** discriminator is the presence of `id`:

| Read site | Plus-one variant | Own-account variant |
|---|---|---|
| `UserProfileDto.guestInfo.partner` | `UserProfileListResponseDtoProfilesInnerGuestInfoPartnerAnyOf` (`firstName`, `lastName`) | `…PartnerAnyOf1` (`id`, `firstName`, `lastName`, `attending?`) |
| `RsvpDto.adults.partner2` | `RsvpDtoAdultsPartner2AnyOf` (`firstName`, `lastName`, `options?`) | `RsvpDtoAdultsPartner2AnyOf1` (`id`, …) |

There is a codegen wrinkle. openapi-generator flattens each `anyOf` into one merged
interface (`UserProfileListResponseDtoProfilesInnerGuestInfoPartner`,
`RsvpDtoAdultsPartner2`) in which **`id` is typed as required `string`** even though the
API legitimately omits it for a plus-one. The repo has already hit this twice and worked
around it locally with `as unknown as RsvpDtoAdultsPartner2` casts carrying a `// reason:`
comment (`src/app/core/helper/rsvp-draft.ts`, `src/app/screens/rsvp-create/rsvp-create.ts`).
Left alone, each new consumer invents its own workaround — and the tempting fix (declare a
local `Partner`/`PlusOne` union) is exactly what CLAUDE.md **Hard rule 15** forbids.

## Decision

1. **The presence of `id` is the sole client-side signal that a partner has their own guest
   account.** Not `attending`, not a name heuristic, not a lookup into the profile
   collection. `id` present ⇒ own account; `id` absent ⇒ plus-one.

2. **One shared predicate, no local type.** A single helper in
   `src/app/core/helper/` answers the question for both read sites:

   ```ts
   export function partnerHasAccount(
     partner: UserProfileListResponseDtoProfilesInnerGuestInfoPartner
            | RsvpDtoAdultsPartner2
            | AdultDraft
            | null
            | undefined,
   ): boolean;
   ```

   It takes the **generated** types (plus the pre-existing local editing shape
   `AdultDraft`) and returns a `boolean`. It declares no new type, no union alias, no
   interface — so Hard rule 15 is satisfied without an exception. It is a `boolean`, not a
   `partner is …AnyOf1` type predicate: the merged generated type already claims `id` is
   present, so a type predicate would narrow nothing and only add noise.

3. **Name fields are locked, not hidden, when the partner has an account.** Every editor
   that can reach a partner name (`app-manage-rsvp-modal`, `app-rsvp-edit`,
   `app-rsvp-create`) renders the name read-only in that case and shows the DS hint. The
   value is still carried forward verbatim on save. Rationale: the current
   `app-rsvp-create` accepts keystrokes into those fields and then *silently discards*
   them at submit time (`typedPartner` is skipped when `hasLinkedPartner()`), which is the
   worst of both worlds.

4. **The `disabled` visual state lives on the shared `app-input` component**, per the DS
   `core/Input` (`background: --chip`, `color: --sub`, `cursor: default`), rather than
   being restyled per screen. Web equivalents: `--surface-chip`, `--text-muted`.

5. **The distinction is display-only for now.** Nothing in these screens creates,
   provisions or unlinks an account. Creating a partner account remains admin-only via
   `POST /v1/guests` + `POST /v1/guests/{id}/partner/{partnerId}` (already implemented in
   `app-guest-create-modal`). The DS's guest-facing "Give them their own guest account" +
   phone-number sub-flow stays **out of scope** — see "Explicitly not decided".

## Consequences

- Four screens gain a consistent, testable rule; the two existing `as unknown as` casts
  keep their `// reason:` comments but are now backed by a documented decision rather than
  an ad-hoc note.
- `partnerHasAccount` is the single place to change if the contract ever gains a real
  discriminator (e.g. a `kind` field), instead of five call sites.
- A partner with their own account never gets a second guest-manager row: the row filter
  and `StatisticService.ownRsvp()` already keep a couple to the owning profile's row. The
  partner line on that row is now the only place their account status is visible, which
  makes rendering it correctly load-bearing rather than cosmetic.

## Explicitly not decided (would need a hub ADR)

- **Guest-initiated account provisioning.** The DS lets a guest flip "Give them their own
  guest account" and type the partner's phone number during RSVP. That creates an
  authenticated identity from an unauthenticated-ish surface and has no endpoint in the
  contract (`CreateGuestDto` is admin-gated; there is no self-serve variant). It is an
  auth-model question → hub ADR, not this repo.
- **Guest-facing roster search.** `ScreenRSVPCreate` matches the typed partner name
  against `window.WEDDING_PEOPLE`. There is no guest-readable guest-search endpoint;
  exposing one is a contract + privacy decision → hub.
- **`attending` on the partner variant.** The contract carries it; no screen uses it yet.
  Deciding what it means next to the RSVP's own `status` is a modelling question for the
  API side.

## References

- Hub: `GLOSSARY.md` §Plus-one, §Delegate; ADR-0022 (RSVP single mutable resource);
  ADR-0024 (RSVP participants, diet & menu); `contracts/openapi.json`
- DS: `ui_kits/wedding-app/{ScreenGuestManager,ScreenGuestManagerMobile,ScreenRSVPCreate,ScreenRSVPEdit}.jsx`,
  `components/core/Input.jsx` (`disabled` state)
- In-repo: ADR W-0001 (data layer), CLAUDE.md Hard rule 15, `src/app/core/helper/rsvp-draft.ts`
- Tasks: `TASKS.md` T255–T261
