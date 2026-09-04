import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — `wedding-web` T350, `people`'s slice of
 * T349.
 *
 * `people.scss` carried `height: 100%; overflow-y: auto` on `.people`
 * unconditionally (every breakpoint), while `/people`'s route data
 * (`app.routes.ts`) sets neither `headPinned`/`footPinned` nor
 * `screenScroll`. Under hub ADR-0041 §3 / ADR-0043 §1 that combination is
 * flow: `main` (`private-layout`) is supposed to be the screen's one
 * scroller. Because `:host`/`.people` also forced themselves to exactly
 * fill `main`'s available height, the component's own overflow was clipped
 * to that height and scrolled *internally*, so `main` itself never
 * accumulated any overflow of its own — two scroll containers on one axis,
 * with `.people` winning silently and `main` never scrolling at all. Hub
 * ADR-0042 §Consequences (`people` bullet) and ADR-0041 §Context describe
 * exactly this shape.
 *
 * The fix (T350) drops `.people`'s own `height`/`overflow-y` and `:host`'s
 * `height: 100%`, so nothing below `main` constrains its own height and
 * `main` is left to accumulate the overflow it always claimed to own.
 *
 * Must fail against the commit before T350 and pass after — verified by
 * running this spec against `people.scss` before and after the fix (see
 * `tasks/28-phase-x-layout-layer/reports/T350.json`).
 */
test("main is the screen's only scroller; `.people` no longer nests a second one", async ({
  page,
}) => {
  // Enough rows to overflow every target viewport (320–1280px wide) at a
  // single column (mobile) or a 3–4 column grid (desktop) — no pagination
  // (`pageSize` unset) so the whole list is one response, matching how this
  // screen actually calls `GET /v1/profile` (no "load more" on `/people`).
  await signInAsCouple(page, { guestCount: 60 });
  await page.goto('/people');

  // A real, data-backed card — not the loading skeleton, which renders under
  // the same `.card` class but with no person name in it.
  await expect(page.getByText('Guest0 Fixture0')).toBeVisible();

  const metrics = await page.evaluate(() => {
    const main = document.querySelector('main');
    const people = document.querySelector('.people');
    if (!main || !people) {
      throw new Error('main or .people did not render');
    }
    return {
      mainScrollHeight: main.scrollHeight,
      mainClientHeight: main.clientHeight,
      peopleScrollHeight: people.scrollHeight,
      peopleClientHeight: people.clientHeight,
    };
  });

  // The defect's exact signature: before the fix, `.people` absorbs the
  // overflow internally (its own scrollHeight exceeds its clientHeight)
  // while `main` never does. After the fix `.people` sets no `overflow`, so
  // it establishes no scrolling box of its own and its scrollHeight can
  // never exceed its clientHeight (CSSOM View: an element with no
  // associated scrolling box reports `scrollHeight === clientHeight`).
  expect(metrics.peopleScrollHeight).toBeLessThanOrEqual(metrics.peopleClientHeight + 1);

  // `main` is the one that now accumulates the overflow 60 profile cards
  // produce at every target viewport.
  expect(metrics.mainScrollHeight).toBeGreaterThan(metrics.mainClientHeight);

  // The clause that matters (T263's own text): without it this spec would
  // pass on a page that never scrolled at all. Scroll `main` — this
  // screen's real scroller — and confirm the list itself actually moves.
  const firstCard = page.locator('.grid .card').first();
  const beforeBox = await firstCard.boundingBox();
  if (!beforeBox) {
    throw new Error('first profile card did not render — nothing to measure');
  }

  const moved = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) throw new Error('main did not render');
    const before = main.scrollTop;
    main.scrollTop = main.scrollHeight;
    return main.scrollTop !== before;
  });
  expect(moved, 'main did not move when scrolled — nothing to prove').toBe(true);

  const afterBox = await firstCard.boundingBox();
  if (!afterBox) {
    throw new Error('first profile card disappeared after scrolling');
  }
  expect(afterBox.y).toBeLessThan(beforeBox.y);
});
