import { test, expect } from '@playwright/test';

import { installApiMocks } from './support/api-mocks';

/**
 * Real smoke coverage (T263 acceptance): the app boots, the welcome screen
 * renders real copy, and the language switcher actually changes rendered
 * text. No placeholder or always-true assertions — every expectation below
 * would fail if the screen were blank, mistranslated, or the switcher were
 * inert.
 */
test.describe('Welcome screen boots and the language switcher works', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMocks(page);
  });

  test('renders the welcome screen with real copy, in English by default', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('Save the date')).toBeVisible();
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();
  });

  test('switching the language actually changes rendered copy', async ({ page }) => {
    await page.goto('/');

    // English copy first, so the switch below is a real change, not an
    // assertion made against whatever the default happens to be.
    await expect(page.getByRole('button', { name: "Let's start" })).toBeVisible();

    await page.getByRole('button', { name: 'EN', exact: false }).click();
    await page.getByRole('button', { name: /ES/ }).click();

    await expect(page.getByRole('button', { name: 'Abrir invitación' })).toBeVisible();
    await expect(page.getByRole('button', { name: "Let's start" })).toHaveCount(0);
  });
});
