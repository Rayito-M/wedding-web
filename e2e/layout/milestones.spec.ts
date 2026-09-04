import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — `milestones`' slice of T349, landing in the
 * same PR as its T343 migration.
 *
 * `milestones` is the one genuinely **per-breakpoint** screen (hub ADR-0043
 * §5, the case the ADR was written to make expressible): flow below `$bp-lg`
 * (900px, `main` scrolls) and shell from it up (`main` yields,
 * `screenScroll: 'lg'` on the route). It is also the **first live route ever
 * to use a breakpoint variant of `screenScroll`** — `config-manager` proved
 * the height chain for `screenScroll: true` (unconditional), but nothing had
 * exercised `'lg'` end to end on a real route (route data → class binding →
 * media query → resolved height) before this spec. That gap was T352's own
 * `risks[1]`, narrowed by T343's `milestones` slice to exactly this
 * question and closed here.
 *
 * Per hub ADR-0043 §4a, `.screen-scroll` never scrolls — it only bounds
 * `:host`'s `height: 100%` once `main` yields to it. `.list` and
 * `.detail-body` keep their **own**, independent scrollers throughout: the
 * master-detail split (list on the left, detail pane/sheet on the right) is
 * this screen's to own, not the layout's. Collapsing it into
 * `.screen-scroll`'s own scroller (the option this task's own T343 report
 * considered and rejected) would both break that UX — a long list would
 * carry the detail pane's action buttons off-screen while scrolling — and
 * regress `centerTodayMarker()`'s desktop behaviour from working to a
 * no-op. The third spec below re-verifies that centering still holds on
 * desktop after this migration, rather than assuming it.
 *
 * **Must fail against the commit before this slice** (`app.routes.ts` with
 * no `screenScroll` on `/milestones`, `milestones.scss`'s own
 * `@media (min-width: 900px)`): `main` never yields on this route, so
 * `mainOverflowY`/`screenScrollDisplay` below read `'auto'`/`'contents'` at
 * every width, not just below 900px — see
 * `tasks/28-phase-x-layout-layer/reports/T343-milestones.json` for the
 * captured failing run.
 */

/** A timeline spanning ±420 days from "today" so the Today marker sits well
 *  away from either scroll edge, and one deliberately tall guest-facing
 *  entry — this screen's own `.detail-body` is tallest for a guest-facing
 *  milestone's announcement-config section (T343's own measurement) — to
 *  scroll-test the detail pane independently of `.list`. */
function milestonesFixture(): unknown[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const items: unknown[] = [];
  for (let i = -20; i <= 20; i++) {
    const offsetDays = i * 20;
    items.push({
      id: `e2e-ms-${i}`,
      title: { es: `Hito ${i}`, en: `Milestone ${i}`, fr: `Étape ${i}` },
      plannedDate: new Date(now + offsetDays * dayMs).toISOString(),
      kind: i % 3 === 0 ? 'internal' : 'guest-facing',
      reached: offsetDays < 0,
      version: 1,
      atRisk: false,
    });
  }
  items.push({
    id: 'e2e-ms-tall',
    title: {
      es: 'Objetivo de scroll E2E',
      en: 'E2E Scroll Target',
      fr: 'Cible de défilement E2E',
    },
    plannedDate: new Date(now + 5 * dayMs).toISOString(),
    kind: 'guest-facing',
    reached: false,
    version: 1,
    atRisk: false,
  });
  return items;
}

async function gotoMilestones(page: import('@playwright/test').Page): Promise<void> {
  await signInAsCouple(page);
  await page.route('**/v1/milestones', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: milestonesFixture() }),
    }),
  );
  await page.goto('/milestones');
  // `.card` alone is ambiguous: the `!ready()` skeleton branch renders its
  // own 4-row placeholder under an identically-classed `.card`
  // (`milestones.html`) — only the loaded branch renders `.today-marker`, so
  // waiting on that (rather than `.card`) is what actually waits for the
  // real, full-length fixture rather than resolving against the skeleton.
  // Explicit 10s timeout (default 5s): this helper chains a full OTP
  // sign-in, a navigation and a 43-item fetch before anything here renders —
  // observed to occasionally exceed 5s under heavy parallel-suite load, the
  // same worker-contention class already named for `guest-manager-scrolled-
  // header.spec.ts`'s own `.table-row` wait (T349/T357).
  await expect(page.locator('.today-marker').first()).toBeVisible({ timeout: 10_000 });
}

test("≥900px: main yields to .screen-scroll, the bounded box gives :host a resolved height, and .list/.detail-body keep their own independent scrollers (hub ADR-0043 §4a/§5, closes T352 risks[1])", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await gotoMilestones(page);

  const chain = await page.evaluate(() => {
    const main = document.querySelector('main') as HTMLElement | null;
    const screenScroll = document.querySelector('.screen-scroll') as HTMLElement | null;
    const host = document.querySelector('app-milestones') as HTMLElement | null;
    const list = document.querySelector('.list') as HTMLElement | null;
    if (!main || !screenScroll || !host || !list) {
      throw new Error('main / .screen-scroll / app-milestones / .list did not render');
    }
    main.scrollTop = 0;
    main.scrollTop = 400;
    const mainScrollTopAfterWrite = main.scrollTop;
    main.scrollTop = 0;

    screenScroll.scrollTop = 0;
    screenScroll.scrollTop = 400;
    const screenScrollScrollTopAfterWrite = screenScroll.scrollTop;
    screenScroll.scrollTop = 0;

    list.scrollTop = 0;
    list.scrollTop = 300;
    const listScrollTopAfterWrite = list.scrollTop;
    list.scrollTop = 0;

    return {
      mainOverflowY: getComputedStyle(main).overflowY,
      mainScrollTopAfterWrite,
      screenScrollDisplay: getComputedStyle(screenScroll).display,
      screenScrollOverflowY: getComputedStyle(screenScroll).overflowY,
      screenScrollScrollTopAfterWrite,
      screenScrollClientHeight: screenScroll.clientHeight,
      hostClientHeight: host.clientHeight,
      listOverflowY: getComputedStyle(list).overflowY,
      listScrollHeight: list.scrollHeight,
      listClientHeight: list.clientHeight,
      listScrollTopAfterWrite,
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

  // The height chain T352 risks[1] flagged as unproven for a breakpoint
  // variant: `:host`'s `height: 100%` resolves to exactly `.screen-scroll`'s
  // own (flex-bounded) height.
  expect(chain.hostClientHeight).toBeGreaterThan(0);
  expect(chain.hostClientHeight).toBe(chain.screenScrollClientHeight);

  // `.list` is its own, independent scroller — unaffected by `.screen-scroll`
  // becoming a bounding box around the whole screen. The master-detail split
  // is this screen's to own (hub ADR-0043 §5).
  expect(chain.listOverflowY).toBe('auto');
  expect(chain.listScrollHeight).toBeGreaterThan(chain.listClientHeight);
  expect(chain.listScrollTopAfterWrite).toBe(300);

  // Open the tall guest-facing milestone's detail pane and confirm
  // `.detail-body` scrolls independently of `.list` — not nested inside it,
  // not collapsed into `.screen-scroll`'s own (nonexistent) scroller.
  await page.getByText('E2E Scroll Target').click();
  const detailBody = page.locator('.detail-body');
  await expect(detailBody).toBeVisible();

  const detail = await page.evaluate(() => {
    const list = document.querySelector('.list') as HTMLElement;
    const detailBody = document.querySelector('.detail-body') as HTMLElement;
    list.scrollTop = 150;
    const listScrollTopBeforeDetailScroll = list.scrollTop;
    detailBody.scrollTop = 0;
    detailBody.scrollTop = 200;
    const detailBodyScrollTopAfterWrite = detailBody.scrollTop;
    const listScrollTopAfterDetailScroll = list.scrollTop;
    return {
      detailBodyOverflowY: getComputedStyle(detailBody).overflowY,
      detailBodyScrollHeight: detailBody.scrollHeight,
      detailBodyClientHeight: detailBody.clientHeight,
      detailBodyScrollTopAfterWrite,
      listScrollTopBeforeDetailScroll,
      listScrollTopAfterDetailScroll,
    };
  });

  expect(detail.detailBodyOverflowY).toBe('auto');
  expect(detail.detailBodyScrollHeight).toBeGreaterThan(detail.detailBodyClientHeight);
  expect(detail.detailBodyScrollTopAfterWrite).toBeGreaterThan(0);
  // Scrolling the detail pane never moves the list — the two are siblings,
  // not nested scrollers on the same axis.
  expect(detail.listScrollTopAfterDetailScroll).toBe(detail.listScrollTopBeforeDetailScroll);
});

test('<900px: flow — main scrolls, .screen-scroll renders no box at all (hub ADR-0043 §5)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await gotoMilestones(page);

  const measured = await page.evaluate(() => {
    const main = document.querySelector('main') as HTMLElement;
    const screenScroll = document.querySelector('.screen-scroll') as HTMLElement;
    main.scrollTop = 0;
    main.scrollTop = 400;
    const mainScrollTopAfterWrite = main.scrollTop;
    return {
      mainOverflowY: getComputedStyle(main).overflowY,
      mainScrollTopAfterWrite,
      screenScrollDisplay: getComputedStyle(screenScroll).display,
    };
  });

  expect(measured.mainOverflowY).toBe('auto');
  expect(measured.mainScrollTopAfterWrite).toBeGreaterThan(0);
  expect(measured.screenScrollDisplay).toBe('contents');
});

test('centerTodayMarker() centers the Today marker into view on load, on desktop (re-verified after this screen\'s screenScroll: \'lg\' migration)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await gotoMilestones(page);

  // `centerTodayMarker()` (`milestones.ts`) writes on the next animation
  // frame and again after a 200ms settle-retry — poll rather than assume a
  // fixed wait is enough under load.
  await expect
    .poll(async () => page.evaluate(() => document.querySelector('.list')?.scrollTop ?? 0))
    .toBeGreaterThan(0);

  const centering = await page.evaluate(() => {
    const list = document.querySelector('.list') as HTMLElement;
    return {
      scrollTop: list.scrollTop,
      scrollHeight: list.scrollHeight,
      clientHeight: list.clientHeight,
    };
  });

  // Centered, not merely nonzero: away from both the top and bottom edge of
  // the scrollable range, matching a marker roughly in the middle of a
  // ±420-day fixture.
  const maxScroll = centering.scrollHeight - centering.clientHeight;
  expect(centering.scrollTop).toBeGreaterThan(maxScroll * 0.15);
  expect(centering.scrollTop).toBeLessThan(maxScroll * 0.85);
});
