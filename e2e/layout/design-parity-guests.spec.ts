import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';
import { blockOutline, boxOf, stylesOf, openDsKitScreen, startDsKitServer, type DsKitServer } from '../helpers/ds-kit';

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

  // T373: block-outline parity, new deviation surfaced (not fixed here —
  // out of T372/T373's scope, which is Home/Overview; reported per the
  // task's own instruction to `test.fixme()` a new gap on another screen
  // rather than either silently pass it or go fix it here).
  //
  // Kit outline (desktop, root: the screen's own outer flex-column div) —
  // 6 blocks in reading order: [header ("Guest manager" title + stats),
  // filters row, "+ Add guest", table column-header row, the scrollable
  // row list (one block — many guest rows, correctly not exploded per
  // `blockOutline`'s own `MAX_GROUP_SIZE` cap), the list footer.
  //
  // App outline (same viewport, root: `.guest-manager`) — only 3 blocks:
  // [filters row, "+ Add guest", table column-header row]. The header and
  // footer are MISSING from this count because they are pinned chrome
  // (`headPinned`/`footPinned`, `app.routes.ts`'s own `guests` route data)
  // — Angular renders them via `*appScreenHead`/`*appScreenFoot` into
  // `PrivateLayout`'s own `.screen-head`/`.screen-foot`, never inside
  // `.guest-manager`'s own DOM at all (see that route's own comment). The
  // scrollable row list is ALSO absent from this measurement — its own
  // `.table-body` did not resolve to a rendered block at the moment this
  // ran (needs its own investigation: fixture timing, or `.table-body`
  // nested one level deeper than this harness's single-level substitution
  // reaches). None of this is a T372/T373 regression — Guests was
  // untouched by both tasks — it is the block-outline harness catching a
  // real, pre-existing architectural difference (pinned chrome vs the
  // kit's own normal-flow header) that the metrics-only specs above never
  // had a way to see. `T374` (blocked on a cloud pull) is already the
  // task that investigates this screen's sticky/pinned-chrome behaviour.
  test.fixme(
    'desktop: block outline does not yet account for pinned head/foot chrome (found by T373, out of scope here)',
    async ({ page, context }) => {
      const kitPage = await context.newPage();
      await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Couple', viewLabel: 'Guests' });

      await signInAsCouple(page);
      await page.goto('/guests');
      await page.setViewportSize(DESKTOP);
      await page.waitForLoadState('networkidle');

      const kitOutline = await blockOutline(
        kitPage,
        '[data-overlay-host] div[style*="overflow: clip; position: relative"]',
      );
      const appOutline = await blockOutline(page, '.guest-manager');

      expect(appOutline.length, 'block count').toBe(kitOutline.length);

      await kitPage.close();
    },
  );
});
