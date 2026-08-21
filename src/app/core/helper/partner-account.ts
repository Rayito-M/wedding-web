import {
  RsvpDtoAdultsPartner2,
  UserProfileListResponseDtoProfilesInnerGuestInfoPartner,
} from '../api';
import { AdultDraft } from './rsvp-draft';

/**
 * Does this partner have their own guest account, or are they a plus-one?
 *
 * The contract models a partner as an OpenAPI `anyOf` whose **only**
 * discriminator is the presence of `id` (`…PartnerAnyOf1` / `RsvpDtoAdultsPartner2AnyOf1`
 * carry it, the plus-one variants do not). openapi-generator flattens each
 * `anyOf` into a single merged interface in which `id` is wrongly typed as a
 * required `string`, so the type system cannot answer this — a runtime check
 * can, and this is the one place that makes it.
 *
 * Returns a plain `boolean`, not a `partner is …AnyOf1` type predicate: the
 * merged generated type already claims `id` is present, so a predicate would
 * narrow nothing. See ADR W-0002 §Decision.1–2.
 */
export function partnerHasAccount(
  partner:
    | UserProfileListResponseDtoProfilesInnerGuestInfoPartner
    | RsvpDtoAdultsPartner2
    | AdultDraft
    | null
    | undefined,
): boolean {
  return !!partner?.id?.trim();
}
