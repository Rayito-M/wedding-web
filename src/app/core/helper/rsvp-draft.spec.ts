import { RsvpDto } from '../api';
import { AdultDraft, ChildDraft, RsvpDraft, unnamedAdultCount } from './rsvp-draft';

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
