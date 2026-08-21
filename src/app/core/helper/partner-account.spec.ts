import { UserProfileListResponseDtoProfilesInnerGuestInfoPartner } from '../api';
import { partnerHasAccount } from './partner-account';
import { AdultDraft } from './rsvp-draft';

describe('partnerHasAccount', () => {
  it('is false when there is no partner at all', () => {
    expect(partnerHasAccount(undefined)).toBe(false);
    expect(partnerHasAccount(null)).toBe(false);
  });

  it('is false for a plus-one — a name with no account id', () => {
    const plusOne: AdultDraft = { firstName: 'Ada', lastName: 'Lovelace', options: {} };
    expect(partnerHasAccount(plusOne)).toBe(false);
  });

  it('is true for a partner with their own guest account', () => {
    const linked: UserProfileListResponseDtoProfilesInnerGuestInfoPartner = {
      id: 'usr_123',
      firstName: 'Ada',
      lastName: 'Lovelace',
    };
    expect(partnerHasAccount(linked)).toBe(true);
  });

  it('is false for an empty or blank id', () => {
    const empty: AdultDraft = { id: '', firstName: 'Ada', lastName: 'Lovelace', options: {} };
    const blank: AdultDraft = { id: '   ', firstName: 'Ada', lastName: 'Lovelace', options: {} };
    expect(partnerHasAccount(empty)).toBe(false);
    expect(partnerHasAccount(blank)).toBe(false);
  });
});
