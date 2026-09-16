import { weddingDayLabel, weddingMonthLabel } from './wedding-day-label';

describe('weddingDayLabel (T396)', () => {
  it('renders the configured date in each locale, in the shipped header form', () => {
    expect(weddingDayLabel('2027-06-05', 'en')).toBe('SAT · 5 JUN');
    expect(weddingDayLabel('2027-06-05', 'es')).toBe('SÁB · 5 JUN');
    // The locale file used to say "SAM · 5 JUI" — an abbreviation that is
    // ambiguous with juillet; Intl's "JUIN" is the correct short form.
    expect(weddingDayLabel('2027-06-05', 'fr')).toBe('SAM · 5 JUIN');
  });

  it('follows the configuration — a moved wedding renders its own day, not the historical one', () => {
    expect(weddingDayLabel('2027-09-11', 'en')).toBe('SAT · 11 SEPT');
    expect(weddingDayLabel('2027-09-11', 'es')).toBe('SÁB · 11 SEPT');
  });

  it('takes the calendar date in Europe/Madrid', () => {
    // 23:00 UTC on 4 June is already Saturday 5 June in Madrid (CEST).
    expect(weddingDayLabel('2027-06-04T23:00:00.000Z', 'en')).toBe('SAT · 5 JUN');
  });

  it('appends the year for the date badge\'s wide form', () => {
    expect(weddingDayLabel('2027-06-05', 'en', true)).toBe('SAT · 5 JUN 2027');
    expect(weddingDayLabel('2027-06-05', 'fr', true)).toBe('SAM · 5 JUIN 2027');
  });

  it('degrades visibly: raw value when unparseable, empty when empty (the header has no room for a placeholder)', () => {
    expect(weddingDayLabel('not-a-date', 'en')).toBe('not-a-date');
    expect(weddingDayLabel('', 'en')).toBe('');
  });
});

describe('weddingMonthLabel (T396)', () => {
  it('renders the configured month in each locale, cased the way the language writes months mid-sentence', () => {
    expect(weddingMonthLabel('2027-06-05', 'en')).toBe('June');
    expect(weddingMonthLabel('2027-06-05', 'es')).toBe('junio');
    expect(weddingMonthLabel('2027-06-05', 'fr')).toBe('juin');
  });

  it('follows the configuration', () => {
    expect(weddingMonthLabel('2027-09-11', 'en')).toBe('September');
    expect(weddingMonthLabel('2027-09-11', 'es')).toBe('septiembre');
  });

  it('degrades visibly: raw value when unparseable, empty when empty', () => {
    expect(weddingMonthLabel('not-a-date', 'en')).toBe('not-a-date');
    expect(weddingMonthLabel('', 'en')).toBe('');
  });
});
