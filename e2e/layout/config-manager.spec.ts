import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — `config-manager`'s slice of T349, landing
 * in the same PR as its T343 migration.
 *
 * `config-manager` is classified **shell at every breakpoint** (hub
 * ADR-0042 §Context ¶2, corrected 2026-09-04), the same shape as
 * `seating-plan`: `:host` clips unconditionally and `.content` is the one
 * page-level scroller at every width — there is no per-breakpoint flow/shell
 * split the way `milestones` has. Unlike `guest-manager`, this screen
 * registers no `*appScreenHead`/`*appScreenFoot` template — nothing of its
 * own leaves the component to be pinned by `PrivateLayout` — so the
 * "pinned region stays put" invariant here is the screen's **own** internal
 * split: the section nav (`.rail` at `≥900px`, `.pills` below it) is a flex
 * sibling of `.content` inside the same clipped `:host`, and must stay fixed
 * while only `.content` scrolls. `.rail`/`.pills` render the same
 * `sections` list at every width; only one is ever CSS-visible, selected
 * here the same way `_layout.scss`'s own `$bp-lg: 900px` does.
 *
 * The "dietary" section (index 5 of 7) is the one long enough to overflow
 * `.content` at every target viewport once seeded with enough tags —
 * `dietaryPreferencesCount` (`e2e/support/api-mocks.ts`) exists for exactly
 * this.
 *
 * **Both specs pass against the commit before T343's migration too** —
 * checked by hand before this screen's SCSS/route changes landed. Unlike
 * `guest-manager` (`9474809^`, an active regression T341/T348 fixed),
 * `config-manager`'s pre-migration `:host` already carried its own local
 * `height: 100%; overflow: clip` shell, which already made both invariants
 * hold — the screen owned its shell correctly, just via a declaration site
 * (`:host` itself) hub ADR-0042 §2 has since moved to route data. T343's
 * change here is a genuine formalisation (route-data classification, the
 * dead `flex: 1; min-height: 0` `:host` shed once it stops being `main`'s
 * flex item, the `.modal-body` `min-height: 0` gap T347 flagged and left
 * unfixed) rather than a fix for an observable defect, so — like T348's own
 * `footer-truncation.spec.ts` — these specs cannot demonstrate a
 * fail-before/pass-after difference in this environment and are recorded as
 * forward-looking regression guards, not proof, per `tasks/28-phase-x-layout
 * -layer/reports/T343.json`.
 *
 * **The first spec did earn its keep once, mid-development**, which is
 * worth keeping: an initial migration attempt set `headPinned: true`
 * instead of `footPinned` (both made `pinned()` true and handed `.content`'s
 * scroller role to `PrivateLayout`'s `.screen-scroll` under the mechanism as
 * it existed before hub ADR-0043, but only `headPinned` also dropped
 * `main`'s `[class.after-head]` 52px fixed-header clearance, on the
 * assumption a registered `*appScreenHead` supplied it instead).
 * `config-manager` registers no head template, so that attempt stranded
 * `.pill`/`.rail-item` under the fixed header — every click in the first
 * spec below failed, intercepted by `app-screen-header`. Caught here before
 * commit, not shipped.
 *
 * **Corrected again 2026-09-04 (hub ADR-0043, `wedding-web` T352).**
 * `footPinned: true` was itself a workaround — a route admitting it "exists
 * only to make `main` yield" for a screen that pins nothing (ADR-0043 §2's
 * own example). The route now declares `screenScroll: true` and no pin
 * flags at all; the fixed-header regression above is independently closed
 * by `after-head` following `screenChrome.head()` rather than any route
 * flag (ADR-0043 §3), so it can no longer recur here regardless of which
 * scroll-ownership key is set.
 *
 * **Third spec added 2026-09-04 (hub ADR-0043 §4a, `wedding-web` T358).**
 * `/config` is the one live route that has run under `screenScroll: true`
 * since `0bd2892` — the exact screen §4a's own header comment names as
 * "verified unchanged" — so it is the spec that makes the invariant
 * `.screen-scroll` is not a scroll container structural rather than
 * remembered, on the route where it matters most: `.content` inside it
 * (`config-manager.scss`, `screen-scroll()`) is the screen's own real
 * scroller, and `.screen-scroll` around it must never become a second one.
 */

function navSelectors(viewportWidth: number): { nav: string; item: string } {
  return viewportWidth >= 900
    ? { nav: '.rail', item: '.rail-item' }
    : { nav: '.pills', item: '.pill' };
}

test('the section nav stays put while the content pane scrolls, and the content itself moves', async ({
  page,
}) => {
  await signInAsCouple(page, { dietaryPreferencesCount: 25 });
  await page.goto('/config');

  const { nav: navSelector, item: itemSelector } = navSelectors(
    page.viewportSize()?.width ?? 0,
  );

  // "dietary" — SECTIONS[5] in config-manager.ts — the section seeded long
  // enough to overflow `.content` at every target viewport.
  await page.locator(itemSelector).nth(5).click();

  const firstField = page.locator('.content input[app-input]:visible').first();
  await expect(firstField).toBeVisible();

  const nav = page.locator(navSelector);
  const navBefore = await nav.boundingBox();
  const fieldBefore = await firstField.boundingBox();
  if (!navBefore || !fieldBefore) {
    throw new Error('section nav / first field did not render — nothing to measure');
  }

  // Scroll whichever ancestor of a `.content` field actually owns the
  // scroll — deliberately not hardcoded to `.content` itself, so this spec
  // keeps testing the real user gesture (scroll the form) rather than one
  // implementation of it (mirrors `pinned-regions.spec.ts`).
  await page.evaluate(() => {
    const field = document.querySelector('.content input[app-input]');
    let el: HTMLElement | null = field?.parentElement ?? null;
    while (el && el.scrollHeight <= el.clientHeight) {
      el = el.parentElement;
    }
    if (!el) throw new Error('no scrollable ancestor found above .content input[app-input]');
    el.scrollTop += 400;
  });

  const navAfter = await nav.boundingBox();
  const fieldAfter = await firstField.boundingBox();
  if (!navAfter || !fieldAfter) {
    throw new Error('section nav / first field disappeared after scrolling');
  }

  // The clause that matters (T263's own text): without it this spec would
  // pass on a page that never scrolled at all.
  expect(fieldAfter.y).toBeLessThan(fieldBefore.y);

  expect(navAfter.y).toBe(navBefore.y);
  expect(navAfter.x).toBe(navBefore.x);
});

test("a pinned route's main never outgrows the space its flex parent gives it", async ({
  page,
}) => {
  await signInAsCouple(page, { dietaryPreferencesCount: 25 });
  await page.goto('/config');

  const { item: itemSelector } = navSelectors(page.viewportSize()?.width ?? 0);
  await page.locator(itemSelector).nth(5).click();
  await expect(page.locator('.content input[app-input]:visible').first()).toBeVisible();

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

test('.screen-scroll is not a scroll container on this shell route — it clips, .content is the real scroller (hub ADR-0043 §4a)', async ({
  page,
}) => {
  await signInAsCouple(page, { dietaryPreferencesCount: 25 });
  await page.goto('/config');

  const { item: itemSelector } = navSelectors(page.viewportSize()?.width ?? 0);
  await page.locator(itemSelector).nth(5).click();
  await expect(page.locator('.content input[app-input]:visible').first()).toBeVisible();

  const result = await page.evaluate(() => {
    const screenScroll = document.querySelector('.screen-scroll') as HTMLElement | null;
    const content = document.querySelector('.content') as HTMLElement | null;
    if (!screenScroll || !content) {
      throw new Error('.screen-scroll / .content did not render');
    }
    const screenScrollStyle = getComputedStyle(screenScroll);
    const contentStyle = getComputedStyle(content);
    screenScroll.scrollTop = 0;
    screenScroll.scrollTop = 400;
    content.scrollTop = 0;
    content.scrollTop = 400;
    return {
      screenScrollOverflowY: screenScrollStyle.overflowY,
      screenScrollScrollTopAfterWrite: screenScroll.scrollTop,
      screenScrollScrollHeight: screenScroll.scrollHeight,
      screenScrollClientHeight: screenScroll.clientHeight,
      contentOverflowY: contentStyle.overflowY,
      contentScrollTopAfterWrite: content.scrollTop,
    };
  });

  // `overflow: clip` creates no scroll container at all — stronger than
  // asserting `scrollHeight === clientHeight`, which a box can satisfy by
  // accident (e.g. having nothing to overflow). Asserted both ways here:
  // the computed style, and that a `scrollTop` write is a structural no-op
  // rather than merely resolving to zero because there was nothing to move.
  expect(result.screenScrollOverflowY).toBe('clip');
  expect(result.screenScrollScrollTopAfterWrite).toBe(0);

  // `.content` (`config-manager.scss`, `screen-scroll()`) is the screen's
  // own real scroller and is unaffected by `.screen-scroll` becoming a
  // clipping box around it — the fix this spec guards is `.screen-scroll`
  // no longer being a *second* scroller nested around this one.
  expect(result.contentOverflowY).toBe('auto');
  expect(result.contentScrollTopAfterWrite).toBeGreaterThan(0);
});
