import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';
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
 * Design-parity rescan (T369) — the couple's Home (`/dashboard`) against
 * the DS kit's Home view, `role: 'Couple'`. `ScreenHome.jsx`'s `content`
 * branch (non-`overview`) renders the SAME "Hola, {name}." greeting and
 * Today/Getting-there pills for both roles — only `overviewContent`
 * (Manage · Overview, `design-parity-overview.spec.ts`) differs — so this
 * reuses `assertHomeSubnavParity`/`measureAppHomeSubnav` byte-for-byte
 * rather than re-deriving them (`dashboard.html`'s `#plan` template shares
 * `.greeting .hello` / `app-home-subnav` markup with `invitee.html`).
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.describe('Home umbrella (couple) — pixel parity with the DS kit (T369)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  test('desktop (≥900px): pill row matches the DS kit', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Couple', viewLabel: 'Home' });

    await signInAsCouple(page);
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');

    await assertHomeSubnavParity(kitPage, page, true, 'desktop');

    const kitCol = await kitContentColumnBox(kitPage);
    const appCol = await boxOf(page, 'app-dashboard');
    expect(kitCol, 'kit: Home content column not found').not.toBeNull();
    expect(appCol, 'app: app-dashboard host not found').not.toBeNull();
    expectClose(kitCol!.width, 900, 1, 'desktop kit: content column width vs ds-contract.json maxWidth 900');
    expectClose(appCol!.width, 900, 1, 'desktop app: content column width vs ds-contract.json maxWidth 900');

    await kitPage.close();
  });

  test('mobile: pill row matches the DS kit', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Mobile', role: 'Couple', viewLabel: 'Home' });

    await signInAsCouple(page);
    await page.setViewportSize(MOBILE);
    await page.waitForLoadState('networkidle');

    await assertHomeSubnavParity(kitPage, page, false, 'mobile');
    await kitPage.close();
  });
});
