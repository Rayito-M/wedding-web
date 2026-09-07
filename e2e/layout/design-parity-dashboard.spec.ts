import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';
import {
  assertHomeSubnavParity,
  blockOutline,
  boxOf,
  kitContentColumnBox,
  expectClose,
  openDsKitScreen,
  startDsKitServer,
  type DsKitServer,
} from '../helpers/ds-kit';

/**
 * The kit still renders the "Today" content's live-album preview
 * (`albumRow`) — for the couple role it is the ONLY block in the right
 * column (`role === 'couple' ? [albumRow] : [rsvpConfirmed, albumRow]`,
 * `ScreenHome.jsx`). The app cuts it — `/album` is not an enabled
 * destination (hub ADR-0045 §2's "+ Album only if ever re-scoped") —
 * pre-existing, from before T372/T373. Filtered out of the kit outline
 * explicitly: without it the couple's right column would compare 1 kit
 * block against the app's deliberate 0 (T372: the couple also drops the
 * RSVP recap, so nothing is left there at all).
 */
function dropAlbumBlock(blocks: Awaited<ReturnType<typeof blockOutline>>) {
  return blocks.filter((b) => !b.label.includes('photos in the live album'));
}

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

  // — T373: block-outline parity, couple side (role symmetry with
  // design-parity-home.spec.ts's guest render — hub ADR-0044's amendment
  // explicitly requires measuring EVERY role the kit declares for a shared
  // screen, not just one). This is the exact check T369's own metrics
  // missed: it compared the couple's OLD planning dashboard to this kit
  // view and called it a match because both start with a greeting and a
  // countdown — the block outline (day highlights present, RSVP recap
  // absent) is what actually tells the two apart.
  test('desktop: block outline (order + column) matches the DS kit (T373)', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Couple', viewLabel: 'Home' });

    await signInAsCouple(page);
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');

    const kitOutline = dropAlbumBlock(
      await blockOutline(kitPage, 'div[style*="grid-template-columns: 1.15fr 0.85fr"]'),
    );
    const appOutline = await blockOutline(page, 'app-home-today .content');

    // Couple: countdown + day highlights only — no RSVP recap (T372's own
    // `isCouple` gate), no album (pre-existing cut, filtered above).
    expect(appOutline.length, 'block count (countdown, day highlights)').toBe(kitOutline.length);
    expect(appOutline.map((b) => b.column), 'block column placement, in DOM order').toEqual(
      kitOutline.map((b) => b.column),
    );

    await kitPage.close();
  });

  test('mobile: block outline (order) matches the DS kit (T373)', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Mobile', role: 'Couple', viewLabel: 'Home' });

    await signInAsCouple(page);
    await page.setViewportSize(MOBILE);
    await page.waitForLoadState('networkidle');

    const kitOutline = dropAlbumBlock(await blockOutline(kitPage, 'div[style*="gap: 14px"]'));
    const appOutline = await blockOutline(page, 'app-home-today .content');

    expect(appOutline.length, 'block count (countdown, day highlights)').toBe(kitOutline.length);

    await kitPage.close();
  });
});
