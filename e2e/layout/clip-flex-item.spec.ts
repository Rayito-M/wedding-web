import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — the `min-height: 0` trap (hub ADR-0041
 * §4): a flex item's automatic minimum size is only zero when the item is a
 * scroll container, so `main` under `overflow-y: clip` (deliberately not a
 * scroll container — that is the whole point of ADR-0041 §4) silently grows
 * to fit its content instead of the viewport unless `min-height: 0` is
 * stated explicitly.
 *
 * DEVIATION from the acceptance bullet's literal text (recorded in
 * `tasks/reports/T263.json` `deviations[]`): the bullet reads
 * "assert `main.scrollHeight <= main.clientHeight`", but that comparison is
 * *always* true, in both the broken and fixed CSS, and cannot distinguish
 * them — measured against `9474809^`: `mainScrollHeight: 4097,
 * mainClientHeight: 4097`. This is not a fluke: without `min-height: 0`, the
 * flex algorithm's content-based automatic minimum makes `main`'s own
 * *clientHeight* balloon to match its content — there is never anything left
 * over for `main`'s `scrollHeight` to exceed, because the box grew instead of
 * clipping. The actual defect (T341's commit message: main "grew past the
 * viewport, and the whole layout scrolled as one") shows up one level up: the
 * flex *parent* (`app-private-layout`, fixed to the viewport height) does not
 * grow, so `main` overflows past it into `document`/`body`, which do.
 *
 * **Re-targeted 2026-09-04 (hub ADR-0043, `wedding-web` T352).** This spec
 * originally ran against `/guests` while `headPinned`/`footPinned` still
 * doubled as guest-manager's scroll-ownership flag, making `main` clip
 * there (`overflow-y: clip`, not a scroll container) the same way
 * `/config` does today. ADR-0043 separates the two facts: guest-manager
 * pins a head/foot but owns no scroll container of its own, so its correct
 * route declaration is flow (no `screenScroll`) — `main` is the real
 * scroller there now, `overflow-y: auto`, and its `scrollHeight` (3058px,
 * measured) legitimately exceeds its flex parent's `clientHeight` (720px)
 * because it is actually scrolling, not because it grew past its box. That
 * comparison is therefore the wrong one for `/guests` post-ADR-0043; this
 * spec asserts the invariant that still matters for a **flow** scroller
 * instead — `main.clientHeight` itself never outgrows the space its flex
 * parent gives it, whether or not its *content* (`scrollHeight`) is larger.
 * The `overflow-y: clip` / min-height:0 trap this file exists to guard is
 * unaffected by this re-target and stays covered on a genuinely shell route
 * — `config-manager.spec.ts`'s own second test, `/config`, which still
 * compares `main.scrollHeight` against its flex parent exactly as this file
 * used to, because `main` is still clipped (not scrolling) there.
 *
 * `.table-row` is scoped to `.table-container[role="table"]` (T349,
 * `tasks/28-phase-x-layout-layer/reports/T349.json`): `guest-manager.html`'s
 * `initialLoading()` skeleton renders 8 identically-classed `.table-row`s of
 * its own under a `.table-container` carrying no `role` attribute (only the
 * real, data-backed table carries `role="table"`). Unscoped, this spec's
 * `.toBeVisible()` could resolve against the skeleton under worker
 * contention, measuring 8 placeholder rows instead of the 60 real ones this
 * spec's own `guestCount` exists to guarantee.
 */
test("a flow route's main never outgrows the space its flex parent gives it, even though its content legitimately scrolls past it", async ({
  page,
}) => {
  await signInAsCouple(page, { guestCount: 60 });
  await page.goto('/guests');

  await expect(page.locator('.table-container[role="table"] .table-row').first()).toBeVisible();

  const { mainClientHeight, mainScrollHeight, parentClientHeight } = await page.evaluate(() => {
    const main = document.querySelector('main');
    const parent = document.querySelector('app-private-layout');
    if (!main || !parent) {
      throw new Error('main or its app-private-layout parent did not render');
    }
    return {
      mainClientHeight: main.clientHeight,
      mainScrollHeight: main.scrollHeight,
      parentClientHeight: (parent as HTMLElement).clientHeight,
    };
  });

  // `main`'s own box stays bounded by its flex parent — the actual "does not
  // outgrow its parent" claim.
  expect(mainClientHeight).toBeLessThanOrEqual(parentClientHeight);
  // The guard clause: without it this spec would pass on a `main` that
  // never had anything to scroll in the first place, proving nothing.
  expect(mainScrollHeight).toBeGreaterThan(mainClientHeight);
});
