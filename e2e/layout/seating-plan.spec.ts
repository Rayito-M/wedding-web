import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — `seating-plan`'s slice of T349, landing in
 * the same PR as its T343 migration, the **last** of the four oversized
 * screens.
 *
 * `seating-plan` is classified **shell at every breakpoint** (hub ADR-0043
 * §5, T347's own correction of ADR-0042 §2's worked example, which wrongly
 * named this screen as the per-breakpoint case — that is `milestones`). The
 * route (`app.routes.ts`) declares `screenScroll: true`, unconditionally, so
 * `main` yields to `PrivateLayout`'s own `.screen-scroll` at every width —
 * unlike `milestones`, there is no flow variant to prove here. This screen
 * registers no `*appScreenHead` / `*appScreenFoot`, so no pin flag is set
 * either.
 *
 * Per hub ADR-0043 §4a, `.screen-scroll` never scrolls — it only bounds
 * `:host`'s `height: 100%`. `.unassigned-body` and `.tables` keep their own,
 * independent scrollers throughout, exactly as before this migration: the
 * two-pane split (an unassigned-guest column and a tables grid) is this
 * screen's to own, not the layout's — the same shape `milestones`' `.list`/
 * `.detail-body` already established, applied to a screen that is shell
 * everywhere rather than only above `$bp-lg`.
 *
 * `seating-plan.ts` is a presentational scaffold (T229) with a small,
 * fixed, hardcoded fixture (6 parties, 3 tables) — no `HttpClient` call, so
 * no API mock is needed to reach it, only `signInAsCouple`'s real
 * sign-in. Both panes are seeded with just enough fixture content to
 * overflow at the short viewport heights below; the assertions do not
 * depend on the fixture's exact size, only on it being non-empty.
 *
 * **`/seating` is not reachable through `routeEnabledGuard` in any shipped
 * configuration, found while writing this spec.** `'seating'` is absent
 * from `environment.ts`'s and `environment.prod.ts`'s `enabledRoutes` (both
 * list the same nine paths, neither lists this one) — `tab-bar.ts` filters
 * on the same list, so there is also no nav entry to click either.
 * `routeEnabledGuard` redirects an unreachable path to `/` rather than
 * throwing, so this is silent, not an error a device would surface. This is
 * consistent with `seating-plan.ts`'s own class doc ("explicitly out of
 * AppShell wiring") and enabling it is a product decision this task's scope
 * does not authorize — see `tasks/28-phase-x-layout-layer/reports/T343
 * -seating-plan.json` `decisions_needed[]`. To exercise the real route for
 * this spec's own development and for the fail-first proof below,
 * `environment.ts`'s `enabledRoutes` gained `'seating'` locally for the
 * duration of each test run and was reverted before every commit in this
 * slice — the same run-then-revert shape already used for scratch
 * Playwright specs (T350/T355/T358), applied to a config value instead of a
 * spec file. No shipped file enables this route.
 *
 * **Consequently, every test below self-skips rather than self-fails** if
 * `/seating` is not reachable in whichever build `pnpm test:e2e` is running
 * against (`gotoSeating()` checks `page.url()` after navigating — the guard
 * redirects to `/` on a miss). A hard-fail here would be a permanently red
 * test for a reason no CSS change in this repo can fix, which is worse than
 * no test (the same reasoning T349's own parallel-flake fix gives for why
 * an unreliable suite is worse than none). A skip is loud in the report,
 * costs nothing in the clean-run count, and starts asserting for real the
 * moment a human decides to enable this route.
 *
 * **Must fail against the commit before this slice** (`app.routes.ts` with
 * no `screenScroll` on `/seating`): `main` never yields on this route, so
 * `mainOverflowY` reads `'auto'` at every width — the first two tests below
 * fail on exactly that line. The third (the screen's own internal
 * header/tabs-stay-put and pane-independence invariant) passes against both
 * commits: `seating-plan.scss`'s own local shell already provided it before
 * this migration, the same shape `config-manager.spec.ts`'s own header
 * comment documents for its screen — a genuine formalisation, not a fix for
 * an observable defect, on that one test only. See
 * `tasks/28-phase-x-layout-layer/reports/T343-seating-plan.json` for the
 * captured failing run (a disposable `git worktree` at the prior commit,
 * never `git stash`).
 */

const ROUTE_DISABLED_REASON =
  "`/seating` redirected to `/` — `routeEnabledGuard` says this build's `enabledRoutes` " +
  "does not include `'seating'` (see this file's own header comment and " +
  'tasks/28-phase-x-layout-layer/reports/T343-seating-plan.json decisions_needed[]).';

/** Navigates to `/seating` and reports whether the guard actually let the
 *  navigation through, rather than assuming it did — see this file's own
 *  header comment for why a disabled route self-skips instead of failing.
 *  `routeEnabledGuard`'s redirect is async (a full Angular bootstrap runs
 *  after this hard navigation before any guard evaluates), so reading
 *  `page.url()` immediately after `goto()` resolves races it under worker
 *  contention — measured directly: reliable alone, flaky across the full
 *  5-project parallel run. Races two outcomes instead of reading a
 *  point-in-time value: either `.unit-btn` (inside `.unassigned-body`,
 *  visible at every width by default) renders, or the URL stops containing
 *  `/seating` because the guard bounced it to `/`. */
async function gotoSeating(page: import('@playwright/test').Page): Promise<boolean> {
  await signInAsCouple(page);
  await page.goto('/seating');

  const outcome = await Promise.race([
    expect(page.locator('.unit-btn').first())
      .toBeVisible({ timeout: 10_000 })
      .then((): 'reachable' => 'reachable')
      .catch((): 'timeout' => 'timeout'),
    page
      .waitForURL((url) => !url.pathname.includes('/seating'), { timeout: 10_000 })
      .then((): 'redirected' => 'redirected')
      .catch((): 'timeout' => 'timeout'),
  ]);

  if (outcome === 'reachable') return true;
  if (outcome === 'redirected') return false;
  throw new Error(`/seating neither rendered nor redirected within 10s (URL: ${page.url()})`);
}

test('≥900px: main yields to .screen-scroll, the bounded box gives :host a resolved height, and .unassigned-body/.tables scroll independently of each other and of it (hub ADR-0043 §4a/§5)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 500 });
  const reachable = await gotoSeating(page);
  test.skip(!reachable, ROUTE_DISABLED_REASON);

  const chain = await page.evaluate(() => {
    const main = document.querySelector('main') as HTMLElement | null;
    const screenScroll = document.querySelector('.screen-scroll') as HTMLElement | null;
    const host = document.querySelector('app-seating-plan') as HTMLElement | null;
    const unassignedBody = document.querySelector('.unassigned-body') as HTMLElement | null;
    const tables = document.querySelector('.tables') as HTMLElement | null;
    if (!main || !screenScroll || !host || !unassignedBody || !tables) {
      throw new Error(
        'main / .screen-scroll / app-seating-plan / .unassigned-body / .tables did not render',
      );
    }

    main.scrollTop = 0;
    main.scrollTop = 400;
    const mainScrollTopAfterWrite = main.scrollTop;
    main.scrollTop = 0;

    screenScroll.scrollTop = 0;
    screenScroll.scrollTop = 400;
    const screenScrollScrollTopAfterWrite = screenScroll.scrollTop;
    screenScroll.scrollTop = 0;

    unassignedBody.scrollTop = 0;
    unassignedBody.scrollTop = 100;
    const unassignedScrollTopAfterWrite = unassignedBody.scrollTop;

    tables.scrollTop = 0;
    tables.scrollTop = 100;
    const tablesScrollTopAfterWrite = tables.scrollTop;
    // Writing `.tables` must not have moved `.unassigned-body` — two
    // independent scrollers, not one shared region.
    const unassignedScrollTopAfterTablesWrite = unassignedBody.scrollTop;

    return {
      mainOverflowY: getComputedStyle(main).overflowY,
      mainScrollTopAfterWrite,
      screenScrollDisplay: getComputedStyle(screenScroll).display,
      screenScrollOverflowY: getComputedStyle(screenScroll).overflowY,
      screenScrollScrollTopAfterWrite,
      screenScrollClientHeight: screenScroll.clientHeight,
      hostClientHeight: host.clientHeight,
      unassignedOverflowY: getComputedStyle(unassignedBody).overflowY,
      unassignedScrollHeight: unassignedBody.scrollHeight,
      unassignedClientHeight: unassignedBody.clientHeight,
      unassignedScrollTopAfterWrite,
      tablesOverflowY: getComputedStyle(tables).overflowY,
      tablesScrollHeight: tables.scrollHeight,
      tablesClientHeight: tables.clientHeight,
      tablesScrollTopAfterWrite,
      unassignedScrollTopAfterTablesWrite,
    };
  });

  // `main` has yielded: not a scroll container (ADR-0041 §4's `clip`, not
  // merely a suppressed scrollbar), and a `scrollTop` write is a structural
  // no-op.
  expect(chain.mainOverflowY).toBe('clip');
  expect(chain.mainScrollTopAfterWrite).toBe(0);

  // `.screen-scroll` is a real, bounded box (not `display: contents`) that
  // clips rather than scrolls (hub ADR-0043 §4a) — it exists only to give
  // `:host` a resolved height.
  expect(chain.screenScrollDisplay).toBe('block');
  expect(chain.screenScrollOverflowY).toBe('clip');
  expect(chain.screenScrollScrollTopAfterWrite).toBe(0);
  expect(chain.hostClientHeight).toBeGreaterThan(0);
  expect(chain.hostClientHeight).toBe(chain.screenScrollClientHeight);

  // Both panes are their own, independent scrollers — unaffected by
  // `.screen-scroll` becoming a bounding box around the whole screen. The
  // two-pane split is this screen's to own (hub ADR-0043 §5).
  expect(chain.unassignedOverflowY).toBe('auto');
  expect(chain.unassignedScrollHeight).toBeGreaterThan(chain.unassignedClientHeight);
  expect(chain.unassignedScrollTopAfterWrite).toBe(100);

  expect(chain.tablesOverflowY).toBe('auto');
  expect(chain.tablesScrollHeight).toBeGreaterThan(chain.tablesClientHeight);
  expect(chain.tablesScrollTopAfterWrite).toBe(100);

  // Scrolling `.tables` never moves `.unassigned-body` — siblings, not
  // nested scrollers on the same axis.
  expect(chain.unassignedScrollTopAfterTablesWrite).toBe(chain.unassignedScrollTopAfterWrite);
});

test('<900px: the shell classification holds identically — main yields, .screen-scroll bounds :host, and it is not the flow variant milestones is (hub ADR-0043 §5 corrects ADR-0042 §2)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 500 });
  const reachable = await gotoSeating(page);
  test.skip(!reachable, ROUTE_DISABLED_REASON);

  const measured = await page.evaluate(() => {
    const main = document.querySelector('main') as HTMLElement | null;
    const screenScroll = document.querySelector('.screen-scroll') as HTMLElement | null;
    const host = document.querySelector('app-seating-plan') as HTMLElement | null;
    if (!main || !screenScroll || !host) {
      throw new Error('main / .screen-scroll / app-seating-plan did not render');
    }
    main.scrollTop = 0;
    main.scrollTop = 400;
    const mainScrollTopAfterWrite = main.scrollTop;
    return {
      mainOverflowY: getComputedStyle(main).overflowY,
      mainScrollTopAfterWrite,
      screenScrollDisplay: getComputedStyle(screenScroll).display,
      screenScrollOverflowY: getComputedStyle(screenScroll).overflowY,
      hostClientHeight: host.clientHeight,
      screenScrollClientHeight: screenScroll.clientHeight,
    };
  });

  expect(measured.mainOverflowY).toBe('clip');
  expect(measured.mainScrollTopAfterWrite).toBe(0);
  expect(measured.screenScrollDisplay).toBe('block');
  expect(measured.screenScrollOverflowY).toBe('clip');
  expect(measured.hostClientHeight).toBeGreaterThan(0);
  expect(measured.hostClientHeight).toBe(measured.screenScrollClientHeight);
});

test('mobile: the header and segmented tabs stay put while the visible pane scrolls, and switching tabs scrolls the newly-visible pane independently', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 500 });
  const reachable = await gotoSeating(page);
  test.skip(!reachable, ROUTE_DISABLED_REASON);

  // Default mobile tab is "Unseated" (`mobileTab()`'s initial value,
  // `seating-plan.ts`) — `.unassigned-body` is the visible scroller.
  // `header.header` (the tag selector), not `.header` alone: the shared
  // `app-screen-header` (`private-layout.html`) carries the same class name
  // on a sibling element and would otherwise make this locator ambiguous.
  const header = page.locator('header.header');
  const tabs = page.locator('.mobile-tabs');
  const headerBefore = await header.boundingBox();
  const tabsBefore = await tabs.boundingBox();
  if (!headerBefore || !tabsBefore) {
    throw new Error('.header / .mobile-tabs did not render');
  }

  await page.evaluate(() => {
    const el = document.querySelector('.unassigned-body') as HTMLElement;
    el.scrollTop = 100;
  });

  const headerAfter = await header.boundingBox();
  const tabsAfter = await tabs.boundingBox();
  if (!headerAfter || !tabsAfter) {
    throw new Error('.header / .mobile-tabs disappeared after scrolling');
  }
  expect(headerAfter.y).toBe(headerBefore.y);
  expect(tabsAfter.y).toBe(tabsBefore.y);

  // Switch to the "Tables" tab — `.tables` becomes the visible scroller and
  // `.unassigned` becomes `.mobile-hidden`. Measured, not assumed: a
  // `display: none` ancestor resets a descendant's `scrollTop` to `0` (real
  // Chromium behaviour, confirmed empirically here), so this deliberately
  // does not assert `.unassigned-body` "remembers" 100 — it does not, and
  // nothing on this screen claims it should. What must hold is that
  // `.tables` becomes its own independent, working scroller once visible,
  // and that switching tabs does not move the pinned header/tab bar.
  await page.getByText('Tables ·').click();
  await expect(page.locator('.tables:not(.mobile-hidden)')).toBeVisible();

  const headerAfterSwitch = await header.boundingBox();
  const tabsAfterSwitch = await tabs.boundingBox();
  if (!headerAfterSwitch || !tabsAfterSwitch) {
    throw new Error('.header / .mobile-tabs disappeared after switching tabs');
  }
  expect(headerAfterSwitch.y).toBe(headerBefore.y);
  expect(tabsAfterSwitch.y).toBe(tabsBefore.y);

  const tablesResult = await page.evaluate(() => {
    const tables = document.querySelector('.tables') as HTMLElement;
    tables.scrollTop = 0;
    tables.scrollTop = 80;
    return {
      tablesOverflowY: getComputedStyle(tables).overflowY,
      tablesScrollHeight: tables.scrollHeight,
      tablesClientHeight: tables.clientHeight,
      tablesScrollTopAfterWrite: tables.scrollTop,
    };
  });

  expect(tablesResult.tablesOverflowY).toBe('auto');
  expect(tablesResult.tablesScrollHeight).toBeGreaterThan(tablesResult.tablesClientHeight);
  expect(tablesResult.tablesScrollTopAfterWrite).toBeGreaterThan(0);
});
