import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAsGuest } from '../support/auth';
import { openDsKitScreen, startDsKitServer, type DsKitServer } from '../helpers/ds-kit';

/**
 * Design-system pixel-parity harness (T368, owner-reported) — the process
 * half of the fix, and the template future screen-parity specs reuse
 * (`e2e/helpers/ds-kit.ts` carries the kit-serving/toggle-driving half;
 * this file carries the metric extraction and assertions specific to
 * Home's umbrella pill row).
 *
 * The owner's side-by-side screenshots showed three measured divergences
 * from the DS's own `ui_kits/wedding-app/AppShell.jsx` (L40-82, the
 * authoritative numbers — read the source, not a paraphrase of it):
 * alignment (the pill row must sit flush with the greeting/h1 below it),
 * vertical rhythm (header -> 26px -> row -> 18px -> greeting, desktop;
 * header -> 10px -> row -> 4px -> greeting, mobile), and the pill's own
 * colors/type (unselected: `var(--surface)` fill, hairline border, `12px`
 * desktop / `11px` mobile, weight 500; selected: `var(--accent)` fill,
 * transparent border).
 *
 * Metric-based, not a raw-pixel screenshot diff, so it is robust to
 * anti-aliasing and to the kit's frame (1200x760/400x780) and the app's
 * real viewport being different sizes — every metric below is either a
 * *relative* delta (alignment, the two gaps) or a *computed-style* value
 * (colors, font metrics), never an absolute on-screen coordinate compared
 * across the two pages.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

interface PillStyle {
  background: string;
  borderColor: string;
  fontSize: string;
  fontWeight: string;
  padding: string;
}

interface HomeSubnavMetrics {
  /** The boundary content clears the fixed/normal-flow header from — see
   *  each measurer for what element stands in for it and why. */
  contentTop: number;
  /** The rendered edges of the FIRST (selected) pill button itself — never
   *  the row container's own box. `getBoundingClientRect()` reports an
   *  element's own border-box position, which a padding change on that
   *  same element never moves (padding shifts where its *content* sits
   *  inside the box, not where the box itself starts) — verified while
   *  building this spec: measuring the row container gave a false "-24px"
   *  alignment failure and a false "0px" row-to-greeting gap purely from
   *  that mismatch, with no real defect involved. The pill button's own
   *  rect is downstream of every ancestor's padding (the row's, and — for
   *  the DS kit's desktop branch — the outer content column's), so it is
   *  the one element that reads correctly regardless of which box the
   *  padding actually lives on. */
  pillTop: number;
  pillBottom: number;
  pillLeft: number;
  greetingTop: number;
  greetingLeft: number;
  selected: PillStyle;
  unselected: PillStyle;
}

/**
 * Measures the DS kit's own Home screen (guest role, `active: 'home'` —
 * the default on load, so "Today" is the selected pill and "Getting there"
 * is unselected).
 *
 * `contentTop` is `AppHeader`'s own real bottom edge: unlike the app,
 * the kit's header is normal-flow, not `position: fixed`, so its rendered
 * bottom edge *is* the boundary the row's own top padding measures from —
 * no separate clearance mechanism to account for. `AppShell.jsx`'s own
 * structure (L40-82) puts `AppHeader` as the shell's first child when
 * `wide`; the non-wide branch prepends a 32px status-bar mock (the "9:41"
 * row) the real app has no equivalent of, so there `AppHeader` is the
 * second child instead.
 */
async function measureKitHomeSubnav(kitPage: Page, wide: boolean): Promise<HomeSubnavMetrics> {
  return kitPage.evaluate((wide) => {
    const host = document.querySelector('[data-overlay-host]');
    if (!host) throw new Error('DS kit: AppShell root ([data-overlay-host]) not found');
    const header = (wide ? host.children[0] : host.children[1]) as HTMLElement | undefined;
    if (!header) throw new Error('DS kit: AppHeader element not found');

    const buttons = Array.from(document.querySelectorAll('button'));
    const selectedBtn = buttons.find((b) => b.textContent?.trim() === 'Today');
    const unselectedBtn = buttons.find((b) => b.textContent?.trim() === 'Getting there');
    if (!selectedBtn || !unselectedBtn) throw new Error('DS kit: Home subnav pills not found');

    // The greeting's first line ("Hola, {name}.") is a bare leaf `<div>`,
    // identical text regardless of the kit's own `lang` toggle
    // (`ScreenHome.jsx`'s `greeting` is defined once, hardcoded, and reused
    // by both the wide and non-wide branches) — stable across both
    // breakpoints without depending on which DOM shape wraps it (the wide
    // branch renders it bare; the non-wide branch wraps it in an extra
    // padded container `ScreenHome.jsx` does not give a class to).
    const greetingLine = Array.from(document.querySelectorAll('div')).find(
      (el) => el.children.length === 0 && (el.textContent ?? '').trim().startsWith('Hola,'),
    ) as HTMLElement | undefined;
    if (!greetingLine) throw new Error('DS kit: greeting line not found');

    const style = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        borderColor: cs.borderColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        padding: cs.padding,
      };
    };

    const headerRect = header.getBoundingClientRect();
    const pillRect = selectedBtn.getBoundingClientRect();
    const greetingRect = greetingLine.getBoundingClientRect();

    return {
      contentTop: headerRect.bottom,
      pillTop: pillRect.top,
      pillBottom: pillRect.bottom,
      pillLeft: pillRect.left,
      greetingTop: greetingRect.top,
      greetingLeft: greetingRect.left,
      selected: style(selectedBtn),
      unselected: style(unselectedBtn),
    };
  }, wide);
}

/**
 * Measures the app's own Home umbrella (`/me`, guest role, default
 * "today" section — `app-home-subnav`'s first pill selected).
 *
 * `contentTop` is the ONE element that embodies "cleared the fixed
 * header" at each breakpoint by construction (hub ADR-0043 §1, T367):
 * `.body` at ≥900px (`private-layout.scss`'s own comment: "the ONE fixed
 * header clearance at ≥900px"), `main` below it (its own unconditional
 * `margin-top: 52px`). Deliberately NOT the real `.header header` element
 * itself: that clearance is calibrated as one shared constant covering
 * both roles' real (slightly different) header heights (T367's own
 * measured 57px guest / 59px couple, both cleared by one 59px number) —
 * comparing against the header's own real height would fail this guard on
 * an unrelated, already-accepted few-pixel slack that has nothing to do
 * with this row's own spacing.
 */
async function measureAppHomeSubnav(page: Page, wide: boolean): Promise<HomeSubnavMetrics> {
  return page.evaluate((wide) => {
    const contentTopEl = document.querySelector(wide ? '.body' : 'main') as HTMLElement | null;
    const selectedBtn = document.querySelector('app-home-subnav .pill.on') as HTMLElement | null;
    const unselectedBtn = document.querySelector(
      'app-home-subnav .pill:not(.on)',
    ) as HTMLElement | null;
    const greetingLine = document.querySelector('.greeting .hello') as HTMLElement | null;
    if (!contentTopEl || !selectedBtn || !unselectedBtn || !greetingLine) {
      throw new Error('App: Home subnav elements not found');
    }

    const style = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        borderColor: cs.borderColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        padding: cs.padding,
      };
    };

    const pillRect = selectedBtn.getBoundingClientRect();
    const greetingRect = greetingLine.getBoundingClientRect();

    return {
      contentTop: contentTopEl.getBoundingClientRect().top,
      pillTop: pillRect.top,
      pillBottom: pillRect.bottom,
      pillLeft: pillRect.left,
      greetingTop: greetingRect.top,
      greetingLeft: greetingRect.left,
      selected: style(selectedBtn),
      unselected: style(unselectedBtn),
    };
  }, wide);
}

function expectClose(actual: number, expected: number, tolerance: number, label: string): void {
  expect(actual, `${label}: expected ${expected} ±${tolerance}, got ${actual}`).toBeGreaterThanOrEqual(
    expected - tolerance,
  );
  expect(actual, `${label}: expected ${expected} ±${tolerance}, got ${actual}`).toBeLessThanOrEqual(
    expected + tolerance,
  );
}

async function assertParity(
  kitPage: Page,
  appPage: Page,
  wide: boolean,
  breakpoint: 'desktop' | 'mobile',
): Promise<void> {
  const kit = await measureKitHomeSubnav(kitPage, wide);
  const app = await measureAppHomeSubnav(appPage, wide);

  // 1. Alignment — the row must be flush with the greeting below it, in
  // BOTH renderings independently (the two pages have different frame/
  // viewport widths, so their absolute `left` coordinates are not
  // comparable to each other — only each page's own internal delta is).
  expectClose(kit.pillLeft - kit.greetingLeft, 0, 1, `${breakpoint} kit: pill row not flush with greeting`);
  expectClose(app.pillLeft - app.greetingLeft, 0, 1, `${breakpoint} app: pill row not flush with greeting`);

  // 2. Vertical rhythm — header -> gap -> row -> gap -> greeting. These
  // ARE comparable in absolute px across the two pages: both are built
  // from the same DS token values, so the app must match the kit's own
  // measured gap, not a number hand-copied into this spec.
  const kitHeaderGap = kit.pillTop - kit.contentTop;
  const appHeaderGap = app.pillTop - app.contentTop;
  expectClose(appHeaderGap, kitHeaderGap, 1, `${breakpoint}: header-to-pill-row gap`);

  const kitGreetingGap = kit.greetingTop - kit.pillBottom;
  const appGreetingGap = app.greetingTop - app.pillBottom;
  expectClose(appGreetingGap, kitGreetingGap, 1, `${breakpoint}: pill-row-to-greeting gap`);

  // 3. Pill colors/type — exact computed-style equality, not a tolerance.
  expect(app.unselected.background, `${breakpoint}: unselected pill background`).toBe(
    kit.unselected.background,
  );
  expect(app.unselected.borderColor, `${breakpoint}: unselected pill border`).toBe(
    kit.unselected.borderColor,
  );
  expect(app.unselected.fontWeight, `${breakpoint}: unselected pill font-weight`).toBe(
    kit.unselected.fontWeight,
  );
  expect(app.selected.background, `${breakpoint}: selected pill background`).toBe(kit.selected.background);
  expect(app.selected.borderColor, `${breakpoint}: selected pill border`).toBe(kit.selected.borderColor);
  expect(app.selected.fontWeight, `${breakpoint}: selected pill font-weight`).toBe(kit.selected.fontWeight);
  expect(app.unselected.fontSize, `${breakpoint}: unselected pill font-size`).toBe(kit.unselected.fontSize);
  expect(app.selected.fontSize, `${breakpoint}: selected pill font-size`).toBe(kit.selected.fontSize);

  // Padding: exact parity at desktop, where the DS and the app both render
  // the shared `pill-interactive` recipe's `6px 14px`. At mobile the DS
  // shrinks to `5px 11px` (`AppShell.jsx`'s non-wide branch) — neither
  // number sits on the app's spacing token grid, and the app's own
  // `config-manager` mobile pill row already renders the shared recipe's
  // padding uniformly rather than chasing it (`home-subnav.scss`'s own
  // banner comment) — so this is a documented, flagged deviation, not
  // asserted equal here; the app's own value is still checked against
  // what it is meant to be.
  if (wide) {
    expect(app.selected.padding, `${breakpoint}: selected pill padding`).toBe(kit.selected.padding);
    expect(app.unselected.padding, `${breakpoint}: unselected pill padding`).toBe(kit.unselected.padding);
  } else {
    expect(
      app.selected.padding,
      'mobile app pill padding: flagged DS gap (AppShell.jsx 5px 11px has no token) — app intentionally keeps the shared recipe default',
    ).toBe('6px 14px');
  }
}

test.describe('Home umbrella — pixel parity with the DS kit (hub ADR-0045 §4, T368)', () => {
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

    await assertParity(kitPage, page, true, 'desktop');
    await kitPage.close();
  });

  test('mobile: pill row matches the DS kit', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, { device: 'Mobile', role: 'Guest', viewLabel: 'Home' });

    await signInAsGuest(page);
    await page.setViewportSize(MOBILE);
    await page.waitForLoadState('networkidle');

    await assertParity(kitPage, page, false, 'mobile');
    await kitPage.close();
  });
});
