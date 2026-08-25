import { todayInMadrid } from './madrid-today';

describe('todayInMadrid', () => {
  it('formats a UTC noon instant as the same Madrid calendar date (CET, UTC+1)', () => {
    // 2027-01-15T12:00:00Z is 13:00 in Madrid in January (CET) — same day.
    expect(todayInMadrid(new Date('2027-01-15T12:00:00Z'))).toBe('2027-01-15');
  });

  it('rolls over to the next Madrid day for a late-UTC instant (CEST, UTC+2)', () => {
    // 2027-06-05T23:00:00Z is 2027-06-06T01:00 in Madrid in June (CEST) — next day.
    expect(todayInMadrid(new Date('2027-06-05T23:00:00Z'))).toBe('2027-06-06');
  });

  it('disagrees with a naive browser-local read when the visitor is west of Madrid', () => {
    // A visitor in, say, US Eastern time (UTC-4/-5) reading `new Date()` locally
    // at 2027-06-05T23:30 local (2027-06-06T03:30Z) would still see "the 5th" if
    // it read `Date#getDate()` in its own zone; Madrid is already the 6th.
    const instant = new Date('2027-06-06T03:30:00Z');
    expect(todayInMadrid(instant)).toBe('2027-06-06');
  });

  it('returns a plain YYYY-MM-DD string comparable with a milestone plannedDate', () => {
    const today = todayInMadrid(new Date('2027-03-01T10:00:00Z'));
    expect(today < '2027-03-02').toBe(true);
    expect(today > '2027-02-28').toBe(true);
  });
});
