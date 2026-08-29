import { byAgendaTime } from './agenda-order';

const item = (id: string, time: string) => ({ id, time });

describe('byAgendaTime', () => {
  it('puts agenda items in clock order', () => {
    const sorted = byAgendaTime([
      item('c', '2027-06-05T18:00:00Z'),
      item('a', '2027-06-05T12:30:00Z'),
      item('b', '2027-06-05T15:00:00Z'),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('orders across days, not just hours', () => {
    const sorted = byAgendaTime([
      item('day2-morning', '2027-06-06T09:00:00Z'),
      item('day1-evening', '2027-06-05T22:00:00Z'),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['day1-evening', 'day2-morning']);
  });

  it('reads the `Z` suffix as the venue wall clock, never converting it', () => {
    // 23:00Z sorts after 01:00Z on the same date. A `Date` comparison in a
    // browser east of UTC would agree here, but only by accident — the point
    // is that no conversion happens at all (see `extractAgendaTime`).
    const sorted = byAgendaTime([
      item('late', '2027-06-05T23:00:00Z'),
      item('early', '2027-06-05T01:00:00Z'),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['early', 'late']);
  });

  it('parks a half-typed, non-ISO time at the end instead of the top', () => {
    // The config manager writes `time` as the admin types it; an intermediate
    // value must not make the row it is being edited on jump to the top.
    const sorted = byAgendaTime([
      item('typing', '2027-06-0'),
      item('noon', '2027-06-05T12:00:00Z'),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['noon', 'typing']);
  });

  it('keeps same-time items in their existing order (stable)', () => {
    const sorted = byAgendaTime([
      item('added-first', '2027-06-05T12:00:00Z'),
      item('added-second', '2027-06-05T12:00:00Z'),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['added-first', 'added-second']);
  });

  it('never mutates the array it was given', () => {
    const input = [item('b', '2027-06-05T18:00:00Z'), item('a', '2027-06-05T12:00:00Z')];
    byAgendaTime(input);
    expect(input.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('handles the empty agenda', () => {
    expect(byAgendaTime([])).toEqual([]);
  });
});
