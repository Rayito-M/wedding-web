import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { test, expect, Page } from '@playwright/test';

import { OTP_CODE_TTL_MINUTES, MAGIC_LINK_TTL_MINUTES } from '../src/app/core/helper/auth-ttl';
import { installApiMocks } from './support/api-mocks';

/**
 * The sign-in TTLs come from ONE source per repo, and the repos agree — T396.
 *
 * `login.code.sub` said the code "expires in 10 minutes" while the API's
 * `CODE_TTL_MINUTES` was 5 — and the SMS template interpolates the real
 * constant, so the guest's text message and the screen above it disagreed by
 * a factor of two, during sign-in, the first thing a guest ever reads from
 * this app (T394's finding). The response DTOs carry only `{ ok }`, so the
 * client cannot read the server's value at runtime; the fix is a client
 * constant defined ONCE (`src/app/core/helper/auth-ttl.ts`), interpolated
 * into the copy as `{{minutes}}`.
 *
 * What keeps the constant itself honest — without re-asserting the literal
 * it guards: the API's value is read off the sibling `wedding-api` checkout
 * and compared to the imported client constant. That is not a tautology:
 * the two numbers live in different repos and either can move alone. The
 * e2e suite is local-only (`CLAUDE.md` rule 11 — no CI workflow runs it),
 * so the four-repo layout is present wherever this suite actually runs; if
 * the sibling is ever missing the check SKIPS visibly instead of passing
 * vacuously — an honest "cannot be checked from here", never a silent pass.
 */

const LOCALES = ['es', 'en', 'fr'] as const;

const API_REPO = path.resolve(__dirname, '../../wedding-api');

const PAIRS = [
  {
    name: 'OTP code',
    clientValue: OTP_CODE_TTL_MINUTES,
    apiFile: 'src/modules/auth/sms-verification.service.ts',
    apiConstant: 'CODE_TTL_MINUTES',
    key: 'login.code.sub',
  },
  {
    name: 'magic link',
    clientValue: MAGIC_LINK_TTL_MINUTES,
    apiFile: 'src/modules/auth/magic-link.service.ts',
    apiConstant: 'TOKEN_TTL_MINUTES',
    key: 'login.magicLink.sub',
  },
] as const;

function apiConstant(relativePath: string, name: string): number {
  const source = readFileSync(path.join(API_REPO, relativePath), 'utf8');
  const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  expect(match, `${relativePath} no longer defines ${name} — the guard needs re-pointing`).not.toBeNull();
  return Number(match![1]);
}

function localeValue(locale: string, dottedKey: string): string {
  let node: unknown = JSON.parse(
    readFileSync(path.resolve(__dirname, `../public/i18n/${locale}.json`), 'utf8'),
  );
  for (const part of dottedKey.split('.')) {
    node = (node as Record<string, unknown>)[part];
  }
  return node as string;
}

test('the client TTL constants equal the API\'s own — the number the SMS in the guest\'s hand carries (T396)', () => {
  test.skip(
    !existsSync(API_REPO),
    'wedding-api sibling checkout not found — the cross-repo TTL check only runs in the four-repo layout (it is the whole point of this test; do not let this skip become permanent)',
  );

  for (const pair of PAIRS) {
    expect(
      apiConstant(pair.apiFile, pair.apiConstant),
      `${pair.name}: wedding-api's ${pair.apiConstant} and the client's copy in auth-ttl.ts disagree — whichever moved, move the other in the same change (the SMS/email template uses the API's value; ${pair.key} renders the client's)`,
    ).toBe(pair.clientValue);
  }
});

test('the sign-in copy interpolates {{minutes}} and carries no literal minute count, in any locale (T396)', () => {
  for (const locale of LOCALES) {
    for (const pair of PAIRS) {
      const value = localeValue(locale, pair.key);
      expect(value, `${locale}.json ${pair.key} must interpolate the TTL`).toContain('{{minutes}}');
      expect(
        value.match(/\d+\s*min/i),
        `${locale}.json ${pair.key} hardcodes a minute count — the TTL is the API's, not the locale file's`,
      ).toBeNull();
    }
  }
});

/** Same manual sign-in start as `rsvp-deadline.spec.ts`. */
async function requestOtp(page: Page): Promise<void> {
  await installApiMocks(page, { role: 'guest', rsvpStatus: 'pending' });
  await page.goto('/login');
  await page.locator('input[formcontrolname="phoneNumber"]').fill('612345679');
  await page.locator('form.form button[type="submit"]').click();
}

test('the code screen renders the constant\'s value — the wiring, live (T396)', async ({ page }) => {
  await requestOtp(page);

  await expect(page.locator('input[formcontrolname="code"]')).toBeVisible();
  // en is the active locale in the harness; the value comes from the same
  // constant the cross-repo test pins, so no minute literal is re-typed here.
  await expect(page.locator('app-auth-heading')).toContainText(
    `It expires in ${OTP_CODE_TTL_MINUTES} minutes.`,
  );
});
