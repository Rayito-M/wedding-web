import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';
import { boxOf, stylesOf, openDsKitScreen, startDsKitServer, type DsKitServer } from '../helpers/ds-kit';

/**
 * Design-parity rescan (T369) — Couple/Milestones (kit) ↔ `/milestones`
 * (app, couple role). Kit source: `ScreenMilestones.jsx` (desktop) /
 * `ScreenMilestonesMobile.jsx` (mobile, separate component); app source:
 * `milestones.html`/`.scss`. Both kit components start with an EMPTY
 * `items` array (`React.useState([])`) — clicking "Start from the usual
 * plan" loads `window.WEDDING_MILESTONES`, mirroring the app's own mock
 * (`api-mocks.ts`'s `milestoneItems(3)`, pre-existing). `fullBleed` on
 * both kit branches — `ds-contract.json`'s `ScreenMilestones` carries no
 * `shell.maxWidth`, so no column-width metric applies here.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.describe('Milestones (couple) — pixel parity with the DS kit (T369)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  for (const [breakpoint, viewport, device, titleSize, hasCounters] of [
    ['desktop', DESKTOP, 'Desktop', '26px', true],
    ['mobile', MOBILE, 'Mobile', '22px', false],
  ] as const) {
    test(`${breakpoint}: header title size${hasCounters ? ' and counter type' : ''} match`, async ({
      page,
      context,
    }) => {
      const kitPage = await context.newPage();
      await openDsKitScreen(kitPage, kit.baseUrl, { device, role: 'Couple', viewLabel: 'Milestones' });
      // Both kit components start with an empty timeline — load the seed
      // data so the header counters (gated on `items.length > 0`) render.
      await kitPage.getByRole('button', { name: /Start from the usual plan/i }).click();

      await signInAsCouple(page);
      await page.goto('/milestones');
      await page.setViewportSize(viewport);
      await page.waitForLoadState('networkidle');

      const kitTitle = await kitPage.evaluate(() => {
        const el = Array.from(document.querySelectorAll('div')).find(
          (e) => e.children.length === 0 && e.textContent?.trim() === 'Milestones',
        ) as HTMLElement | undefined;
        return el ? getComputedStyle(el).fontSize : null;
      });
      const appTitle = await stylesOf(page, '.header-text', ['fontSize']);
      expect(kitTitle, 'kit: "Milestones" title not found').toBe(titleSize);
      expect(appTitle?.fontSize, `${breakpoint}: header title font-size`).toBe(kitTitle);

      // Counter: kit's "Reached" count (accent-colored) — desktop only. The
      // kit's MOBILE component replaces the value+label counters with plain
      // filter chips ("To do"/"Reached"/"All", `ScreenMilestonesMobile.jsx`
      // L57) while the app keeps rendering `.counter`/`.counter-value` at
      // every breakpoint (one shared template) — a structural difference
      // noted here, not asserted (there is no kit counter to compare on
      // mobile).
      if (hasCounters) {
        const kitCounter = await kitPage.evaluate(() => {
          const el = Array.from(document.querySelectorAll('div')).find(
            (e) => e.children.length === 0 && e.textContent?.trim() === 'Reached',
          ) as HTMLElement | undefined;
          const valueEl = el?.previousElementSibling as HTMLElement | undefined;
          return valueEl
            ? { fontSize: getComputedStyle(valueEl).fontSize, color: getComputedStyle(valueEl).color }
            : null;
        });
        const appCounter = await stylesOf(page, '.counter.reached .counter-value', ['fontSize', 'color']);
        expect(kitCounter, 'kit: "Reached" counter not found').not.toBeNull();
        expect(appCounter, 'app: .counter.reached .counter-value not found').not.toBeNull();
        expect(appCounter!.fontSize, `${breakpoint}: reached counter font-size`).toBe(kitCounter!.fontSize);
        expect(appCounter!.color, `${breakpoint}: reached counter accent color`).toBe(kitCounter!.color);
      }

      // Header alignment sanity: title box exists and sits above the list.
      const titleBox = await boxOf(page, '.header-text');
      const listBox = await boxOf(page, '.layout');
      expect(titleBox, 'app: header title box').not.toBeNull();
      expect(listBox, 'app: .layout box').not.toBeNull();
      expect(titleBox!.top).toBeLessThan(listBox!.top);

      await kitPage.close();
    });
  }
});
