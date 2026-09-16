import { readFileSync } from 'node:fs';
import path from 'node:path';

import { test, expect, Page } from '@playwright/test';

import { installApiMocks } from './support/api-mocks';

/**
 * The RSVP deadline in guest-facing copy is the CONFIGURED one — T393.
 *
 * Six locale keys used to say the deadline in words ("1 May" / "1 de mayo" /
 * "1er mai") while `rsvpDeadline` is a field the couple edits in Settings →
 * Basics — copy that was right only because the configured value happened to
 * be 2027-05-01, and that nothing could catch going stale (T391's
 * enumeration, highest-consequence entry). The screens now interpolate
 * `{{deadline}}` from the public config, via `rsvpDeadlineLabel`.
 *
 * Two halves, T391's method:
 *
 * 1. LIVE — a signed-in guest's RSVP screen renders the date the FIXTURE
 *    configures (`CONFIG_PUBLIC.rsvpDeadline`, 2026-09-01 → "1 September"),
 *    so changing the fixture's deadline changes what must appear — that is
 *    the bite, proven in T393's report by editing the fixture and watching
 *    this fail.
 * 2. OFF DISK — each of the six keys, in all three locales, carries the
 *    `{{deadline}}` placeholder and NO month name, so the date cannot be
 *    typed back into a locale file without failing the suite.
 */

const LOCALES = ['es', 'en', 'fr'] as const;

const DEADLINE_KEYS = [
  'rsvp.create.attending.subtitle',
  'rsvp.edit.seatsHeld.none',
  'rsvp.edit.seatsHeld.singular',
  'rsvp.edit.seatsHeld.plural',
  'rsvp.edit.declinedSub',
  'rsvp.hub.detail.declinedSub',
];

const MONTHS: Record<(typeof LOCALES)[number], string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
};

function localeValue(locale: string, dottedKey: string): string {
  let node: unknown = JSON.parse(
    readFileSync(path.resolve(__dirname, `../public/i18n/${locale}.json`), 'utf8'),
  );
  for (const part of dottedKey.split('.')) {
    node = (node as Record<string, unknown>)[part];
  }
  return node as string;
}

/** Month-name detector that respects accented letters (`\b` cannot). */
function containsMonth(value: string, months: string[]): string | null {
  for (const month of months) {
    if (new RegExp(`(^|[^\\p{L}])${month}($|[^\\p{L}])`, 'iu').test(value)) return month;
  }
  return null;
}

/** Same manual sign-in as `design-parity-rsvp.spec.ts`: with a `pending`
 *  RSVP the post-login redirect lands on `/rsvp` (the create flow). */
async function signInAsGuestPendingRsvp(page: Page): Promise<void> {
  await installApiMocks(page, { role: 'guest', rsvpStatus: 'pending' });
  await page.goto('/login');
  await page.locator('input[formcontrolname="phoneNumber"]').fill('612345679');
  await page.locator('form.form button[type="submit"]').click();
  const codeInput = page.locator('input[formcontrolname="code"]');
  await expect(codeInput).toBeVisible();
  await codeInput.fill('123456');
  await page.locator('form.form button[type="submit"]').click();
  await page.waitForURL('**/rsvp');
}

test('the RSVP screen renders the deadline the fixture CONFIGURES, not a hardcoded month (T393)', async ({
  page,
}) => {
  await signInAsGuestPendingRsvp(page);

  // `CONFIG_PUBLIC.rsvpDeadline` is 2026-09-01 (api-mocks.ts). The active
  // locale is `en`, so the interpolated label is "1 September" — a date no
  // locale file ever carried, which is exactly the point: it can only have
  // come from the configuration.
  const subtitle = page.locator('app-rsvp-create .sub').first();
  await expect(subtitle).toContainText('Please reply by 1 September.');
  // And the coincidence the old copy leaned on is gone for good:
  await expect(subtitle).not.toContainText('May');
});

test('the six deadline keys interpolate {{deadline}} and carry no month, in any locale (T393)', () => {
  for (const locale of LOCALES) {
    for (const key of DEADLINE_KEYS) {
      const value = localeValue(locale, key);
      expect(value, `${locale}.json ${key} must interpolate the configured deadline`).toContain(
        '{{deadline}}',
      );
      const month = containsMonth(value, MONTHS[locale]);
      expect(
        month,
        `${locale}.json ${key} hardcodes "${month}" — the deadline is configuration, not copy`,
      ).toBeNull();
    }
  }
});
