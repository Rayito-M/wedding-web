import { rsvpDeadlineLabel } from './rsvp-deadline-label';

describe('rsvpDeadlineLabel (T393)', () => {
  it('renders the configured deadline in each locale, in the form the shipped copy used', () => {
    expect(rsvpDeadlineLabel('2027-05-01', 'en')).toBe('1 May');
    expect(rsvpDeadlineLabel('2027-05-01', 'es')).toBe('1 de mayo');
    expect(rsvpDeadlineLabel('2027-05-01', 'fr')).toBe('1er mai');
  });

  it('follows the configuration — a different deadline renders, not the historical 1 May', () => {
    expect(rsvpDeadlineLabel('2027-03-15', 'en')).toBe('15 March');
    expect(rsvpDeadlineLabel('2027-03-15', 'es')).toBe('15 de marzo');
  });

  it('only the FIRST of a month is ordinal in French — other days carry no "er"', () => {
    expect(rsvpDeadlineLabel('2027-05-15', 'fr')).toBe('15 mai');
    expect(rsvpDeadlineLabel('2027-05-02', 'fr')).toBe('2 mai');
  });

  it('takes the calendar date in Europe/Madrid, like every other date judgement in the app', () => {
    // 23:00 UTC on 30 April is already 1 May in Madrid (CEST, UTC+2): a
    // deadline stored with a time component must not render as the previous
    // day. The plain date form parses as UTC midnight and stays on its day.
    expect(rsvpDeadlineLabel('2027-04-30T23:00:00.000Z', 'en')).toBe('1 May');
    expect(rsvpDeadlineLabel('2027-05-01T00:00:00.000Z', 'en')).toBe('1 May');
  });

  it('returns the raw value for an unparseable deadline — visible degradation, not a hole in a sentence', () => {
    expect(rsvpDeadlineLabel('not-a-date', 'en')).toBe('not-a-date');
    expect(rsvpDeadlineLabel('', 'en')).toBe('');
  });
});
