import {
  RsvpDtoAdultsPartner2,
  UserProfileListResponseDtoProfilesInnerGuestInfoPartner,
} from '../api';
import { AdultDraft } from './rsvp-draft';

/**
 * Does this partner have their own guest account, or are they a plus-one?
 *
 * `id` is the only signal this checks — `kind` is a `partner2` concern only
 * (ADR W-0004) and is out of scope for this helper in this task; the
 * discriminator switch is T271. `RsvpDtoAdultsPartner2` is a real union
 * whose second member (`…OneOf1`) carries no `id` at all, so `id` is read
 * behind an `in` check — the one narrowing the union supports. The other
 * two input types still merge `id` in as an always-present field
 * (`UserProfileListResponseDtoProfilesInnerGuestInfoPartner`'s `anyOf`
 * flattening, and `AdultDraft`'s own optional `id`), so the check is
 * harmless there too.
 *
 * Returns a plain `boolean`, not a type predicate: this helper spans three
 * unrelated input types, so narrowing any one of them to a specific variant
 * of another would be unsound at its call sites. See ADR W-0002
 * §Decision.1–2, ADR W-0004 §Decision.4.
 */
export function partnerHasAccount(
  partner:
    | UserProfileListResponseDtoProfilesInnerGuestInfoPartner
    | RsvpDtoAdultsPartner2
    | AdultDraft
    | null
    | undefined,
): boolean {
  return !!partner && 'id' in partner && !!partner.id?.trim();
}
