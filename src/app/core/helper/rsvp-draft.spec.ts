import { RsvpDto } from '../api';
import {
  AdultDraft,
  ChildDraft,
  RsvpDraft,
  attendingCount,
  canDeclineAlone,
  fromRsvpDraft,
  isPersonComing,
  toRsvpDraft,
  unnamedAdultCount,
} from './rsvp-draft';

const adult = (patch: Partial<AdultDraft> = {}): AdultDraft => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  options: {},
  ...patch,
});

const child = (patch: Partial<ChildDraft> = {}): ChildDraft => ({
  firstName: 'Iris',
  age: '7',
  options: {},
  ...patch,
});

const draft = (patch: Partial<RsvpDraft> = {}): RsvpDraft => ({
  status: RsvpDto.StatusEnum.ATTENDING,
  version: 1,
  partner1: adult({ id: 'usr_self' }),
  children: [],
  ...patch,
});

const rsvpDto = (patch: Partial<RsvpDto> = {}): RsvpDto => ({
  id: 'usr_self',
  version: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  status: RsvpDto.StatusEnum.ATTENDING,
  adults: {
    partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {} },
  },
  children: [],
  submittedBy: 'usr_self',
  ...patch,
});

describe('unnamedAdultCount', () => {
  it('is 0 when every adult has both names', () => {
    expect(unnamedAdultCount(draft())).toBe(0);
  });

  it('counts the primary guest when a last name is missing', () => {
    expect(unnamedAdultCount(draft({ partner1: adult({ id: 'usr_self', lastName: '  ' }) }))).toBe(1);
  });

  it('counts a plus-one partner with neither name', () => {
    const value = draft({ partner2: adult({ firstName: '', lastName: '' }) });
    expect(unnamedAdultCount(value)).toBe(1);
  });

  it('does not count a partner whose name is owned by their own guest account', () => {
    const value = draft({
      partner2: adult({
        id: 'usr_partner',
        firstName: '',
        lastName: '',
        kind: 'guest',
      }),
    });
    expect(unnamedAdultCount(value)).toBe(0);
  });

  it('never counts children, however unnamed', () => {
    const value = draft({ children: [child({ firstName: '', age: '' }), child({ firstName: '   ' })] });
    expect(unnamedAdultCount(value)).toBe(0);
  });
});

describe('partner2.kind (ADR W-0004)', () => {
  it('survives a linked partner2 unchanged from DTO through toRsvpDraft and back through fromRsvpDraft', () => {
    const dto = rsvpDto({
      adults: {
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {} },
        partner2: {
          id: 'usr_partner',
          firstName: 'Grace',
          lastName: 'Hopper',
          options: {},
          kind: 'guest',
        },
      },
    });
    const draftFromDto = toRsvpDraft(dto);
    expect(draftFromDto.partner2?.kind).toBe('guest');

    const serialised = fromRsvpDraft(draftFromDto);
    expect(serialised.adults?.partner2).toEqual({
      id: 'usr_partner',
      firstName: 'Grace',
      lastName: 'Hopper',
      options: {},
      kind: 'guest',
    });
  });

  it('serialises a plus-one partner2 with kind: "plus-one" and no id key at all', () => {
    const value = draft({
      partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one' }),
    });
    const partner2 = fromRsvpDraft(value).adults?.partner2;
    expect(partner2).toEqual({ firstName: 'Grace', lastName: 'Hopper', options: {}, kind: 'plus-one' });
    expect(partner2 && 'id' in partner2).toBe(false);
  });

  it('keeps both id and kind: "guest" for a linked partner2', () => {
    const value = draft({
      partner2: adult({ id: 'usr_partner', firstName: 'Grace', lastName: 'Hopper', kind: 'guest' }),
    });
    const partner2 = fromRsvpDraft(value).adults?.partner2;
    expect(partner2).toEqual({
      id: 'usr_partner',
      firstName: 'Grace',
      lastName: 'Hopper',
      options: {},
      kind: 'guest',
    });
  });

  it('never puts kind on partner1', () => {
    const value = draft();
    const partner1 = fromRsvpDraft(value).adults?.partner1;
    expect(partner1 && 'kind' in partner1).toBe(false);
  });

  it('never puts kind on a serialised child', () => {
    const value = draft({ children: [child()] });
    const [serialisedChild] = fromRsvpDraft(value).children ?? [];
    expect(serialisedChild && 'kind' in serialisedChild).toBe(false);
  });
});

describe('nickname (T299)', () => {
  it('round-trips a partner1 nickname through toRsvpDraft and fromRsvpDraft', () => {
    const dto = rsvpDto({
      adults: {
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', nickname: 'Ad', options: {} },
      },
    });
    const draftFromDto = toRsvpDraft(dto);
    expect(draftFromDto.partner1.nickname).toBe('Ad');

    const serialised = fromRsvpDraft(draftFromDto);
    expect(serialised.adults?.partner1?.nickname).toBe('Ad');
  });

  it('round-trips a partner2 and a child nickname through toRsvpDraft and fromRsvpDraft', () => {
    const dto = rsvpDto({
      adults: {
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {} },
        partner2: {
          id: 'usr_partner',
          firstName: 'Grace',
          lastName: 'Hopper',
          nickname: 'Gigi',
          options: {},
          kind: 'guest',
        },
      },
      children: [{ firstName: 'Iris', age: 7, nickname: 'Iri', options: {} }],
    });
    const draftFromDto = toRsvpDraft(dto);
    expect(draftFromDto.partner2?.nickname).toBe('Gigi');
    expect(draftFromDto.children[0]?.nickname).toBe('Iri');

    const serialised = fromRsvpDraft(draftFromDto);
    expect(serialised.adults?.partner2?.nickname).toBe('Gigi');
    expect(serialised.children?.[0]?.nickname).toBe('Iri');
  });

  it('trims a nickname on save', () => {
    const value = draft({ partner1: adult({ id: 'usr_self', nickname: '  Ad  ' }) });
    expect(fromRsvpDraft(value).adults?.partner1?.nickname).toBe('Ad');
  });

  it('omits (never sends "") a cleared partner1 nickname', () => {
    const value = draft({ partner1: adult({ id: 'usr_self', nickname: '' }) });
    const partner1 = fromRsvpDraft(value).adults?.partner1;
    expect(partner1?.nickname).toBeUndefined();
    expect(partner1).not.toEqual(expect.objectContaining({ nickname: '' }));
  });

  it('omits (never sends "") a cleared child nickname', () => {
    const value = draft({ children: [child({ nickname: '   ' })] });
    const [serialisedChild] = fromRsvpDraft(value).children ?? [];
    expect(serialisedChild?.nickname).toBeUndefined();
    expect(serialisedChild).not.toEqual(expect.objectContaining({ nickname: '' }));
  });

  it('omits (never sends "") a cleared partner2 nickname', () => {
    const value = draft({
      partner2: adult({ id: 'usr_partner', kind: 'guest', nickname: '' }),
    });
    const partner2 = fromRsvpDraft(value).adults?.partner2;
    expect(partner2?.nickname).toBeUndefined();
    expect(partner2).not.toEqual(expect.objectContaining({ nickname: '' }));
  });
});

describe('declining never prunes the party (ADR W-0004 §Decision.6)', () => {
  it('keeps the party on a declined save', () => {
    // Regression guard: fromRsvpDraft() must not special-case status. It
    // already behaves — this exists so a future "a declined RSVP has no
    // party" simplification fails loudly, and so does a caller who starts
    // withholding partner2/children before calling this when declining.
    const value = draft({
      status: RsvpDto.StatusEnum.DECLINED,
      partner2: adult({
        firstName: 'Grace',
        lastName: 'Hopper',
        kind: 'plus-one',
        options: { dietaryPreferenceIds: ['vegetarian'], allergyIds: ['nuts'] },
      }),
      children: [
        child({ firstName: 'Iris', age: '7', options: { customAllergies: ['pollen'] } }),
        child({ firstName: 'Alan', age: '3', options: {} }),
      ],
    });

    const serialised = fromRsvpDraft(value);

    expect(serialised.status).toBe('declined');
    expect(serialised.adults?.partner2).toEqual({
      firstName: 'Grace',
      lastName: 'Hopper',
      options: { dietaryPreferenceIds: ['vegetarian'], allergyIds: ['nuts'] },
      kind: 'plus-one',
    });
    expect(serialised.children).toEqual([
      { firstName: 'Iris', age: 7, options: { customAllergies: ['pollen'] } },
      { firstName: 'Alan', age: 3, options: {} },
    ]);
  });

  it('round-trips the party through a decline and back to attending', () => {
    // draft (full party, attending) -> fromRsvpDraft -> toRsvpDraft
    // (declined) -> fromRsvpDraft -> toRsvpDraft (attending again) -> the
    // party is unchanged throughout, at the draft layer only (no live API).
    const attendingDraft = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner2: adult({
        id: 'usr_partner',
        firstName: 'Grace',
        lastName: 'Hopper',
        kind: 'guest',
        options: { dietaryPreferenceIds: ['vegan'], allergyIds: ['shellfish'], customAllergies: ['kiwi'] },
      }),
      children: [child({ firstName: 'Iris', age: '7', options: { customAllergies: ['pollen'] } })],
    });

    const asDto = (partial: Partial<RsvpDto>): RsvpDto => rsvpDto(partial);

    const declinedDto = asDto({
      ...fromRsvpDraft({ ...attendingDraft, status: RsvpDto.StatusEnum.DECLINED }),
    });
    const declinedDraft = toRsvpDraft(declinedDto);
    expect(declinedDraft.status).toBe('declined');
    expect(declinedDraft.partner2).toEqual(attendingDraft.partner2);
    expect(declinedDraft.children).toEqual(attendingDraft.children);

    const attendingAgainDto = asDto({
      ...fromRsvpDraft({ ...declinedDraft, status: RsvpDto.StatusEnum.ATTENDING }),
    });
    const attendingAgainDraft = toRsvpDraft(attendingAgainDto);
    expect(attendingAgainDraft.status).toBe('attending');
    expect(attendingAgainDraft.partner2).toEqual(attendingDraft.partner2);
    expect(attendingAgainDraft.children).toEqual(attendingDraft.children);
  });
});

describe('canDeclineAlone (ADR W-0007 §Amendment, T326)', () => {
  it('is true for partner1 alongside an account-holding partner2', () => {
    const value = draft({ partner2: adult({ id: 'usr_partner', kind: 'guest' }) });
    expect(canDeclineAlone(value, 'partner1')).toBe(true);
  });

  it('is false for partner1 when there is no partner2 (party of one adult)', () => {
    expect(canDeclineAlone(draft(), 'partner1')).toBe(false);
  });

  it('is true for partner1 even when the only other adult is an account-less plus-one (ADR W-0007 §Amendment.3 — known, accepted-for-now consequence: applying the DS rule literally does not require partner2 to have an account for partner1 to be eligible)', () => {
    const value = draft({ partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one' }) });
    expect(canDeclineAlone(value, 'partner1')).toBe(true);
  });

  it('is false for a child key', () => {
    const value = draft({ children: [child()] });
    expect(canDeclineAlone(value, 'child:0')).toBe(false);
  });

  it('is false when partner2 is absent', () => {
    expect(canDeclineAlone(draft(), 'partner2')).toBe(false);
  });

  it('is false for a plus-one partner2', () => {
    const value = draft({ partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one' }) });
    expect(canDeclineAlone(value, 'partner2')).toBe(false);
  });

  it('is true only for an account-holding partner2', () => {
    const value = draft({ partner2: adult({ id: 'usr_partner', firstName: 'Grace', lastName: 'Hopper', kind: 'guest' }) });
    expect(canDeclineAlone(value, 'partner2')).toBe(true);
  });
});

describe('isPersonComing', () => {
  it('is true when attending is undefined', () => {
    expect(isPersonComing({ attending: undefined })).toBe(true);
    expect(isPersonComing(undefined)).toBe(true);
  });

  it('is true when attending is explicitly true', () => {
    expect(isPersonComing({ attending: true })).toBe(true);
  });

  it('is false only when attending is explicitly false', () => {
    expect(isPersonComing({ attending: false })).toBe(false);
  });
});

describe('attendingCount (ADR W-0007, T320)', () => {
  it('matches total party size when nobody has solo-declined', () => {
    const value = draft({
      partner2: adult({ id: 'usr_partner', kind: 'guest' }),
      children: [child(), child({ firstName: 'Alan' })],
    });
    expect(attendingCount(value)).toBe(4);
  });

  it('drops by exactly one when an account-holding partner2 has declined', () => {
    const value = draft({
      partner2: adult({ id: 'usr_partner', kind: 'guest', attending: false }),
      children: [child()],
    });
    expect(attendingCount(value)).toBe(2);
  });

  it('is unaffected by a plus-one partner2 (cannot solo-decline)', () => {
    const value = draft({
      partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one' }),
    });
    expect(attendingCount(value)).toBe(2);
  });

  it('is unaffected by a child (cannot solo-decline)', () => {
    const value = draft({ children: [child()] });
    expect(attendingCount(value)).toBe(2);
  });

  it('drops by two when both adults have solo-declined (T326)', () => {
    const value = draft({
      partner1: adult({ id: 'usr_self', attending: false }),
      partner2: adult({ id: 'usr_partner', kind: 'guest', attending: false }),
      children: [child()],
    });
    expect(attendingCount(value)).toBe(1);
  });
});

describe('attending (ADR W-0007, T320) round-trip', () => {
  it('survives an account-holding partner2.attending: false through toRsvpDraft and back through fromRsvpDraft', () => {
    const dto = rsvpDto({
      adults: {
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {} },
        partner2: {
          id: 'usr_partner',
          firstName: 'Grace',
          lastName: 'Hopper',
          options: {},
          kind: 'guest',
          attending: false,
        },
      },
    });
    const draftFromDto = toRsvpDraft(dto);
    expect(draftFromDto.partner2?.attending).toBe(false);

    const serialised = fromRsvpDraft(draftFromDto);
    expect(serialised.adults?.partner2).toEqual({
      id: 'usr_partner',
      firstName: 'Grace',
      lastName: 'Hopper',
      options: {},
      kind: 'guest',
      attending: false,
    });
  });

  it('reads and round-trips partner1.attending: false through toRsvpDraft and back through fromRsvpDraft (T326)', () => {
    const dto = rsvpDto({
      adults: {
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: false },
      },
    });
    const draftFromDto = toRsvpDraft(dto);
    expect(draftFromDto.partner1.attending).toBe(false);

    const serialised = fromRsvpDraft(draftFromDto);
    expect(serialised.adults?.partner1?.attending).toBe(false);
  });

  it('serialises a plus-one partner2 with no attending key at all', () => {
    const value = draft({
      partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one' }),
    });
    const partner2 = fromRsvpDraft(value).adults?.partner2;
    expect(partner2 && 'attending' in partner2).toBe(false);
  });
});
