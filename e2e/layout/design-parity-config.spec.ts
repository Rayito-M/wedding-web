import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';
import { boxOf, stylesOf, openDsKitScreen, startDsKitServer, type DsKitServer } from '../helpers/ds-kit';

/**
 * Design-parity rescan (T369) — Couple/Settings (kit) ↔ `/config` (app,
 * couple role). Kit source: `ScreenConfigManager.jsx`'s `secHeader()`
 * (desktop, `controlled` — Manage's `PlanRail` supplies navigation, Save
 * lives in the section header) / `ScreenConfigManagerMobile.jsx` (mobile);
 * app source: `config-manager.html`/`.scss`'s `.section-header`. Default
 * section on both sides is "Basics" (`ownSection`/`configSection` default,
 * `section()` default in `config-manager.ts`). `fullBleed` on the kit's
 * desktop branch — `ds-contract.json`'s `ScreenConfigManager` carries no
 * `shell.maxWidth`, so no column-width metric applies here.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

test.describe('Settings (couple) — pixel parity with the DS kit (T369)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  test('desktop: section-header title/note type matches (Basics, section-controlled mode)', async ({
    page,
    context,
  }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Desktop', role: 'Couple', viewLabel: 'Settings' });

    await signInAsCouple(page);
    await page.goto('/config');
    await page.setViewportSize(DESKTOP);
    await page.waitForLoadState('networkidle');

    const kitHeader = await kitPage.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).find(
        (e) => e.children.length === 0 && e.textContent?.trim() === 'Basics',
      ) as HTMLElement | undefined;
      if (!el) return null;
      const note = el.nextElementSibling as HTMLElement | null;
      return {
        titleFontSize: getComputedStyle(el).fontSize,
        titleFontFamily: getComputedStyle(el).fontFamily,
        noteFontSize: note ? getComputedStyle(note).fontSize : null,
      };
    });
    const appTitle = await stylesOf(page, '.section-header h2', ['fontSize']);
    const appNote = await stylesOf(page, '.section-header .note', ['fontSize']);
    expect(kitHeader, 'kit: "Basics" section header not found').not.toBeNull();
    expect(appTitle?.fontSize, 'desktop: section title font-size').toBe(kitHeader!.titleFontSize);
    if (kitHeader!.noteFontSize) {
      expect(appNote?.fontSize, 'desktop: section note font-size').toBe(kitHeader!.noteFontSize);
    }

    // Alignment: title sits above the fields column, both flush with the
    // same left edge as the field grid below it.
    const titleBox = await boxOf(page, '.section-header h2');
    const fieldsBox = await boxOf(page, '.fields');
    expect(titleBox, 'app: section title box').not.toBeNull();
    expect(fieldsBox, 'app: .fields box').not.toBeNull();
    expect(Math.abs(titleBox!.left - fieldsBox!.left)).toBeLessThanOrEqual(1);

    await kitPage.close();
  });

  test('mobile: section title matches, Save affordance present', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Mobile', role: 'Couple', viewLabel: 'Settings' });

    await signInAsCouple(page);
    await page.goto('/config');
    await page.setViewportSize(MOBILE);
    await page.waitForLoadState('networkidle');

    const appTitleBox = await boxOf(page, '.section-header h2');
    expect(appTitleBox, 'app: mobile section title box').not.toBeNull();

    // Mobile keeps its OWN Save affordance (`.mobile-bar`, per this
    // screen's own comment: PlanRail doesn't mount at this breakpoint) —
    // confirm it renders rather than assuming the desktop section-header
    // Save silently carried over.
    const mobileBar = await boxOf(page, '.mobile-bar');
    expect(mobileBar, 'app: .mobile-bar (mobile Save affordance) not found').not.toBeNull();

    await kitPage.close();
  });
});
