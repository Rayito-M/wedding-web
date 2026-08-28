import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';

import { lastSeenLabel } from './last-seen-label';

// The absolute-date fallback formats through Angular's `DatePipe`, which
// needs `es`/`fr` locale data registered — `main.ts` does this once for the
// running app, but this spec exercises the helper in isolation, so it must
// register the same locales itself (`en` needs nothing extra: it is
// Angular's built-in default).
registerLocaleData(localeEs);
registerLocaleData(localeFr);

// Mirrors `public/i18n/{en,es,fr}.json`'s `guest_manager.lastSeen.*` — kept
// local rather than importing the JSON so this spec exercises the function's
// contract (a `translate` callback in, a whole phrase out) independently of
// any i18n loader wiring.
const COPY: Record<'en' | 'es' | 'fr', Record<string, string>> = {
  en: {
    today: 'Today',
    yesterday: 'Yesterday',
    lastWeek: 'Last week',
    lastMonth: 'Last month',
    never: 'Never signed in',
  },
  es: {
    today: 'Hoy',
    yesterday: 'Ayer',
    lastWeek: 'La semana pasada',
    lastMonth: 'El mes pasado',
    never: 'Nunca ha iniciado sesión',
  },
  fr: {
    today: "Aujourd’hui",
    yesterday: 'Hier',
    lastWeek: 'La semaine dernière',
    lastMonth: 'Le mois dernier',
    never: 'Jamais connecté',
  },
};

function translate(locale: 'en' | 'es' | 'fr'): (key: string) => string {
  return (key: string) => {
    const bucket = key.split('.').pop() as string;
    return COPY[locale][bucket] ?? key;
  };
}

const TODAY = '2027-03-15';

describe('lastSeenLabel', () => {
  it('returns "Never signed in" for a null value', () => {
    expect(lastSeenLabel(null, TODAY, 'en', translate('en'))).toBe('Never signed in');
  });

  it('returns "Never signed in" for an undefined value', () => {
    expect(lastSeenLabel(undefined, TODAY, 'en', translate('en'))).toBe('Never signed in');
  });

  it('buckets a same-day date as "Today"', () => {
    expect(lastSeenLabel('2027-03-15', TODAY, 'en', translate('en'))).toBe('Today');
  });

  it('buckets one day back as "Yesterday"', () => {
    expect(lastSeenLabel('2027-03-14', TODAY, 'en', translate('en'))).toBe('Yesterday');
  });

  it('buckets 2–7 days back as "Last week" (both boundaries)', () => {
    expect(lastSeenLabel('2027-03-13', TODAY, 'en', translate('en'))).toBe('Last week'); // 2 days
    expect(lastSeenLabel('2027-03-08', TODAY, 'en', translate('en'))).toBe('Last week'); // 7 days
  });

  it('buckets 8–30 days back as "Last month" (both boundaries)', () => {
    expect(lastSeenLabel('2027-03-07', TODAY, 'en', translate('en'))).toBe('Last month'); // 8 days
    expect(lastSeenLabel('2027-02-13', TODAY, 'en', translate('en'))).toBe('Last month'); // 30 days
  });

  it('falls back to an absolute date beyond 30 days', () => {
    // 31 days back — one past the "Last month" boundary.
    expect(lastSeenLabel('2027-02-12', TODAY, 'en', translate('en'))).toBe('12 Feb 2027');
  });

  it('falls back to an absolute date for a much older value', () => {
    expect(lastSeenLabel('2026-11-02', TODAY, 'en', translate('en'))).toBe('2 Nov 2026');
  });

  it('never reconstructs a time of day — same-day always reads "Today" regardless of clock time', () => {
    // The raw value and `todayIso` are both plain YYYY-MM-DD; there is nothing
    // to compare at time-of-day resolution (hub ADR-0035 §1).
    expect(lastSeenLabel(TODAY, TODAY, 'en', translate('en'))).toBe('Today');
  });

  describe('locales', () => {
    it('renders every bucket in Spanish', () => {
      expect(lastSeenLabel(null, TODAY, 'es', translate('es'))).toBe('Nunca ha iniciado sesión');
      expect(lastSeenLabel('2027-03-15', TODAY, 'es', translate('es'))).toBe('Hoy');
      expect(lastSeenLabel('2027-03-14', TODAY, 'es', translate('es'))).toBe('Ayer');
      expect(lastSeenLabel('2027-03-13', TODAY, 'es', translate('es'))).toBe('La semana pasada');
      expect(lastSeenLabel('2027-03-07', TODAY, 'es', translate('es'))).toBe('El mes pasado');
      expect(lastSeenLabel('2027-02-12', TODAY, 'es', translate('es'))).toBe('12 feb 2027');
    });

    it('renders every bucket in French', () => {
      expect(lastSeenLabel(null, TODAY, 'fr', translate('fr'))).toBe('Jamais connecté');
      expect(lastSeenLabel('2027-03-15', TODAY, 'fr', translate('fr'))).toBe('Aujourd’hui');
      expect(lastSeenLabel('2027-03-14', TODAY, 'fr', translate('fr'))).toBe('Hier');
      expect(lastSeenLabel('2027-03-13', TODAY, 'fr', translate('fr'))).toBe('La semaine dernière');
      expect(lastSeenLabel('2027-03-07', TODAY, 'fr', translate('fr'))).toBe('Le mois dernier');
      expect(lastSeenLabel('2027-02-12', TODAY, 'fr', translate('fr'))).toBe('12 févr. 2027');
    });

    it('does not build the fallback sentence by lower-casing an English bucket label', () => {
      // The DS `ProfileCard.jsx` anti-pattern this task exists to avoid: a
      // Spanish/French bucket phrase must come from `translate`, never from
      // an English string transformed in code.
      const label = lastSeenLabel('2027-03-14', TODAY, 'es', translate('es'));
      expect(label).toBe('Ayer');
      expect(label.toLowerCase()).not.toBe('yesterday');
    });
  });
});
