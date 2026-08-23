import { RsvpDto, RsvpDtoAdultsPartner2OneOf } from '../api';
import {
  AdultDraft,
  ChildDraft,
  RsvpDraft,
  fromRsvpDraft,
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
    const value = draft({ partner2: adult({ id: 'usr_partner', firstName: '', lastName: '' }) });
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
          kind: RsvpDtoAdultsPartner2OneOf.KindEnum.GUEST,
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
