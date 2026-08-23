import {
  RsvpDto,
  RsvpDtoAdultsPartner1,
  RsvpDtoAdultsPartner1Options,
  RsvpDtoAdultsPartner2,
  RsvpDtoChildrenInner,
} from '../api';
import { partnerHasAccount } from './partner-account';

/**
 * Editable in-memory shape of an RSVP. Its one editor is the shared
 * `app-rsvp-editor` (in-repo ADR W-0003), mounted by the guest's own
 * `app-rsvp-edit` screen and by the couple's `app-manage-rsvp-modal` in the
 * guest manager. Those two hosts own the draft signal and the `PATCH`; the
 * draft ⇄ DTO mapping lives here so it is written once for both.
 */

/** Addressable slot in a party — `partner1` is always the primary guest. */
export type PersonKey = 'partner1' | 'partner2' | `child:${number}`;

/**
 * One adult (partner1 or partner2). `id` is only ever known for `partner1`
 * (self) or a `partner2` who already has an account (server-linked on
 * `create`) — never edited, only carried forward so a save doesn't silently
 * drop an existing account link.
 */
export interface AdultDraft {
  readonly id?: string;
  firstName: string;
  lastName: string;
  options: RsvpDtoAdultsPartner1Options;
}

/** Age is kept as free text while editing so an empty field reads as empty,
 *  not `0`; it is parsed to a number on save. */
export interface ChildDraft {
  firstName: string;
  age: string;
  options: RsvpDtoAdultsPartner1Options;
}

export interface RsvpDraft {
  status: RsvpDto.StatusEnum;
  readonly version: number;
  partner1: AdultDraft;
  partner2?: AdultDraft;
  children: ChildDraft[];
}

/** Placeholder for components that must initialise a draft signal before the
 *  real RSVP has landed (see `app-rsvp-edit`, `app-manage-rsvp-modal`). */
export const EMPTY_RSVP_DRAFT: RsvpDraft = {
  status: RsvpDto.StatusEnum.PENDING,
  version: 0,
  partner1: { id: '', firstName: '', lastName: '', options: {} },
  children: [],
};

export function toRsvpDraft(rsvp: RsvpDto): RsvpDraft {
  return {
    status: rsvp.status,
    version: rsvp.version,
    partner1: {
      id: rsvp.adults.partner1.id,
      firstName: rsvp.adults.partner1.firstName,
      lastName: rsvp.adults.partner1.lastName,
      options: rsvp.adults.partner1.options ?? {},
    },
    partner2: rsvp.adults.partner2
      ? {
          id: rsvp.adults.partner2.id,
          firstName: rsvp.adults.partner2.firstName,
          lastName: rsvp.adults.partner2.lastName,
          options: rsvp.adults.partner2.options ?? {},
        }
      : undefined,
    children: (rsvp.children ?? []).map((c) => ({
      firstName: c.firstName,
      age: String(c.age),
      options: c.options ?? {},
    })),
  };
}

export function fromRsvpDraft(draft: RsvpDraft): Partial<RsvpDto> {
  const partner1: RsvpDtoAdultsPartner1 = {
    id: draft.partner1.id as string,
    firstName: draft.partner1.firstName.trim(),
    lastName: draft.partner1.lastName.trim(),
    options: draft.partner1.options,
  };
  const partner2: RsvpDtoAdultsPartner2 | undefined = draft.partner2
    ? // reason: the generated `RsvpDtoAdultsPartner2` type incorrectly requires
      // `id` (an OpenAPI `anyOf`-merge artifact); the API's Zod schema
      // (`RsvpParticipantSchema`, wedding-api rsvp.ts) allows partner2 without
      // an id for a party member with no account — `id` is only included here
      // when one was already known (carried forward, never editable in this UI).
      ({
        ...(draft.partner2.id ? { id: draft.partner2.id } : {}),
        firstName: draft.partner2.firstName.trim(),
        lastName: draft.partner2.lastName.trim(),
        options: draft.partner2.options,
      } as unknown as RsvpDtoAdultsPartner2)
    : undefined;
  const children: RsvpDtoChildrenInner[] = draft.children.map((c) => ({
    firstName: c.firstName.trim(),
    age: Number(c.age) || 0,
    options: c.options,
  }));
  return {
    status: draft.status,
    version: draft.version,
    adults: { partner1, partner2 },
    children,
  };
}

/** Apply `mutate` to one person's meal options, returning a new draft. */
export function withPersonOptions(
  draft: RsvpDraft,
  key: PersonKey,
  mutate: (options: RsvpDtoAdultsPartner1Options) => RsvpDtoAdultsPartner1Options,
): RsvpDraft {
  if (key === 'partner1') {
    return { ...draft, partner1: { ...draft.partner1, options: mutate(draft.partner1.options) } };
  }
  if (key === 'partner2' && draft.partner2) {
    return { ...draft, partner2: { ...draft.partner2, options: mutate(draft.partner2.options) } };
  }
  if (key.startsWith('child:')) {
    const index = Number(key.slice('child:'.length));
    return {
      ...draft,
      children: draft.children.map((c, i) => (i === index ? { ...c, options: mutate(c.options) } : c)),
    };
  }
  return draft;
}

/** Toggle one catalog id inside a list-valued option field. */
export function toggleOptionId(
  options: RsvpDtoAdultsPartner1Options,
  field: 'dietaryPreferenceIds' | 'allergyIds',
  id: string,
): RsvpDtoAdultsPartner1Options {
  const current = options[field] ?? [];
  return {
    ...options,
    [field]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
  };
}

/**
 * How many adults in the party are still missing a first or last name?
 *
 * Every adult goes on the guest list under a full name, so both hosts of the
 * shared RSVP editor gate their save on this count (ADR W-0003 §Decision.7 —
 * one rule, replacing `RsvpEdit.unnamedCount` and `ManageRsvpModal.partnerNameOk`).
 * Children are never counted: they are listed by first name and age.
 *
 * A `partner2` whose name is owned by their own guest account is excluded —
 * that name is read-only in this UI (ADR W-0002 §Decision.3), so counting it
 * would leave the editor with a gate nobody can satisfy. `partner1` is always
 * counted: they are the signed-in guest themself, so they always carry an `id`
 * and the account-lock never applies to them (this mirrors `RsvpEdit`, which
 * hard-codes `hasAccount: false` for the primary card).
 */
export function unnamedAdultCount(draft: RsvpDraft): number {
  const adults: AdultDraft[] = [draft.partner1];
  if (draft.partner2 && !partnerHasAccount(draft.partner2)) adults.push(draft.partner2);
  return adults.filter((a) => !a.firstName.trim() || !a.lastName.trim()).length;
}
