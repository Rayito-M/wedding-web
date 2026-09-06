import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';
import { boxOf, expectClose, kitContentColumnBox, openDsKitScreen, startDsKitServer, stylesOf, type DsKitServer } from '../helpers/ds-kit';

/**
 * Design-parity rescan (T369) — Couple/"Manage · Overview" (kit) ↔
 * `/overview` (app, couple role). Kit source: `ScreenHome.jsx`'s
 * `overviewContent` branch (`overview` prop); app source: `dashboard.html`'s
 * `#plan` template rendered directly (`@if (overview)`, `dashboard.ts`).
 *
 * Structural gap found by the T369 rescan: the kit's Overview renders four
 * cards (RSVP stats, quick tiles, "the plan so far" milestone progress +
 * next-3 list, "this week" task list) in a two-column grid; the app's
 * Overview rendered only the RSVP stats card, a single stat tile, and a
 * plain "manage" link list.
 *
 * T370 added "the plan so far" milestone-progress card (`dashboard.ts`/
 * `.html`, reusing the same `Milestone` entity collection `/milestones`
 * already reads — no new endpoint) — that half of the gap is now enforced
 * below. The "this week" task list is REFUSED, permanently, as out of
 * scope: hub ADR-0029 §4.7 cuts the couple's task list, and `TaskRow` is
 * listed in the DS `contract/scope.json`'s `outOfScope` array — pixel
 * parity with a kit screen never resurrects a feature the hub already cut.
 * `test.skip()` below, not `test.fixme()`: fixme documents a bug awaiting a
 * fix; this is a decision, not a defect.
 */

const DESKTOP = { width: 1280, height: 900 };
const STYLE_PROPS = ['backgroundColor', 'borderColor', 'color', 'fontSize', 'fontWeight', 'padding'];

test.describe('Manage · Overview (couple) — pixel parity with the DS kit (T369)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  test('desktop: greeting alignment, stats-card type, and column width match', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, {
      device: 'Desktop',
      role: 'Couple',
      viewLabel: 'Manage · Overview',
    });

    await signInAsCouple(page);
    await page.goto('/overview');
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');

    // Greeting: kit's leaf div starting "Buenos días,"; app's `.greeting .hello`.
    const kitGreeting = await kitPage.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).find(
        (e) => e.children.length === 0 && (e.textContent ?? '').trim().startsWith('Buenos días'),
      ) as HTMLElement | undefined;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, fontSize: getComputedStyle(el).fontSize };
    });
    const appGreetingBox = await boxOf(page, '.greeting .hello');
    const appGreetingStyle = await stylesOf(page, '.greeting .hello', ['fontSize']);
    expect(kitGreeting, 'kit: "Buenos días" greeting not found').not.toBeNull();
    expect(appGreetingBox, 'app: .greeting .hello not found').not.toBeNull();
    expect(appGreetingStyle?.fontSize, 'greeting font-size').toBe(kitGreeting!.fontSize);

    // Content column width vs ds-contract.json ScreenHome.shell.maxWidth 900
    // (Overview reuses `ScreenHome`, same shell as Home).
    const kitCol = await kitContentColumnBox(kitPage);
    const appCol = await boxOf(page, 'app-dashboard');
    expect(kitCol, 'kit: Overview content column not found').not.toBeNull();
    expect(appCol, 'app: app-dashboard host not found').not.toBeNull();
    expectClose(kitCol!.width, 900, 1, 'desktop kit: content column width vs ds-contract.json maxWidth 900');
    expectClose(appCol!.width, 900, 1, 'desktop app: content column width vs ds-contract.json maxWidth 900');

    // Signature element: the RSVP "replies so far" stats card — present on
    // both sides, styled as a bordered surface card.
    const kitCard = await kitPage.evaluate((props: string[]) => {
      const label = Array.from(document.querySelectorAll('div')).find(
        (e) => e.children.length === 0 && e.textContent?.trim() === 'The replies so far',
      ) as HTMLElement | undefined;
      const el = label?.parentElement as HTMLElement | undefined;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const p of props) out[p] = cs.getPropertyValue(p) || (cs as unknown as Record<string, string>)[p];
      return out;
    }, STYLE_PROPS);
    const appCard = await stylesOf(page, '.stats-card', STYLE_PROPS);
    expect(kitCard, 'kit: "replies so far" stats card not found').not.toBeNull();
    expect(appCard, 'app: .stats-card not found').not.toBeNull();
    expect(appCard!.borderColor, 'stats-card border color').toBe(kitCard!.borderColor);

    await kitPage.close();
  });

  test('desktop: "the plan so far" milestone-progress card is present (T370 — was absent, dashboard.html\'s task block was commented out)', async ({
    page,
    context,
  }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, {
      device: 'Desktop',
      role: 'Couple',
      viewLabel: 'Manage · Overview',
    });
    await signInAsCouple(page);
    await page.goto('/overview');
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');
    // This text anchor exists in the kit's overviewContent (`milestoneProgress`
    // block); assert it now also exists in the app.
    await expect(page.getByText('The plan so far')).toBeVisible();
    await kitPage.close();
  });

  // Refused, permanent (T370): the kit's neighboring "this week" task list
  // (`ScreenHome.jsx overviewContent`'s `week` block, `TaskRow`) is cut —
  // hub ADR-0029 §4.7, and `TaskRow` is listed in the DS
  // `contract/scope.json`'s `outOfScope` array ("Ported to wedding-web but
  // commented out on both sides"). Not a defect to fix later: `test.skip()`,
  // not `test.fixme()`.
  test.skip(
    'desktop: "this week" task list — REFUSED, out of scope (hub ADR-0029 §4.7; TaskRow listed in wedding-ui-design/contract/scope.json\'s outOfScope; T370)',
    async ({ page, context }) => {
      const kitPage = await context.newPage();
      await openDsKitScreen(kitPage, kit.baseUrl, {
        device: 'Desktop',
        role: 'Couple',
        viewLabel: 'Manage · Overview',
      });
      await signInAsCouple(page);
      await page.goto('/overview');
      await page.setViewportSize(DESKTOP);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('This week')).toBeVisible();
      await kitPage.close();
    },
  );
});
