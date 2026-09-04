import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — the coverage T355 verified but could not
 * commit: it confirmed both invariants below with scratch Playwright specs
 * that were run and then deleted (`tasks/28-phase-x-layout-layer/reports
 * /T355.json`, `risks[1]`), leaving them proven-once but unguarded. This is
 * that spec, landing with T343's `guest-manager` budget slice.
 *
 * **What changed and why it needed a spec at all.** `private-layout.html`
 * binds `(scroll)="onMainScroll()"` on `main`, which drives `isScrolled()`
 * and hence `app-screen-header`'s `.scrolled` class — a card background
 * plus `box-shadow` (`screen-header.scss`, `:host.scrolled header`). Under
 * hub ADR-0043, `/guests` sets no `screenScroll`, so `main` — not
 * `.screen-scroll` (`display: contents` there) — is this screen's real
 * scroller. Before ADR-0043 landed, `main` was `overflow-y: clip` on this
 * route (scroll ownership rode on `headPinned`/`footPinned`, ADR-0042 §2)
 * and therefore never scrolled, so `.scrolled` was **dead on `/guests`**:
 * the header stayed transparent no matter how far the list moved. ADR-0043
 * §5's own addendum names this "a fix, not a regression" but flags it as a
 * visible change on the app's flagship screen that "must be verified rather
 * than discovered" — this spec is that verification, made permanent.
 *
 * The second half (pinned head/foot hold position while `main` scrolls) is
 * already covered generically by `pinned-regions.spec.ts` — re-asserted
 * here only as the guard clause proving this spec's own scroll gesture is
 * real, not to duplicate that file's coverage.
 *
 * **Background is asserted only below the desktop breakpoint.**
 * `screen-header.scss`'s own comment: mobile keeps the header transparent
 * until `.scrolled` supplies `--surface-card`, but its `@media (min-width:
 * 900px)` block gives `header` that same background **unconditionally** —
 * the desktop header always has a solid surface, scrolled or not (measured:
 * `rgb(255, 255, 255)` both before and after on Desktop Chrome's default
 * viewport). Asserting a background *change* there would fail against
 * correct, unrelated CSS. `box-shadow`, which `.scrolled` alone supplies at
 * every width, is the assertion that holds everywhere and is checked
 * unconditionally below.
 *
 * `.table-row` is scoped to `.table-container[role="table"]` throughout
 * (T349, `tasks/28-phase-x-layout-layer/reports/T349.json`):
 * `guest-manager.html`'s `initialLoading()` skeleton renders its own
 * identically-classed rows under a `.table-container` with no `role`
 * attribute, and an unscoped selector can resolve against it under worker
 * contention.
 *
 * **T357 — the three moments this spec must not conflate.** `.scrolled`
 * toggling is (1) the scroll having actually happened, (2) the class
 * having reached the DOM through Angular's zoneless signal graph, and (3)
 * any CSS transition on `header`'s background/`box-shadow` having
 * completed — three different instants, and a single-shot read can land
 * between any two of them. This file already polled (2) and (3) below.
 * `guest-manager-scrolled-header.spec.ts:58` failed once in six full
 * parallel runs, WebKit only (iPhone 14 — the other two flakes in this
 * suite, T349 and T355, were Chromium-only), passing clean alone and in
 * eleven runs afterward. T357 investigated it, and did not root-cause it:
 * both prior flakes were *"measuring before the thing had settled"* in a
 * different disguise each time, so that class of cause was checked first
 * here too, with real instrumentation rather than by reasoning about it —
 * two candidate mechanisms, ruled out rather than confirmed: font-loading
 * settle (`footer-truncation.spec.ts`'s own T349 precedent —
 * `document.fonts.ready`; instrumented separately, `document.fonts.status`
 * was already `'loaded'` and `main.scrollHeight` never changed, in
 * five runs under three concurrent full-suite invocations) and a
 * `main.scrollTop`/`.scrolled` oscillation from a second, corrective
 * native `scroll` event (instrumented with a `MutationObserver` plus a
 * `scroll` listener, an injected ~400ms main-thread stall overlapping the
 * scroll, fifteen runs across all five projects under genuine parallel
 * load) — neither reproduced the failure, or even the *mechanism* a
 * natural reproduction would need: every instrumented run recorded exactly
 * one `scroll` event followed by exactly one class mutation, never two.
 * Thirty-three additional full-suite parallel runs (`e2e/layout`, 50
 * cases) after this investigation: 0 failures — **a floor, not a
 * verdict** (hub `.agent/skills/task-management.md` §4), given the
 * original rate was roughly 1 in 6. `document.fonts.ready` and an
 * explicit "`main` is genuinely overflowing" poll are added below anyway,
 * ahead of the first measurement: they are the correct wait for moment (1)
 * regardless of whether either was this failure's actual trigger, and the
 * first is already this codebase's house style for exactly this class of
 * read (`footer-truncation.spec.ts`). This does not close the task's own
 * root-cause bullet with proof of a mechanism — see the T357 report for
 * the full accounting, including what would falsify the floor above (more
 * runs, most likely).
 *
 * **Polled, not read once, after scrolling.** `header`'s own
 * `transition: background 0.2s ease, box-shadow 0.2s ease` means a
 * `getComputedStyle` read taken immediately after `main.scrollTop` is set
 * can land mid-transition — reproduced: `.scrolled` was already applied to
 * `app-screen-header` (confirmed true) while `background-color` still read
 * as the *pre*-scroll value, failing the change assertion on real, correct
 * CSS. `expect.poll` below waits out the transition instead of racing it.
 */
test('the header gains its scrolled surface once the guest list scrolls, and the pinned head/foot hold position', async ({
  page,
}) => {
  await signInAsCouple(page, { guestCount: 60 });
  await page.goto('/guests');

  await expect(page.locator('.table-container[role="table"] .table-row').first()).toBeVisible();

  // Moment (1), ahead of the first measurement — see this file's own T357
  // note above. `document.fonts.ready` closes the exact gap
  // `footer-truncation.spec.ts` already gates on: a geometry or
  // `getComputedStyle` read taken before a webfont swap reflows text
  // height. A `.table-row` being visible proves the *first* row rendered,
  // not that the table's full 60-row layout — and this spec's own
  // `main.scrollHeight` read a few lines down — has settled under
  // contention, so `main` is also confirmed genuinely overflowing before
  // anything scrolls it, the same discipline `guest-list-scroll.spec.ts`'s
  // `findOverflowingAncestor` applies (T355).
  await page.evaluate(() => document.fonts.ready);

  const headerHost = page.locator('app-screen-header');
  const head = page.locator('.screen-head');
  const foot = page.locator('.screen-foot');
  const main = page.locator('main');

  await expect
    .poll(() => main.evaluate((el) => el.scrollHeight > el.clientHeight), {
      message: 'main never became overflowing — nothing to scroll',
    })
    .toBe(true);

  const before = await readHeaderState(headerHost);
  expect(before.scrolled, 'header started already scrolled — nothing to prove').toBe(false);
  expect(before.boxShadow, 'header already carried a shadow before any scroll').toBe('none');

  const headBefore = await head.boundingBox();
  const footBefore = await foot.boundingBox();
  if (!headBefore || !footBefore) {
    throw new Error('pinned head/foot did not render — nothing to measure');
  }

  await scrollMainToBottom(page);

  // `.scrolled` itself is a class binding, not part of the transitioned
  // properties, but still waits on the `main` `scroll` event reaching
  // Angular's zoneless signal graph — polled for the same reason as the
  // computed styles below.
  await expect
    .poll(() => headerHost.evaluate((el) => el.classList.contains('scrolled')), {
      message: 'app-screen-header never gained .scrolled after scrolling',
    })
    .toBe(true);

  // Universal proof, every width: `.scrolled` is the only thing that ever
  // supplies a shadow (see this file's header comment).
  await expect
    .poll(() => readHeaderState(headerHost).then((s) => s.boxShadow))
    .not.toBe('none');

  // Below 900px only: the header is transparent until scrolled there; at
  // and above it, `header`'s own `@media` block already gives it a solid
  // background regardless of `.scrolled`, so there is nothing to change.
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth < 900) {
    // Checked as "changed", not a hardcoded color, so a future token/theme
    // change does not make this spec fight the design system.
    await expect
      .poll(() => readHeaderState(headerHost).then((s) => s.background))
      .not.toBe(before.background);
  }

  // `.scrolled` (moment 2) was already confirmed above, via `expect.poll`.
  // A second, unpolled read of the same classList here would only reopen
  // the single-shot-read risk this spec exists to avoid (T357) — it cannot
  // prove anything the poll didn't already prove, and it can regress a
  // passing run under exactly the load this spec is meant to survive.
  const headAfter = await head.boundingBox();
  const footAfter = await foot.boundingBox();
  if (!headAfter || !footAfter) {
    throw new Error('pinned head/foot disappeared after scrolling');
  }
  expect(headAfter.y).toBe(headBefore.y);
  expect(footAfter.y).toBe(footBefore.y);
});

async function readHeaderState(headerHost: ReturnType<Page['locator']>) {
  return headerHost.evaluate((hostEl) => {
    const header = hostEl.querySelector('header');
    if (!header) throw new Error('app-screen-header rendered no <header>');
    const cs = getComputedStyle(header);
    return {
      scrolled: hostEl.classList.contains('scrolled'),
      background: cs.backgroundColor,
      boxShadow: cs.boxShadow,
    };
  });
}

/**
 * Scrolls `main` — this screen's real scroller under hub ADR-0043 (flow, no
 * `screenScroll`) — to the bottom and asserts the position actually moved.
 * Deliberately targets `main` directly rather than walking up from
 * `.table-row` the way the other guest-manager specs do: this spec's own
 * subject is `main`'s `(scroll)` handler itself, so asserting against
 * whatever ancestor happens to overflow would test the wrong element if a
 * future change ever moved scroll ownership again.
 */
async function scrollMainToBottom(page: Page): Promise<void> {
  const moved = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) throw new Error('main did not render');
    const before = main.scrollTop;
    main.scrollTop = main.scrollHeight;
    return main.scrollTop !== before;
  });
  expect(moved, 'main did not move when scrolled — nothing to prove').toBe(true);
}
