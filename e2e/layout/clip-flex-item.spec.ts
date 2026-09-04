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
 * grow, so `main` overflows past it into `document`/`body`, which do. This
 * spec instead compares `main.scrollHeight` against its flex parent's
 * `clientHeight` — the space `main` was actually given — which is what "does
 * not outgrow its parent" (the bullet's own title) means literally. Confirmed
 * against `9474809^`: fails (`4097 > 568`); against `9474809`: passes
 * (`329 <= 568`).
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
test("a pinned route's main never outgrows the space its flex parent gives it", async ({
  page,
}) => {
  await signInAsCouple(page, { guestCount: 60 });
  await page.goto('/guests');

  await expect(page.locator('.table-container[role="table"] .table-row').first()).toBeVisible();

  const { mainScrollHeight, parentClientHeight } = await page.evaluate(() => {
    const main = document.querySelector('main');
    const parent = document.querySelector('app-private-layout');
    if (!main || !parent) {
      throw new Error('main or its app-private-layout parent did not render');
    }
    return {
      mainScrollHeight: main.scrollHeight,
      parentClientHeight: (parent as HTMLElement).clientHeight,
    };
  });

  expect(mainScrollHeight).toBeLessThanOrEqual(parentClientHeight);
});
