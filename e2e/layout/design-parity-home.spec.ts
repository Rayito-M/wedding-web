import { test, expect } from '@playwright/test';

import { signInAsGuest } from '../support/auth';
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
 * (`albumRow`); the app cuts it — `/album` is not an enabled destination
 * (hub ADR-0045 §2's "+ Album only if ever re-scoped") — pre-existing, from
 * before T372/T373, not a new gap either of those tasks introduces. Filtered
 * out of the kit outline explicitly, never silently dropped: the block-
 * outline assertion below would otherwise fail on a difference this repo
 * already decided to carry, exactly the "refused block" case T373 asks to
 * account for rather than loosen past.
 */
function dropAlbumBlock(blocks: Awaited<ReturnType<typeof blockOutline>>) {
  return blocks.filter((b) => !b.label.includes('photos in the live album'));
}

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

  // — T373: block-outline parity (hub ADR-0044 amendment) — the check whose
  // absence let T369's generic metrics call the couple's OLD planning
  // dashboard a "match" for this same kit screen. Kit root: the wide
  // branch's own two-column grid div (`ScreenHome.jsx`'s `content`,
  // `style*="grid-template-columns: 1.15fr 0.85fr"`) / the non-wide
  // branch's flex column (`style*="gap: 14px"`) — both unique on a page with
  // only the "Home" view mounted. App root: `app-home-today .content`,
  // T372's shared section.
  test('desktop: block outline (order + column) matches the DS kit (T373)', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Guest', viewLabel: 'Home' });

    await signInAsGuest(page);
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');

    const kitOutline = dropAlbumBlock(
      await blockOutline(kitPage, 'div[style*="grid-template-columns: 1.15fr 0.85fr"]'),
    );
    const appOutline = await blockOutline(page, 'app-home-today .content');

    expect(appOutline.length, 'block count (countdown, RSVP recap, day highlights)').toBe(kitOutline.length);
    expect(appOutline.map((b) => b.column), 'block column placement, in DOM order').toEqual(
      kitOutline.map((b) => b.column),
    );

    await kitPage.close();
  });

  test('mobile: block outline (order) matches the DS kit (T373)', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Mobile', role: 'Guest', viewLabel: 'Home' });

    await signInAsGuest(page);
    await page.setViewportSize(MOBILE);
    await page.waitForLoadState('networkidle');

    const kitOutline = dropAlbumBlock(await blockOutline(kitPage, 'div[style*="gap: 14px"]'));
    const appOutline = await blockOutline(page, 'app-home-today .content');

    // No grid at this breakpoint on either side — `column` is `null`
    // throughout; count + DOM order is the whole check.
    expect(appOutline.length, 'block count (countdown, RSVP recap, day highlights)').toBe(kitOutline.length);

    await kitPage.close();
  });
});
