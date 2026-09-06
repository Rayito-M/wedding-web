import { test, expect } from '@playwright/test';

import { signInAsGuest } from '../support/auth';
import {
  assertHomeSubnavParity,
  boxOf,
  kitContentColumnBox,
  expectClose,
  openDsKitScreen,
  startDsKitServer,
  type DsKitServer,
} from '../helpers/ds-kit';

/**
 * Design-system pixel-parity harness (T368, owner-reported; width metric
 * added T369) — the process half of the fix, and the template every other
 * screen-parity spec reuses (`e2e/helpers/ds-kit.ts` carries the
 * kit-serving/toggle-driving half AND, since T369, the Home-subnav metric
 * extraction itself — this file is now just the assertions + wiring for
 * the GUEST render; `design-parity-dashboard.spec.ts` is the couple's).
 *
 * The owner's side-by-side screenshots showed three measured divergences
 * from the DS's own `ui_kits/wedding-app/AppShell.jsx` (L40-82, the
 * authoritative numbers — read the source, not a paraphrase of it):
 * alignment (the pill row must sit flush with the greeting/h1 below it),
 * vertical rhythm (header -> 26px -> row -> 18px -> greeting, desktop;
 * header -> 10px -> row -> 4px -> greeting, mobile), and the pill's own
 * colors/type (unselected: `var(--surface)` fill, hairline border, `12px`
 * desktop / `11px` mobile, weight 500; selected: `var(--accent)` fill,
 * transparent border). T369 adds the content-column width against
 * `contract/ds-contract.json`'s `screens.ScreenHome.shell.maxWidth` (900).
 *
 * Metric-based, not a raw-pixel screenshot diff, so it is robust to
 * anti-aliasing and to the kit's frame (1200x760/400x780) and the app's
 * real viewport being different sizes.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.describe('Home umbrella (guest) — pixel parity with the DS kit (hub ADR-0045 §4, T368/T369)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  test('desktop (≥900px): pill row matches the DS kit', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Guest', viewLabel: 'Home' });

    await signInAsGuest(page);
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');

    await assertHomeSubnavParity(kitPage, page, true, 'desktop');

    // Content column width (T369) — `contract/ds-contract.json`'s
    // `screens.ScreenHome.shell.maxWidth` is 900; both the kit's own
    // `AppShell.jsx` centered wrapper and the app's `:host` (border-box,
    // `main.scss`'s global `box-sizing: border-box`) are measured directly
    // rather than diffed against each other, since the two pages' frames
    // are different overall widths and only the DS's literal number is a
    // fixed target for both.
    const kitCol = await kitContentColumnBox(kitPage);
    const appCol = await boxOf(page, 'app-invitee');
    expect(kitCol, 'kit: Home content column not found').not.toBeNull();
    expect(appCol, 'app: app-invitee host not found').not.toBeNull();
    expectClose(kitCol!.width, 900, 1, 'desktop kit: content column width vs ds-contract.json maxWidth 900');
    expectClose(appCol!.width, 900, 1, 'desktop app: content column width vs ds-contract.json maxWidth 900');

    await kitPage.close();
  });

  test('mobile: pill row matches the DS kit', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Mobile', role: 'Guest', viewLabel: 'Home' });

    await signInAsGuest(page);
    await page.setViewportSize(MOBILE);
    await page.waitForLoadState('networkidle');

    await assertHomeSubnavParity(kitPage, page, false, 'mobile');
    await kitPage.close();
  });
});
