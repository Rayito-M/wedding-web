import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';
import { boxOf, stylesOf, openDsKitScreen, startDsKitServer, type DsKitServer } from '../helpers/ds-kit';

/**
 * Design-parity rescan (T369) — Couple/Guests (kit) ↔ `/guests` (app,
 * couple role). Kit source: `ScreenGuestManager.jsx` (desktop) /
 * `ScreenGuestManagerMobile.jsx` (mobile — a SEPARATE component, not a
 * responsive variant of the desktop one); app source:
 * `guest-manager.html`/`.scss` (one template, CSS-switched). `fullBleed`
 * on both kit branches (Manage's own rail replaces a centered column,
 * hub ADR-0045 §3) — `ds-contract.json`'s `ScreenGuestManager` carries no
 * `shell.maxWidth`, so no column-width metric applies here.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };
const STYLE_PROPS = ['fontSize', 'fontWeight', 'color', 'letterSpacing', 'textTransform'];

test.describe('Guests (couple) — pixel parity with the DS kit (T369)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  test('desktop: header title, stat value, and table-header column type match', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Couple', viewLabel: 'Guests' });

    await signInAsCouple(page);
    await page.goto('/guests');
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');

    // Header title ("Guest manager").
    const kitTitle = await kitPage.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).find(
        (e) => e.children.length === 0 && e.textContent?.trim() === 'Guest manager',
      ) as HTMLElement | undefined;
      return el ? getComputedStyle(el).fontSize : null;
    });
    const appTitle = await stylesOf(page, '.header-text', ['fontSize']);
    expect(kitTitle, 'kit: "Guest manager" title not found').not.toBeNull();
    expect(appTitle?.fontSize, 'desktop: header title font-size').toBe(kitTitle);

    // Stat value ("Attending" count, accent-colored in both).
    const kitStat = await kitPage.evaluate((props: string[]) => {
      const el = Array.from(document.querySelectorAll('div')).find(
        (e) => e.children.length === 0 && e.textContent?.trim() === 'Attending',
      ) as HTMLElement | undefined;
      const valueEl = el?.previousElementSibling as HTMLElement | undefined;
      if (!valueEl) return null;
      const cs = getComputedStyle(valueEl);
      const out: Record<string, string> = {};
      for (const p of props) out[p] = cs.getPropertyValue(p) || (cs as unknown as Record<string, string>)[p];
      return out;
    }, STYLE_PROPS);
    const appStat = await stylesOf(page, '.stat-value.accent', STYLE_PROPS);
    expect(kitStat, 'kit: "Attending" stat not found').not.toBeNull();
    expect(appStat, 'app: .stat-value.accent not found').not.toBeNull();
    expect(appStat!.fontSize, 'desktop: stat value font-size').toBe(kitStat!.fontSize);
    expect(appStat!.color, 'desktop: stat value accent color').toBe(kitStat!.color);

    // Table header column label ("Guest").
    const kitCol = await kitPage.evaluate((props: string[]) => {
      const el = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim().startsWith('Guest') && b.textContent?.includes('▲'),
      ) as HTMLElement | undefined;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const p of props) out[p] = cs.getPropertyValue(p) || (cs as unknown as Record<string, string>)[p];
      return out;
    }, STYLE_PROPS);
    const appCol = await stylesOf(page, '.table-header .col-guest .col-sort', STYLE_PROPS);
    expect(kitCol, 'kit: "Guest" column header not found').not.toBeNull();
    expect(appCol, 'app: .table-header .col-guest .col-sort not found').not.toBeNull();
    expect(appCol!.fontSize, 'desktop: table header column font-size').toBe(kitCol!.fontSize);
    expect(appCol!.letterSpacing, 'desktop: table header column letter-spacing').toBe(kitCol!.letterSpacing);
    expect(appCol!.textTransform, 'desktop: table header column text-transform').toBe(kitCol!.textTransform);

    await kitPage.close();
  });

  test('mobile: header/background colors match', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Mobile', role: 'Couple', viewLabel: 'Guests' });

    await signInAsCouple(page);
    await page.goto('/guests');
    await page.setViewportSize(MOBILE);
    await page.waitForLoadState('networkidle');

    const kitHeaderBg = await kitPage.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).find(
        (e) => e.children.length === 0 && e.textContent?.trim() === 'Guest manager',
      )?.parentElement as HTMLElement | undefined;
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    const appHeaderBg = await stylesOf(page, '.header', ['backgroundColor']);
    expect(kitHeaderBg, 'kit: mobile header not found').not.toBeNull();
    expect(appHeaderBg?.backgroundColor, 'mobile: header background').toBe(kitHeaderBg);

    const appTitleBox = await boxOf(page, '.header-text');
    expect(appTitleBox, 'app: mobile header title not found').not.toBeNull();

    await kitPage.close();
  });

  test(
    'mobile: header title font-size — kit ScreenGuestManagerMobile.jsx keeps the SAME 26px title as desktop, app\'s .header-text now matches at every breakpoint (T370 — no 26px type-scale token exists, so guest-manager.scss composes it via calc() from --space-*, flagged in wedding-ui-design/contract/FINDINGS.md)',
    async ({ page, context }) => {
      const kitPage = await context.newPage();
      await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Mobile', role: 'Couple', viewLabel: 'Guests' });
      await signInAsCouple(page);
      await page.goto('/guests');
      await page.setViewportSize(MOBILE);
      await page.waitForLoadState('networkidle');
      const kitTitle = await kitPage.evaluate(() => {
        const el = Array.from(document.querySelectorAll('div')).find(
          (e) => e.children.length === 0 && e.textContent?.trim() === 'Guest manager',
        ) as HTMLElement | undefined;
        return el ? getComputedStyle(el).fontSize : null;
      });
      const appTitle = await stylesOf(page, '.header-text', ['fontSize']);
      expect(appTitle?.fontSize).toBe(kitTitle);
      await kitPage.close();
    },
  );
});
