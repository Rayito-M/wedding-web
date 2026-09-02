import { RsvpDto } from '../api';
import {
  AdultDraft,
  ChildDraft,
  RsvpDraft,
  attendingCount,
  canDeclineAlone,
  fromRsvpDraft,
  impliedStatus,
  isPersonComing,
  toRsvpDraft,
  unnamedAdultCount,
} from './rsvp-draft';

/**
 * A member carrying **no** `attending` flag at all.
 *
 * Hub ADR-0040 made `attending` required on every adult, so this shape is no
 * longer constructible — but it is still *readable*: stored RSVPs are not
 * re-validated on read (ADR-0040 §1) and this bundle outlives any single API
 * deploy (CLAUDE.md hard rule 17), so an RSVP written before the flag existed
 * still arrives looking like this. Several cases below — the T329 "absent
 * flags are not evidence" guards above all — assert precisely what the helpers
 * do with such a member, so the fixture has to be able to express it. The cast
 * is the assertion, not a shortcut; cases that mean "explicitly coming" pass
 * `attending: true`.
 */
const NO_FLAG = undefined as unknown as boolean;

const adult = (patch: Partial<AdultDraft> = {}): AdultDraft => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  options: {},
  attending: NO_FLAG,
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
    partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: NO_FLAG },
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
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: NO_FLAG },
        partner2: {
          id: 'usr_partner',
          firstName: 'Grace',
          lastName: 'Hopper',
          options: {},
          kind: 'guest',
          attending: NO_FLAG,
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
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', nickname: 'Ad', options: {}, attending: NO_FLAG },
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
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: NO_FLAG },
        partner2: {
          id: 'usr_partner',
          firstName: 'Grace',
          lastName: 'Hopper',
          nickname: 'Gigi',
          options: {},
          kind: 'guest',
          attending: NO_FLAG,
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
    // Regression guard: fromRsvpDraft() must not special-case status wrongly.
    // It does now special-case `status` (T328's impliedStatus), but this
    // fixture deliberately declares `status: DECLINED` with no explicit
    // per-adult `attending` flags at all — the shape of an RSVP declined
    // before this feature existed (CLAUDE.md hard rule 17: old documents
    // coexist with new bundles). impliedStatus's clause 5 (ADR W-0007
    // §Amendment3.8, "absent flags are not evidence") must leave `status`
    // standing as DECLINED rather than rolling it up to `attending`, and the
    // rest of the party (partner2, children) must still serialise untouched.
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
    // Both adults have their own account here, so both are eligible for the
    // roll-up (T328, impliedStatus) — the decline/re-attend below is driven
    // by their `attending` flags, not by poking `status` directly. This is
    // still the honest call flow to exercise at this layer (T329): the
    // per-adult toggle (`setAttending` in `rsvp-editor.ts`) writes exactly
    // these flags one at a time and is a real, distinct UI path from the
    // party-level status control (`setStatus`, now bidirectional per ADR
    // W-0007 §Amendment3.7) — that control's own sync behaviour belongs in
    // `rsvp-editor.spec.ts`, not here, since this file only ever imports the
    // pure `rsvp-draft.ts` helpers and has no handle on `setStatus` to drive.
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

    const bothDeclined = {
      ...attendingDraft,
      partner1: { ...attendingDraft.partner1, attending: false },
      partner2: attendingDraft.partner2 && { ...attendingDraft.partner2, attending: false },
    };
    const declinedDto = asDto({ ...fromRsvpDraft(bothDeclined) });
    const declinedDraft = toRsvpDraft(declinedDto);
    expect(declinedDraft.status).toBe('declined');
    expect(declinedDraft.partner2).toEqual({ ...attendingDraft.partner2, attending: false });
    expect(declinedDraft.children).toEqual(attendingDraft.children);

    const partner1ComesBack = { ...declinedDraft, partner1: { ...declinedDraft.partner1, attending: true } };
    const attendingAgainDto = asDto({ ...fromRsvpDraft(partner1ComesBack) });
    const attendingAgainDraft = toRsvpDraft(attendingAgainDto);
    expect(attendingAgainDraft.status).toBe('attending');
    expect(attendingAgainDraft.partner2).toEqual({ ...attendingDraft.partner2, attending: false });
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

  it('is true for a plus-one partner2 — dropping out is a decline that keeps the name, not a removal (T339, hub ADR-0040 §4)', () => {
    const value = draft({ partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one' }) });
    expect(canDeclineAlone(value, 'partner2')).toBe(true);
  });

  it('is true for an account-holding partner2', () => {
    const value = draft({ partner2: adult({ id: 'usr_partner', firstName: 'Grace', lastName: 'Hopper', kind: 'guest' }) });
    expect(canDeclineAlone(value, 'partner2')).toBe(true);
  });

  it('does not consult partnerHasAccount — the two adult slots take the same test (T339)', () => {
    const plusOne = draft({ partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one' }) });
    const account = draft({ partner2: adult({ id: 'usr_partner', firstName: 'Grace', lastName: 'Hopper', kind: 'guest' }) });
    for (const value of [plusOne, account]) {
      expect(canDeclineAlone(value, 'partner1')).toBe(canDeclineAlone(value, 'partner2'));
    }
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

  it('is unaffected by a plus-one partner2 who has not declined', () => {
    const value = draft({
      partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one' }),
    });
    expect(attendingCount(value)).toBe(2);
  });

  it('drops by one when a plus-one partner2 has declined (T339, hub ADR-0040 §4)', () => {
    const value = draft({
      partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one', attending: false }),
    });
    expect(attendingCount(value)).toBe(1);
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
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: NO_FLAG },
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

  it('serialises a plus-one partner2 with the attending key like any other adult (hub ADR-0040)', () => {
    // Was: "with no attending key at all". `rsvpMemberPartnerPlusOneSchema`
    // stopped `.omit()`ing `attending` in `wedding-api` a97cbf2, and
    // `RsvpDtoAdultsPartner2OneOf1.attending` is now a required `boolean`, so
    // the plus-one arm carries the flag on the wire exactly like the
    // account-holding one. Whether the editor may ever set it to `false` is a
    // separate, open question — ADR-0040 §4 / T339 — not a shape question.
    const value = draft({
      partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one', attending: true }),
    });
    const partner2 = fromRsvpDraft(value).adults?.partner2;
    expect(partner2 && 'attending' in partner2).toBe(true);
    expect(partner2?.attending).toBe(true);
  });
});

describe('attending is carried in every adult slot, both ways (hub ADR-0040, T338)', () => {
  // `attending` is required on `partner1` and on **both** `partner2` variants
  // since `wedding-api` a97cbf2. These cases pin the reading each helper takes
  // of an *explicit* flag in each adult slot, so the one that survives is
  // asserted rather than assumed. (The absent-flag reading is pinned
  // separately: `isPersonComing` above, and the T329 guards below.)

  it('round-trips an explicit true and an explicit false in the partner1 slot', () => {
    for (const attending of [true, false]) {
      const dto = rsvpDto({
        adults: {
          partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending },
        },
      });
      expect(toRsvpDraft(dto).partner1.attending).toBe(attending);
      expect(fromRsvpDraft(toRsvpDraft(dto)).adults?.partner1?.attending).toBe(attending);
      expect(isPersonComing(toRsvpDraft(dto).partner1)).toBe(attending);
    }
  });

  it('round-trips an explicit true and an explicit false in the account-holding partner2 slot', () => {
    for (const attending of [true, false]) {
      const dto = rsvpDto({
        adults: {
          partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: true },
          partner2: {
            id: 'usr_partner',
            firstName: 'Grace',
            lastName: 'Hopper',
            options: {},
            kind: 'guest',
            attending,
          },
        },
      });
      expect(toRsvpDraft(dto).partner2?.attending).toBe(attending);
      expect(fromRsvpDraft(toRsvpDraft(dto)).adults?.partner2?.attending).toBe(attending);
      expect(isPersonComing(toRsvpDraft(dto).partner2)).toBe(attending);
    }
  });

  it('round-trips an explicit true and an explicit false in the plus-one partner2 slot', () => {
    for (const attending of [true, false]) {
      const dto = rsvpDto({
        adults: {
          partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: true },
          partner2: { firstName: 'Grace', lastName: 'Hopper', options: {}, kind: 'plus-one', attending },
        },
      });
      expect(toRsvpDraft(dto).partner2?.attending).toBe(attending);
      expect(fromRsvpDraft(toRsvpDraft(dto)).adults?.partner2?.attending).toBe(attending);
      expect(isPersonComing(toRsvpDraft(dto).partner2)).toBe(attending);
    }
  });

  it('a declined plus-one moves both roll-ups, like any other adult (T339, hub ADR-0040 §4)', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner1: adult({ id: 'usr_self', attending: true }),
      partner2: adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one', attending: false }),
    });
    expect(canDeclineAlone(value, 'partner2')).toBe(true);
    // partner1 is still coming, so the party is still attending — but the
    // plus-one's seat comes off the total.
    expect(attendingCount(value)).toBe(1);
    expect(impliedStatus(value)).toBe('attending');
  });
});

describe('a plus-one can decline (T339, closing hub ADR-0040 §4)', () => {
  const plusOne = (patch: Partial<AdultDraft> = {}): AdultDraft =>
    adult({ firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one', ...patch });

  it('rolls the party up to declined when the only second adult is a declined plus-one and partner1 has declined too', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner1: adult({ id: 'usr_self', attending: false }),
      partner2: plusOne({ attending: false }),
    });
    expect(impliedStatus(value)).toBe('declined');
    expect(fromRsvpDraft(value).status).toBe('declined');
    expect(attendingCount(value)).toBe(0);
  });

  it('keeps the party attending when the plus-one declines but partner1 does not', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner1: adult({ id: 'usr_self', attending: true }),
      partner2: plusOne({ attending: false }),
      children: [child()],
    });
    expect(impliedStatus(value)).toBe('attending');
    // 3 in the party, minus the declined plus-one; the child still counts.
    expect(attendingCount(value)).toBe(2);
  });

  it('serialises the declined plus-one rather than pruning them from the party (ADR W-0004 §Decision.6)', () => {
    const value = draft({ partner2: plusOne({ attending: false }) });
    expect(fromRsvpDraft(value).adults?.partner2).toEqual({
      firstName: 'Grace',
      lastName: 'Hopper',
      options: {},
      kind: 'plus-one',
      attending: false,
    });
  });

  it('round-trips a declined plus-one through the wire and back', () => {
    const dto = rsvpDto({
      adults: {
        partner1: { id: 'usr_self', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: true },
        partner2: { firstName: 'Grace', lastName: 'Hopper', options: {}, kind: 'plus-one', attending: false },
      },
    });
    const back = toRsvpDraft(dto);
    expect(back.partner2?.attending).toBe(false);
    expect(canDeclineAlone(back, 'partner2')).toBe(true);
    expect(isPersonComing(back.partner2)).toBe(false);
  });
});

describe('impliedStatus (ADR W-0007 §Amendment2.5, T328)', () => {
  it('stays attending when one of two eligible adults has declined', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner1: adult({ id: 'usr_self', attending: false }),
      partner2: adult({ id: 'usr_partner', kind: 'guest' }), // attending undefined => coming
    });
    expect(impliedStatus(value)).toBe('attending');
  });

  it('becomes declined when both eligible adults have declined', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner1: adult({ id: 'usr_self', attending: false }),
      partner2: adult({ id: 'usr_partner', kind: 'guest', attending: false }),
    });
    expect(impliedStatus(value)).toBe('declined');
  });

  it('stays declined when both eligible adults have declined and children are present', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner1: adult({ id: 'usr_self', attending: false }),
      partner2: adult({ id: 'usr_partner', kind: 'guest', attending: false }),
      children: [child(), child({ firstName: 'Alan' })],
    });
    expect(impliedStatus(value)).toBe('declined');
  });

  it('flips a previously-declined party back to attending when one adult re-toggles to coming', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.DECLINED,
      partner1: adult({ id: 'usr_self', attending: true }),
      partner2: adult({ id: 'usr_partner', kind: 'guest', attending: false }),
    });
    expect(impliedStatus(value)).toBe('attending');
  });

  it('is never touched when status is pending, however the flags read', () => {
    const bothDeclined = draft({
      status: RsvpDto.StatusEnum.PENDING,
      partner1: adult({ id: 'usr_self', attending: false }),
      partner2: adult({ id: 'usr_partner', kind: 'guest', attending: false }),
    });
    expect(impliedStatus(bothDeclined)).toBe('pending');

    const bothComing = draft({
      status: RsvpDto.StatusEnum.PENDING,
      partner1: adult({ id: 'usr_self' }),
      partner2: adult({ id: 'usr_partner', kind: 'guest' }),
    });
    expect(impliedStatus(bothComing)).toBe('pending');

    const noPartner2 = draft({ status: RsvpDto.StatusEnum.PENDING });
    expect(impliedStatus(noPartner2)).toBe('pending');
  });

  it('stands as-is for a lone partner1 with no partner2 — nobody is eligible to decline', () => {
    // canDeclineAlone('partner1') requires a partner2 to exist; with none,
    // there is no one this draft's status could roll up from.
    const attending = draft({ status: RsvpDto.StatusEnum.ATTENDING, partner1: adult({ id: 'usr_self', attending: false }) });
    expect(impliedStatus(attending)).toBe('attending');

    const declined = draft({ status: RsvpDto.StatusEnum.DECLINED, partner1: adult({ id: 'usr_self' }) });
    expect(impliedStatus(declined)).toBe('declined');
  });

  it('is a no-op through fromRsvpDraft when nobody has declined (round trip lands "attending" on the wire)', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner2: adult({ id: 'usr_partner', kind: 'guest' }),
    });
    expect(fromRsvpDraft(value).status).toBe('attending');
  });

  it('lands "declined" on the wire payload when both eligible adults have declined', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner1: adult({ id: 'usr_self', attending: false }),
      partner2: adult({ id: 'usr_partner', kind: 'guest', attending: false }),
      children: [child()],
    });
    expect(fromRsvpDraft(value).status).toBe('declined');
  });
});

describe('absent flags are not evidence (ADR W-0007 §Amendment3.8, T329) — permanent regression guard', () => {
  it('a party of two account-holding adults with status: declined and no flags at all stays declined', () => {
    // The exact defect T328 shipped: two eligible adults, neither carrying an
    // explicit `attending`, on a party that already declined before this
    // feature existed. A plain roll-up ("no explicit decline ⇒ coming") would
    // silently promote this back to `attending` on the next save.
    const value = draft({
      status: RsvpDto.StatusEnum.DECLINED,
      partner1: adult({ id: 'usr_self' }),
      partner2: adult({ id: 'usr_partner', kind: 'guest' }),
    });
    expect(impliedStatus(value)).toBe('declined');
    expect(fromRsvpDraft(value).status).toBe('declined');
  });

  it('the same shape with status: attending and no flags stays attending', () => {
    const value = draft({
      status: RsvpDto.StatusEnum.ATTENDING,
      partner1: adult({ id: 'usr_self' }),
      partner2: adult({ id: 'usr_partner', kind: 'guest' }),
    });
    expect(impliedStatus(value)).toBe('attending');
    expect(fromRsvpDraft(value).status).toBe('attending');
  });
});
