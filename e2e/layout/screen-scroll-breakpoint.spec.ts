import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — `wedding-web` T352, hub ADR-0043's own
 * worked case: `screenScroll: 'lg'` must yield `main` to `.screen-scroll` at
 * `$bp-lg` (900px) and must **not** below it. This is "the case that had no
 * expressible answer before this ADR" (ADR-0043 §3) — the one route flag
 * that is genuinely per-breakpoint rather than route-static.
 *
 * **No live route sets `screenScroll: 'lg'` yet.** `milestones` is the
 * screen ADR-0043 §5 names for it, and T343 has not migrated it — that is a
 * separate, later task, blocked on this one landing first. Proving this
 * class of defect honestly without a live consumer therefore has two halves,
 * deliberately split across two test tiers rather than faked into one:
 *
 * 1. **`screen-chrome.spec.ts` (Vitest)** proves `PrivateLayout` computes
 *    exactly `screen-scrolls-lg` on `main`/`.screen-scroll` from
 *    `{ screenScroll: 'lg' }` route data, and no other breakpoint's class —
 *    a template/class-binding fact, not a CSS fact.
 * 2. **This spec** proves the CSS half — that `.screen-scrolls-lg`'s
 *    declarations in `private-layout.scss` are actually gated by a real
 *    `@media (min-width: 900px)` evaluation in a real browser, on both sides
 *    of the boundary. It does this by applying the same class strings
 *    `PrivateLayout` would compute directly onto `/schedule`'s real, already
 *    Angular-rendered `<main>` / `.screen-scroll` (`schedule` is in
 *    `environment.enabledRoutes`, declares no `headPinned`/`footPinned`/
 *    `screenScroll` of its own, and `schedule.scss` carries no `:host`
 *    height/overflow of its own either — a clean flow screen, so nothing
 *    else on the page competes for scroll ownership). Because these are the
 *    *same* DOM nodes Angular's own template already rendered, they already
 *    carry the emulated-encapsulation attribute `private-layout.scss`'s
 *    compiled selectors require — a class added by hand from outside
 *    Angular is invisible to it, but the compiled stylesheet cannot tell the
 *    difference. Angular's own `[class.screen-scrolls-lg]` binding for
 *    `/schedule` computes `false` on every change-detection pass (its route
 *    never sets `screenScroll`), and Angular only ever *writes* a bound
 *    class when the computed value changes relative to its own last-written
 *    value — so it never touches (and never removes) the class this spec
 *    adds by hand.
 *
 * A synthetic 3000px sentinel is appended into `.screen-scroll` so there is
 * always enough content to actually overflow at both viewport heights this
 * spec uses — the assertions below measure real `scrollTop` movement, not a
 * computed-style string, i.e. actual scroll ownership, not a class name.
 */
test("screenScroll: 'lg' yields main to .screen-scroll at >=900px and not below it (hub ADR-0043)", async ({
  page,
}) => {
  await signInAsCouple(page);
  await page.goto('/schedule');
  await expect(page.locator('main')).toBeVisible();

  await page.evaluate(() => {
    const main = document.querySelector('main');
    const screenScroll = document.querySelector('.screen-scroll');
    if (!main || !screenScroll) {
      throw new Error('main/.screen-scroll did not render');
    }
    main.classList.add('screen-scrolls-lg');
    screenScroll.classList.add('screen-scrolls-lg');

    const sentinel = document.createElement('div');
    sentinel.setAttribute('data-testid', 'lg-sentinel');
    sentinel.style.height = '3000px';
    // Below `$bp-lg`, `.screen-scroll` is `display: contents`, so this
    // sentinel becomes a direct flex item of `main` itself (`flex-direction:
    // column`) rather than a block child — flex items shrink to fit by
    // default, which would silently defeat the whole point of a sentinel
    // meant to force overflow.
    sentinel.style.flexShrink = '0';
    screenScroll.appendChild(sentinel);
  });

  async function scrollBoth(): Promise<{ mainScrollTop: number; screenScrollScrollTop: number }> {
    return page.evaluate(() => {
      const main = document.querySelector('main') as HTMLElement;
      const screenScroll = document.querySelector('.screen-scroll') as HTMLElement;
      main.scrollTop = 0;
      screenScroll.scrollTop = 0;
      main.scrollTop = 500;
      screenScroll.scrollTop = 500;
      return { mainScrollTop: main.scrollTop, screenScrollScrollTop: screenScroll.scrollTop };
    });
  }

  // Below $bp-lg (900px, `_layout.scss`): flow — `respond-to('lg')` does not
  // match, so `.screen-scroll` stays `display: contents` (cannot scroll —
  // it has no box) and `main` keeps its unconditional `overflow-y: auto`.
  await page.setViewportSize({ width: 800, height: 700 });
  const below = await scrollBoth();
  expect(below.mainScrollTop).toBeGreaterThan(0);
  expect(below.screenScrollScrollTop).toBe(0);

  // At $bp-lg and above: shell — `respond-to('lg')` matches, so
  // `.screen-scroll` becomes the real scroller and `main` yields
  // (`overflow-y: clip`, not a scroll container — ADR-0041 §4).
  await page.setViewportSize({ width: 1024, height: 700 });
  const above = await scrollBoth();
  expect(above.mainScrollTop).toBe(0);
  expect(above.screenScrollScrollTop).toBeGreaterThan(0);
});
