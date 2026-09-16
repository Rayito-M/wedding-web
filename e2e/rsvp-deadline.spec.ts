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
  // T397: two more joined the pattern — both said "any time" while the API
  // 410s RSVP writes after the configured deadline (rsvp.service.ts,
  // assertDeadlineOpen). Their absolutes are pinned in copy-absolutes.spec.ts;
  // here they take the same no-month, always-interpolated contract as the six.
  'rsvp.create.attending.hint',
  'rsvp.create.confirm.yesMessage',
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

/**
 * Month-name detector that respects accented letters (`\b` cannot).
 * `caseSensitive` exists for the whole-file sweep: English month names are
 * capitalized in prose, and matching "May" insensitively would flag every
 * "may still shift" and "may show" in the privacy bodies.
 */
function containsMonth(value: string, months: string[], caseSensitive = false): string | null {
  for (const month of months) {
    if (new RegExp(`(^|[^\\p{L}])${month}($|[^\\p{L}])`, caseSensitive ? 'u' : 'iu').test(value))
      return month;
  }
  return null;
}

function flattenLocale(locale: string): Record<string, string> {
  const flat: Record<string, string> = {};
  const walk = (node: unknown, prefix: string): void => {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const dotted = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) walk(value, dotted);
      else flat[dotted] = String(value);
    }
  };
  walk(
    JSON.parse(readFileSync(path.resolve(__dirname, `../public/i18n/${locale}.json`), 'utf8')),
    '',
  );
  return flat;
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

  // T397: the attending hint interpolates the same value — it used to
  // promise "any time", which the API has answered with 410 Gone since the
  // deadline shipped. It renders with the party toggles, so pick "With joy"
  // first (nothing is submitted by that).
  await page.locator('button[app-choice-card]').first().click();
  const hint = page.locator('app-rsvp-create .hint').first();
  await expect(hint).toContainText('you can edit all of it until 1 September.');
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

test('no month name is spelled ANYWHERE in a locale file — every date in copy is configuration (T396, T394\'s GUARD B)', () => {
  // T393 pinned six keys; T396 found the same defect outside them
  // (`schedule.header`'s "SAT · 5 JUN", `yesTitle`'s "See you in June") and
  // generalized the sweep to every value. The allowlist is EMPTY today —
  // adding a key to it is a decision to ship a date the couple cannot
  // change, and needs a reason next to it, like copy-absolutes' inventory.
  const ALLOWLIST: Record<string, string> = {};

  const offenders: string[] = [];
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(flattenLocale(locale))) {
      if (key in ALLOWLIST) continue;
      // English months are matched case-sensitively: "May" the month is
      // capitalized; "may" the verb is everywhere and legitimate.
      const month = containsMonth(value, MONTHS[locale], locale === 'en');
      if (month) offenders.push(`${locale}.json ${key} ("${month}")`);
    }
  }
  expect(
    offenders,
    'Month name(s) spelled in locale values — interpolate from the configuration (rsvpDeadlineLabel / weddingDayLabel / weddingMonthLabel), or allowlist with a reason',
  ).toEqual([]);
});
