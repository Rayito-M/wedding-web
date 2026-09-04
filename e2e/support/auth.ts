import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { installApiMocks } from './api-mocks';

/**
 * Signs a couple (bride) in through the real `/login` OTP flow, network
 * stubbed via {@link installApiMocks} — never a token seeded into storage.
 * `LoginService` keeps auth state in an in-memory signal (CLAUDE.md hard rule
 * 10), so there is nothing to seed even if this suite wanted to; driving the
 * actual form is the only way in.
 *
 * Leaves the page on `/dashboard` (the couple's landing route,
 * `LoginService.landingUrl`) — callers that need `/guests` navigate there
 * themselves afterwards.
 *
 * `opts.pageSize`, when set, turns on real cursor pagination in the
 * `GET /v1/profile` stub (`installApiMocks`) instead of the single-page
 * default every other caller relies on — see that function's own doc.
 * `opts.dietaryPreferencesCount` passes through to the same function's
 * `GET /v1/config` stub — see its own doc. `opts.milestoneCount` passes
 * through to its `GET /v1/milestones` stub — see its own doc.
 */
export async function signInAsCouple(
  page: Page,
  opts: {
    guestCount?: number;
    pageSize?: number;
    dietaryPreferencesCount?: number;
    milestoneCount?: number;
  } = {},
): Promise<void> {
  await installApiMocks(page, opts);

  await page.goto('/login');

  await page.locator('input[formcontrolname="phoneNumber"]').fill('612345678');
  await page.locator('form.form button[type="submit"]').click();

  const codeInput = page.locator('input[formcontrolname="code"]');
  await expect(codeInput).toBeVisible();
  await codeInput.fill('123456');
  await page.locator('form.form button[type="submit"]').click();

  await page.waitForURL('**/dashboard');
}
