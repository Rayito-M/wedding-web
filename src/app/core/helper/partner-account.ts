import {
  RsvpDtoAdultsPartner2,
  UserProfileListResponseDtoItemsInnerGuestInfoPartner,
} from '../api';
import { AdultDraft } from './rsvp-draft';

/**
 * Does this partner have their own guest account, or are they a plus-one?
 *
 * `kind === 'guest'` is the sole signal, with no `id` fallback and no `??`
 * default (ADR W-0004 §Decision.1, §Decision.3): the backend has already
 * migrated the stored documents, so `kind` is always present on the wire and
 * an `id` carried next to a stale `kind: 'plus-one'` does not count. This
 * supersedes ADR W-0002 §Decision.1, which made `id` the discriminator back
 * when the contract had none of its own; `adults.partner1` never carries
 * `kind`, so `partnerHasAccount(partner1)` now answers `false` where the old
 * `id` rule answered `true` — stated here because no caller passes
 * `partner1` today and none may start to (ADR W-0004 §Decision.4).
 *
 * Returns a plain `boolean`, not a `partner is …OneOf` type predicate, for
 * two independent reasons (ADR W-0004 §Decision.4, amended 2026-08-23): (a)
 * the upstream Zod fix gave each `RsvpDtoAdultsPartner2` union member its own
 * `kind` literal, but openapi-generator has no code path that emits a type —
 * enum or literal — for a JSON Schema `const`, so the generated `kind` field
 * degrades to plain `string` on both members and the `KindEnum` namespace is
 * gone entirely; there is no generated discriminator of any kind left to
 * narrow on, so a type predicate would be an unchecked assertion, not a
 * narrowing; (b) this helper also accepts `AdultDraft` and the profile
 * partner type, so narrowing either of those to a generated API interface
 * would be unsound at their call sites.
 */
export function partnerHasAccount(
  partner:
    | UserProfileListResponseDtoItemsInnerGuestInfoPartner
    | RsvpDtoAdultsPartner2
    | AdultDraft
    | null
    | undefined,
): boolean {
  return partner?.kind === 'guest';
}
