import { test, expect } from '@playwright/test';

import { signInAsGuest } from '../support/auth';
import {
  blockOutline,
  boxOf,
  expectClose,
  kitContentColumnBox,
  openDsKitScreen,
  startDsKitServer,
  stylesOf,
  type DsKitServer,
} from '../helpers/ds-kit';

/**
 * Design-parity rescan (T369) — Guest/People (kit) ↔ `/people` (app, guest
 * role). Kit source: `ScreenPeople.jsx`; app source: `people.html`/`.scss`.
 * This screen's own comments already track the DS reference closely
 * (`.page` mirrors `AppShell maxWidth={980}`, `.title` 26px→32px at
 * desktop, `.filter-chip` styled from the same padding/font-size/radius as
 * `ScreenPeople.jsx`'s inline `FILTERS` buttons) — this spec measures
 * whether that intent actually landed pixel-for-pixel.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
const STYLE_PROPS = ['backgroundColor', 'borderColor', 'color', 'fontSize', 'fontWeight', 'padding'];

test.describe('People (guest) — pixel parity with the DS kit (T369)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  for (const [breakpoint, viewport, wide, device] of [
    ['desktop', DESKTOP, true, 'Desktop'],
    ['mobile', MOBILE, false, 'Mobile'],
  ] as const) {
    test(`${breakpoint}: header alignment, filter-chip type, and title size match`, async ({ page, context }) => {
      const kitPage = await context.newPage();
      await openDsKitScreen(kitPage, kit.baseUrl, { device, role: 'Guest', viewLabel: 'People' });

      await signInAsGuest(page);
      await page.goto('/people');
      await page.setViewportSize(viewport);
      await page.waitForLoadState('networkidle');

      // Kit: title = leaf span with text "each other" (the accent word inside
      // the "Find each other" heading) — a stable anchor regardless of the
      // surrounding sentence's exact wording. App: `.accent` inside `.title`.
      const kitTitleBox = await kitPage.evaluate(() => {
        const el = Array.from(document.querySelectorAll('span')).find(
          (e) => e.textContent?.trim() === 'each other',
        ) as HTMLElement | undefined;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top, left: r.left };
      });
      const appTitleBox = await boxOf(page, '.title .accent');
      expect(kitTitleBox, 'kit: "each other" title accent not found').not.toBeNull();
      expect(appTitleBox, 'app: .title .accent not found').not.toBeNull();

      // Kit: the first filter chip ("Everyone").
      const kitEveryone = await kitPage.evaluate((props: string[]) => {
        const el = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === 'Everyone',
        ) as HTMLElement | undefined;
        if (!el) return null;
        const cs = getComputedStyle(el);
        const out: Record<string, string> = {};
        for (const p of props) out[p] = cs.getPropertyValue(p) || (cs as unknown as Record<string, string>)[p];
        return out;
      }, STYLE_PROPS);
      const appEveryone = await stylesOf(page, '.filter-chip.on', STYLE_PROPS);

      expect(kitEveryone, 'kit: "Everyone" filter chip not found').not.toBeNull();
      expect(appEveryone, 'app: .filter-chip.on not found').not.toBeNull();
      expect(appEveryone!.fontSize, `${breakpoint}: selected filter chip font-size`).toBe(kitEveryone!.fontSize);
      expect(appEveryone!.padding, `${breakpoint}: selected filter chip padding`).toBe(kitEveryone!.padding);
      expect(appEveryone!.backgroundColor, `${breakpoint}: selected filter chip background`).toBe(
        kitEveryone!.backgroundColor,
      );

      // Column width vs ds-contract.json maxWidth 980 (desktop only — the
      // kit's mobile branch has no maxWidth wrapper, ADR-0045's per-screen
      // shell only applies at the wide breakpoint).
      if (wide) {
        const kitCol = await kitContentColumnBox(kitPage);
        const appCol = await boxOf(page, '.page');
        expect(kitCol, 'kit: People content column not found').not.toBeNull();
        expect(appCol, 'app: .page not found').not.toBeNull();
        expectClose(kitCol!.width, 980, 1, `${breakpoint} kit: content column width vs ds-contract.json maxWidth 980`);
        expectClose(appCol!.width, 980, 1, `${breakpoint} app: content column width vs ds-contract.json maxWidth 980`);
      }

      await kitPage.close();
    });
  }

  // T373: block-outline parity. Kit root: the wide branch's own
  // `maxWidth`/padded content column (`AppShell.jsx`'s
  // `style*="padding: 26px 28px 44px"`); app root: `.page`. Three blocks on
  // both sides: the filter/search controls, the header (eyebrow/title/
  // subtitle), the people grid — `column: null` throughout (`.page` itself
  // is not a CSS grid; only the fixture-card grid nested inside it is, and
  // that grid's own many items are capped out of substitution, see
  // `blockOutline`'s own `MAX_GROUP_SIZE` doc, so it reads as ONE block).
  test('desktop: block outline (order) matches the DS kit (T373)', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Guest', viewLabel: 'People' });

    await signInAsGuest(page);
    await page.goto('/people');
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');

    const kitOutline = await blockOutline(kitPage, 'div[style*="padding: 26px 28px 44px"]');
    const appOutline = await blockOutline(page, '.page');

    expect(appOutline.length, 'block count (controls, header, grid)').toBe(kitOutline.length);
    expect(appOutline.map((b) => b.column), 'block column placement, in reading order').toEqual(
      kitOutline.map((b) => b.column),
    );

    await kitPage.close();
  });
});
