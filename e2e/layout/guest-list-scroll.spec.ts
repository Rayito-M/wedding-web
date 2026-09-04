import { test, expect } from '@playwright/test';

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
 * browser, against `PrivateLayout`'s actual `.screen-scroll`.
 *
 * Must fail against current `main` (no `IntersectionObserver` sentinel, no
 * `ScreenChromeService.scrollResetRequest` channel) and pass with T348's fix
 * — both runs captured in `tasks/28-phase-x-layout-layer/reports/T348.json`.
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

    const rows = page.locator('.table-row');
    await expect(rows).toHaveCount(20);

    // Real user gesture: scroll whichever ancestor of the first row actually
    // owns the scroll — the same pattern `pinned-regions.spec.ts` uses,
    // deliberately not hardcoded to `.screen-scroll` by class name, so this
    // spec keeps testing "the list the user sees scrolls", not one
    // implementation of it.
    await page.evaluate(() => {
      const row = document.querySelector('.table-row');
      let el: HTMLElement | null = row?.parentElement ?? null;
      while (el && el.scrollHeight <= el.clientHeight) {
        el = el.parentElement;
      }
      if (!el) throw new Error('no scrollable ancestor found above .table-row');
      el.scrollTop = el.scrollHeight;
    });

    // The guard clause: without it this spec would pass on a sentinel that
    // never intersected anything.
    await expect(rows).toHaveCount(40);
  });

  test("changing a filter scrolls the list back to the top — ScreenChromeService, not this screen's own element", async ({
    page,
  }) => {
    // One page (default `pageSize`) is enough rows to actually scroll on the
    // narrowest target viewport; pagination is not what this half tests.
    await signInAsCouple(page, { guestCount: 60 });
    await page.goto('/guests');

    const rows = page.locator('.table-row');
    await expect(rows.first()).toBeVisible();

    const scroller = await page.evaluateHandle(() => {
      const row = document.querySelector('.table-row');
      let el: HTMLElement | null = row?.parentElement ?? null;
      while (el && el.scrollHeight <= el.clientHeight) {
        el = el.parentElement;
      }
      if (!el) throw new Error('no scrollable ancestor found above .table-row');
      el.scrollTop = el.scrollHeight;
      return el;
    });

    const scrolledTop = await scroller.evaluate((el: HTMLElement) => el.scrollTop);
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
      .poll(() => scroller.evaluate((el: HTMLElement) => el.scrollTop))
      .toBe(0);
  });
});
