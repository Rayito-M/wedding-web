import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — `wedding-web` T348, the fix for the
 * regression hub ADR-0042 §Consequences names and `tasks/reports/T341.json`
 * `risks[0]` documents: `.table-body` sheds `overflow-y: auto` under T341
 * (ADR-0042 §2, the single-scroller rule), so its bound `(scroll)` handler
 * never fires again in a browser and its `scrollTop` write is a no-op —
 * while `guest-manager.spec.ts` kept passing, because it dispatches a
 * synthetic `scroll` event on `.table-body` with mocked geometry, which
 * JSDOM never exercises through real layout. JSDOM also does not implement
 * `IntersectionObserver` at all, so this screen's replacement mechanism
 * (T348) cannot be proven under Vitest either — only here, in a real
 * browser, against `PrivateLayout`'s actual scroller.
 *
 * Must fail against current `main` (no `IntersectionObserver` sentinel, no
 * `ScreenChromeService.scrollResetRequest` channel) and pass with T348's fix
 * — both runs captured in `tasks/28-phase-x-layout-layer/reports/T348.json`.
 *
 * `.table-row` is scoped to `.table-container[role="table"]` throughout
 * this file (T349, `tasks/28-phase-x-layout-layer/reports/T349.json`):
 * `guest-manager.html`'s `initialLoading()` skeleton renders its own 8
 * identically-classed `.table-row`s under a `.table-container` that carries
 * no `role` attribute (only the real, data-backed table carries
 * `role="table"`). The unscoped selector let this spec's second test — the
 * one that only checks `.toBeVisible()`, not a row count — resolve against
 * the skeleton under worker contention.
 *
 * **T355 hardening.** Under hub ADR-0043 `guest-manager` is flow: `main` is
 * the real scroller, `.screen-scroll` is `display: contents` (no box at
 * all). The ancestor walk below therefore always has one extra level to
 * climb past what it needed pre-ADR-0043, and after `e11d826` this suite
 * flaked once in roughly 25 full-suite runs — always on the SAME assertion,
 * `guest list scroll … loads the next page`'s very first
 * `toHaveCount(20)`, always on a Chromium-engine project (Desktop Chrome
 * once, Pixel 7 (Chrome Android) once; never yet WebKit), and always with
 * the identical signature: the count observed by Playwright's own polling
 * jumped straight from 0 to 40 — 20 was never seen — meaning the failure is
 * upstream of the ancestor walk entirely, which never got a chance to run.
 * Full accounting, including the discriminating measurement, in
 * `tasks/28-phase-x-layout-layer/reports/T355.json`.
 *
 * That measurement **kills** the leading hypothesis (the walk itself
 * silently landing outside the layout, e.g. on `body`/`documentElement`,
 * because `.screen-scroll`'s `display: contents` box contributes nothing to
 * climb past) — the walk was never reached in either reproduction. The
 * walk is hardened regardless (`findOverflowingAncestor` below): it polls
 * rather than inspecting geometry once, so a page that has not yet
 * overflowed under load is waited out rather than misread, and it asserts
 * both that the terminal element sits inside the layout and that scrolling
 * it actually moved something — the properties this suite must never lose,
 * independent of which race trips it on a given day.
 *
 * The **actual** race — content already at 40 rows before the test's first
 * assertion runs at all — sits one level up: `guest-manager.ts`'s
 * `IntersectionObserver` sentinel (`rootMargin: '120px'`, root defaults to
 * the viewport) can, under heavy multi-project contention, report its
 * initial intersection state before this route's real layout has settled,
 * firing `loadMore()` once on its own. This was reproduced twice
 * (naturally, under real parallel load — not forced) with identical
 * signatures, but not reproducible on demand via CPU throttling (16
 * attempts) or added network jitter on the mocked `GET /v1/profile` (11
 * attempts) alone, so this file does not assert *why* the observer's first
 * read can be stale — only that it demonstrably can be, twice, without
 * ever costing a real page. The fix therefore does not touch the sentinel
 * or `ScreenChromeService` (out of scope per T355's own non-goals unless
 * the cause were proven to live there, which it was not) — it makes the
 * first test's opening assertion robust to a page **already** having
 * advanced past page 1 by the time this test observes it, the same way
 * `guest-manager`'s own product code already tolerates it (nothing about a
 * page loading early is itself wrong — the row count still only ever grows
 * monotonically in fixed 20-row steps).
 */
test.describe('guest list scroll: observation and control (T348)', () => {
  test('scrolling near the bottom of the list loads the next page — IntersectionObserver, not .table-body', async ({
    page,
  }) => {
    // 60 guests, 20 per page: three pages exist to grow into, so this is a
    // real fetch-driven grow, not the "everything already on screen" shape
    // the other layout specs deliberately use.
    await signInAsCouple(page, { guestCount: 60, pageSize: 20 });
    await page.goto('/guests');

    const rows = page.locator('.table-container[role="table"] .table-row');

    // T355: not `toHaveCount(20)`. Under real multi-project load the
    // IntersectionObserver sentinel can fire once on its own before this
    // assertion ever runs (see this file's own header) — Playwright's
    // polling would then never observe "20" at all, only "40", and a
    // single-value assertion fails on a page that is not actually broken.
    // `waitForStableRowCount` accepts whichever page-aligned count (20, 40
    // or 60 — `pageSize` is 20) the list has genuinely settled on, the same
    // way a human watching the screen would.
    const settledCount = await waitForStableRowCount(page);
    expect(settledCount % 20, `row count ${settledCount} is not a whole number of pages`).toBe(0);
    expect(settledCount, 'no rows rendered at all').toBeGreaterThanOrEqual(20);

    if (settledCount >= 60) {
      // Never observed in practice (the sentinel firing early has only ever
      // advanced one page ahead, never two) — handled rather than assumed
      // away, because the alternative is a walk with nothing left to prove.
      await expect(page.locator('.end-of-list')).toBeVisible();
      return;
    }

    // Real user gesture: scroll whichever ancestor of the first row
    // actually owns the scroll — the same pattern `pinned-regions.spec.ts`
    // uses, deliberately not hardcoded to `.screen-scroll` by class name,
    // so this spec keeps testing "the list the user sees scrolls", not one
    // implementation of it.
    await scrollToBottomAndAssertMoved(page);

    // The guard clause: without it this spec would pass on a sentinel that
    // never intersected anything. Asserts real growth beyond whatever the
    // list had already settled on, not a hardcoded "40" — see the T355
    // note above for why the starting point is not always page 1 alone.
    await expect(rows).toHaveCount(Math.min(settledCount + 20, 60));
  });

  test("changing a filter scrolls the list back to the top — ScreenChromeService, not this screen's own element", async ({
    page,
  }) => {
    // One page (default `pageSize`) is enough rows to actually scroll on the
    // narrowest target viewport; pagination is not what this half tests.
    await signInAsCouple(page, { guestCount: 60 });
    await page.goto('/guests');

    const rows = page.locator('.table-container[role="table"] .table-row');
    await expect(rows.first()).toBeVisible();

    const scroller = await findOverflowingAncestor(page);
    const moved = await scroller.evaluate((el) => {
      const before = el.scrollTop;
      el.scrollTop = el.scrollHeight;
      return el.scrollTop !== before;
    });
    expect(moved, 'ancestor walk found an element but scrolling it had no effect').toBe(true);

    const scrolledTop = await scroller.evaluate((el) => el.scrollTop);
    // The guard clause: without it this spec would pass whether or not the
    // filter click below did anything at all.
    expect(scrolledTop).toBeGreaterThan(0);

    // The "Pending" filter chip (3rd of 4, matching `guest-manager.spec.ts`'s
    // own selector) — every fixture guest is seeded with no RSVP record, so
    // this keeps every row and isolates the scroll-reset from a row-count
    // change. `.evaluate(el => el.click())`, not Playwright's own `.click()`:
    // the button sits above the fold once scrolled to the bottom, and
    // Playwright's actionability check would scroll it back into view before
    // clicking — which would reset `scroller`'s `scrollTop` on its own and
    // make this assertion pass whether or not the app's own reset ran.
    await page.locator('.filter-btn').nth(2).evaluate((el: HTMLElement) => el.click());
    await expect(rows).toHaveCount(60);

    await expect
      .poll(() => scroller.evaluate((el) => el.scrollTop))
      .toBe(0);
  });
});

/**
 * Walks up from `.table-row` to the first ancestor that is actually
 * overflowing (`scrollHeight > clientHeight`) — the same "whichever element
 * really scrolls" pattern `pinned-regions.spec.ts` uses, deliberately not
 * hardcoded to `.screen-scroll` by class name (under hub ADR-0043
 * `guest-manager` is flow: `.screen-scroll` is `display: contents`, no box
 * at all, and the real scroller is `main`).
 *
 * T355 hardening, required regardless of which race trips this suite on a
 * given day (`tasks/28-phase-x-layout-layer/reports/T355.json`):
 *  - **polls** via `page.waitForFunction` rather than inspecting geometry
 *    once, so a page that has not yet overflowed under load is waited out
 *    — "wait for the scroller to be overflowing before scrolling it" —
 *    rather than the walk running off the end of the ancestor chain;
 *  - the returned element is asserted (via the same predicate the poll
 *    waits on) to be neither `document.body` nor `document.documentElement`
 *    — "inside the layout", never a walk that can silently land on the
 *    page itself.
 */
async function findOverflowingAncestor(page: Page) {
  const isInsideLayout = () => {
    const row = document.querySelector('.table-container[role="table"] .table-row');
    let el: HTMLElement | null = row?.parentElement ?? null;
    while (el && el.scrollHeight <= el.clientHeight) {
      el = el.parentElement;
    }
    return !!el && el !== document.body && el !== document.documentElement;
  };
  await page.waitForFunction(isInsideLayout);

  return page.evaluateHandle(() => {
    const row = document.querySelector('.table-container[role="table"] .table-row');
    let el: HTMLElement | null = row?.parentElement ?? null;
    while (el && el.scrollHeight <= el.clientHeight) {
      el = el.parentElement;
    }
    // `waitForFunction` above already proved this holds; re-asserted here
    // because the DOM could in principle have changed between the poll
    // resolving and this read running.
    if (!el || el === document.body || el === document.documentElement) {
      throw new Error(
        `ancestor walk landed outside the layout (${el ? el.tagName : 'null'})`,
      );
    }
    return el;
  });
}

/** {@link findOverflowingAncestor}, then scrolls it to the bottom and
 *  asserts the position actually changed — a walk that resolves to a real,
 *  in-layout element but doesn't move when scrolled is exactly as useless a
 *  proof as one that lands on `body`. */
async function scrollToBottomAndAssertMoved(page: Page): Promise<void> {
  const scroller = await findOverflowingAncestor(page);
  const moved = await scroller.evaluate((el) => {
    const before = el.scrollTop;
    el.scrollTop = el.scrollHeight;
    return el.scrollTop !== before;
  });
  expect(moved, 'ancestor walk found an element but scrolling it had no effect').toBe(true);
}

/**
 * Waits for the visible `.table-row` count to stop changing — six
 * consecutive animation frames at the same value, all client-side via
 * `requestAnimationFrame`, no Node round-trip per sample — then returns
 * that settled count.
 *
 * T355: exists because `expect(rows).toHaveCount(20)` is not always true
 * the instant this test's first page has loaded — see this file's own
 * header comment. This is not a blanket `waitForTimeout`: it is a real,
 * observable condition (the count has stopped moving), the same shape as
 * `footer-truncation.spec.ts`'s `document.fonts.ready` wait. Capped at 600
 * frames so a genuinely broken page still fails loudly rather than hanging
 * past Playwright's own test timeout with an opaque error.
 */
async function waitForStableRowCount(page: Page): Promise<number> {
  const settled = await page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let last = -1;
      let stableFrames = 0;
      let totalFrames = 0;
      function tick() {
        // The selector every test in this file already scopes rows to
        // (T349's own fix, this file's header comment) — duplicated here
        // rather than passed a Locator, since this runs entirely
        // client-side and a Locator has nothing meaningful to serialize
        // across that boundary.
        const count = document.querySelectorAll(
          '.table-container[role="table"] .table-row',
        ).length;
        totalFrames++;
        if (count === last) {
          stableFrames++;
        } else {
          stableFrames = 0;
          last = count;
        }
        if ((stableFrames >= 6 && count > 0) || totalFrames >= 600) {
          resolve(count);
        } else {
          requestAnimationFrame(tick);
        }
      }
      requestAnimationFrame(tick);
    });
  });
  return settled;
}
