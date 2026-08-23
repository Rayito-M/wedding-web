import {
  RsvpDtoAdultsPartner2OneOf,
  UserProfileListResponseDtoProfilesInnerGuestInfoPartner,
} from '../api';
import { partnerHasAccount } from './partner-account';
import { AdultDraft } from './rsvp-draft';

describe('partnerHasAccount', () => {
  it('is false when there is no partner at all', () => {
    expect(partnerHasAccount(undefined)).toBe(false);
    expect(partnerHasAccount(null)).toBe(false);
  });

  it('is true for kind: "guest" even with no id', () => {
    const linked: AdultDraft = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      options: {},
      kind: RsvpDtoAdultsPartner2OneOf.KindEnum.GUEST,
    };
    expect(partnerHasAccount(linked)).toBe(true);
  });

  it('is false for kind: "plus-one" carrying a stale id — the id no longer wins', () => {
    const stale: AdultDraft = {
      id: 'usr_123',
      firstName: 'Ada',
      lastName: 'Lovelace',
      options: {},
      kind: RsvpDtoAdultsPartner2OneOf.KindEnum.PLUS_ONE,
    };
    expect(partnerHasAccount(stale)).toBe(false);
  });

  it('is false when kind is missing, with or without an id', () => {
    const noKindNoId: AdultDraft = { firstName: 'Ada', lastName: 'Lovelace', options: {} };
    const noKindWithId: AdultDraft = {
      id: 'usr_123',
      firstName: 'Ada',
      lastName: 'Lovelace',
      options: {},
    };
    expect(partnerHasAccount(noKindNoId)).toBe(false);
    expect(partnerHasAccount(noKindWithId)).toBe(false);
  });

  it('is true for the profile partner variant with kind: "guest"', () => {
    const linked: UserProfileListResponseDtoProfilesInnerGuestInfoPartner = {
      id: 'usr_123',
      firstName: 'Ada',
      lastName: 'Lovelace',
      kind: UserProfileListResponseDtoProfilesInnerGuestInfoPartner.KindEnum.GUEST,
    };
    expect(partnerHasAccount(linked)).toBe(true);
  });
});
