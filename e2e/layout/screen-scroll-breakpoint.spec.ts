import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — `wedding-web` T352 built the per-breakpoint
 * yield this spec exercises; `wedding-web` T358 (hub ADR-0043 §4a) changed
 * what the *correct* outcome is once `main` yields, and this spec is
 * re-targeted to match rather than deleted or weakened — the mechanism it
 * exists to prove (the per-breakpoint path) is unchanged, only the shape of
 * `.screen-scroll` once `main` yields to it.
 *
 * **RE-TARGETED 2026-09-04 (hub ADR-0043 §4a, `wedding-web` T358).** This
 * spec originally appended a 3000px sentinel into `.screen-scroll`, set
 * `screenScroll.scrollTop = 500` at `>=900px` and asserted the value stuck —
 * i.e. it asserted `.screen-scroll` *scrolls*. Under §4a that model is
 * false by design: `screenScroll` does not mean "the layout scrolls for
 * me", it means "`main` yields, so I can bound myself and own my
 * scrolling". `.screen-scroll` becomes a bounded **clipping** box in every
 * variant — `display: block; flex: 1; min-height: 0; overflow: clip` — and
 * never gains `overflow-y: auto`. Reused rather than dropped: the sentinel
 * and the two-viewport structure still prove the per-breakpoint mechanism;
 * only what "yielded" means at `>=900px` changed, from "the layout scrolls"
 * to "`main` is not a scroll container **and** `.screen-scroll` clips rather
 * than scrolls". Same shape T352 used to re-target `clip-flex-item.spec.ts`
 * (`tasks/28-phase-x-layout-layer/reports/T352.json`).
 *
 * **No live route sets `screenScroll: 'lg'` yet.** `milestones` is the
 * screen ADR-0043 §5 names for it, and T343 has not migrated it — that is a
 * separate, later task. Proving this class of defect honestly without a
 * live consumer therefore has two halves, deliberately split across two
 * test tiers rather than faked into one:
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
 * A synthetic 3000px sentinel is still appended into `.screen-scroll` so
 * there is always enough content to actually overflow at both viewport
 * heights this spec uses — proving `.screen-scroll` clips real overflow
 * rather than merely having none to clip.
 */
test("screenScroll: 'lg' yields main to .screen-scroll at >=900px and not below it, and .screen-scroll clips rather than scrolls (hub ADR-0043 §4a)", async ({
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

  async function measure(): Promise<{
    mainDisplay: string;
    mainOverflowY: string;
    mainScrollTopAfterWrite: number;
    screenScrollDisplay: string;
    screenScrollOverflowY: string;
    screenScrollScrollTopAfterWrite: number;
  }> {
    return page.evaluate(() => {
      const main = document.querySelector('main') as HTMLElement;
      const screenScroll = document.querySelector('.screen-scroll') as HTMLElement;
      main.scrollTop = 0;
      screenScroll.scrollTop = 0;
      main.scrollTop = 500;
      screenScroll.scrollTop = 500;
      const mainStyle = getComputedStyle(main);
      const screenScrollStyle = getComputedStyle(screenScroll);
      return {
        mainDisplay: mainStyle.display,
        mainOverflowY: mainStyle.overflowY,
        mainScrollTopAfterWrite: main.scrollTop,
        screenScrollDisplay: screenScrollStyle.display,
        screenScrollOverflowY: screenScrollStyle.overflowY,
        screenScrollScrollTopAfterWrite: screenScroll.scrollTop,
      };
    });
  }

  // Below $bp-lg (900px, `_layout.scss`): flow — `respond-to('lg')` does not
  // match, so `.screen-scroll` stays `display: contents` (no box, cannot be
  // a scroll container at all) and `main` keeps its unconditional
  // `overflow-y: auto` — it is the real, single scroller.
  await page.setViewportSize({ width: 800, height: 700 });
  const below = await measure();
  expect(below.mainOverflowY).toBe('auto');
  expect(below.mainScrollTopAfterWrite).toBeGreaterThan(0);
  expect(below.screenScrollDisplay).toBe('contents');

  // At $bp-lg and above: `main` yields — it is not a scroll container
  // (`overflow-y: clip`, ADR-0041 §4) — and `.screen-scroll` becomes a real,
  // bounded box that **clips** the sentinel rather than scrolling it (hub
  // ADR-0043 §4a): `overflow-y` reads `clip`, not `auto`, and writing
  // `scrollTop` on it is a no-op precisely because it establishes no
  // scrolling box for the UA to move.
  await page.setViewportSize({ width: 1024, height: 700 });
  const above = await measure();
  expect(above.mainOverflowY).toBe('clip');
  expect(above.mainScrollTopAfterWrite).toBe(0);
  expect(above.screenScrollDisplay).toBe('block');
  expect(above.screenScrollOverflowY).toBe('clip');
  expect(above.screenScrollScrollTopAfterWrite).toBe(0);
});
