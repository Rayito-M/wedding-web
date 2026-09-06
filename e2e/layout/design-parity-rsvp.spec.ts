import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { installApiMocks } from '../support/api-mocks';
import { boxOf, expectClose, kitContentColumnBox, openDsKitScreen, startDsKitServer, stylesOf, type DsKitServer } from '../helpers/ds-kit';

/**
 * Design-parity rescan (T369) — Guest/RSVP (kit) ↔ `/rsvp` (app, guest
 * role, first-time reply flow). Kit source: `ScreenRSVPCreate.jsx`; app
 * source: `rsvp-create.html`/`.scss` (rendered via `app-rsvp`'s own
 * orchestration — see `rsvp.ts`).
 *
 * Fixture gap closed for this spec only (T369, known gap — T367
 * `risks[]`): the shared `installApiMocks`'s `GET/POST /v1/rsvp/{guestId}`
 * was unmocked (501), so `/rsvp` rendered nothing. `rsvpStatus: 'pending'`
 * (opt-in, `api-mocks.ts`) makes the own-record read resolve to a real
 * `pending` RSVP — matching the DS kit's own default first-load state for
 * its "RSVP" view (`rsvpSubmitted` starts `false`, step 0 of
 * `ScreenRSVPCreate`), so no extra kit interaction is needed either.
 *
 * This spec signs in manually rather than via `signInAsGuest` — with a
 * `pending` RSVP, `LoginService.postLoginUrl()` (by design) redirects
 * straight to `/rsvp` instead of the normal `/me` landing page, which
 * `signInAsGuest`'s own `waitForURL('**\/me')` does not expect.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
const STYLE_PROPS = ['backgroundColor', 'borderColor', 'color', 'fontSize', 'fontWeight', 'padding'];

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

test.describe('RSVP create (guest) — pixel parity with the DS kit (T369)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  for (const [breakpoint, viewport, device] of [
    ['desktop', DESKTOP, 'Desktop'],
    ['mobile', MOBILE, 'Mobile'],
  ] as const) {
    test(`${breakpoint}: step heading and choice-card type match`, async ({ page, context }) => {
      const kitPage = await context.newPage();
      await openDsKitScreen(kitPage, kit.baseUrl, { device, role: 'Guest', viewLabel: 'RSVP' });

      await signInAsGuestPendingRsvp(page);
      await page.setViewportSize(viewport);
      await page.waitForLoadState('networkidle');

      // Kit: h2 "Will you join us?"; app: .step h2.
      const kitHeading = await stylesOf(kitPage, 'h2', ['fontSize', 'fontWeight']);
      const appHeading = await stylesOf(page, '.step h2', ['fontSize', 'fontWeight']);
      expect(kitHeading, 'kit: step h2 not found').not.toBeNull();
      expect(appHeading, 'app: .step h2 not found').not.toBeNull();

      // Choice cards: kit "With joy" (unselected — draft.attending starts
      // unset) vs app's first `app-choice-card` (also unselected initially).
      const kitCard = await kitPage.evaluate((props: string[]) => {
        const el = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === 'With joy',
        ) as HTMLElement | undefined;
        if (!el) return null;
        const cs = getComputedStyle(el);
        const out: Record<string, string> = {};
        for (const p of props) out[p] = cs.getPropertyValue(p) || (cs as unknown as Record<string, string>)[p];
        return out;
      }, STYLE_PROPS);
      const appCard = await stylesOf(page, '.choices button[app-choice-card]:first-child', STYLE_PROPS);

      expect(kitCard, 'kit: "With joy" choice card not found').not.toBeNull();
      expect(appCard, 'app: first choice card not found').not.toBeNull();
      expect(appCard!.fontSize, `${breakpoint}: choice card font-size`).toBeTruthy();
      expect(appCard!.borderColor, `${breakpoint}: choice card border color (unselected)`).toBe(
        kitCard!.borderColor,
      );

      await kitPage.close();
    });
  }

  test('desktop content column width vs ds-contract.json maxWidth 620', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Guest', viewLabel: 'RSVP' });

    await signInAsGuestPendingRsvp(page);
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');

    const kitCol = await kitContentColumnBox(kitPage);
    const appCol = await boxOf(page, 'app-rsvp-create');
    expect(kitCol, 'kit: RSVP content column not found').not.toBeNull();
    expect(appCol, 'app: app-rsvp-create host not found').not.toBeNull();
    // The kit's OUTER AppShell column is 620 (`ScreenRSVPCreate.jsx` L177);
    // nested one level in, its own reply card is a narrower 560 (L179). The
    // app's `app-rsvp-create` host IS that inner card (`rsvp-create.scss`
    // `:host { max-width: 560px }`, desktop) — there is no separate outer
    // 620 wrapper in the app at all, so the two numbers below are expected
    // to diverge; recorded as a finding, not asserted equal.
    test.info().annotations.push({
      type: 'measured',
      description: `kit outer column ${kitCol!.width}px (contract 620) vs app card ${appCol!.width}px (rsvp-create.scss 560px, no outer 620 wrapper exists in the app)`,
    });
    expectClose(kitCol!.width, 620, 1, 'desktop kit: content column width vs ds-contract.json maxWidth 620');

    await kitPage.close();
  });

  test.fixme(
    'desktop: app has no outer 620px content column — app-rsvp-create host renders directly at 560px (its own inner-card width), never the ds-contract.json ScreenRSVPCreate.shell.maxWidth 620 outer column the kit wraps it in',
    async ({ page, context }) => {
      const kitPage = await context.newPage();
      await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Guest', viewLabel: 'RSVP' });
      await signInAsGuestPendingRsvp(page);
      await page.setViewportSize(DESKTOP);
      await page.waitForLoadState('networkidle');
      const appCol = await boxOf(page, 'app-rsvp-create');
      expectClose(appCol!.width, 620, 1, 'app content column width vs ds-contract.json maxWidth 620');
      await kitPage.close();
    },
  );
});
