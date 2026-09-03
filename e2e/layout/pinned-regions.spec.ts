import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263): asserts computed geometry, not DOM
 * presence — this is precisely what 556 passing Vitest/JSDOM tests could not
 * catch in `9474809^` (T341's report: "pinning did not work at all in a
 * browser"). JSDOM never lays anything out, so a class-presence assertion
 * passes whether or not the browser actually keeps these regions still.
 *
 * Must fail against `9474809^` and pass against `9474809` — see
 * `tasks/reports/T263.json` for the captured failing run.
 */
test('pinned head and foot stay put while the guest list scrolls, and the list itself moves', async ({
  page,
}) => {
  await signInAsCouple(page, { guestCount: 60 });
  await page.goto('/guests');

  const firstRow = page.locator('.table-row').first();
  await expect(firstRow).toBeVisible();

  const head = page.locator('.screen-head');
  const foot = page.locator('.screen-foot');

  const headBefore = await head.boundingBox();
  const footBefore = await foot.boundingBox();
  const rowBefore = await firstRow.boundingBox();
  if (!headBefore || !footBefore || !rowBefore) {
    throw new Error('pinned head/foot/first-row did not render — nothing to measure');
  }

  // Scroll whichever ancestor of the first row actually owns the scroll —
  // deliberately not hardcoded to a class name, so this spec keeps testing
  // the real user gesture (scroll the list) rather than one implementation
  // of it.
  await page.evaluate(() => {
    const row = document.querySelector('.table-row');
    let el: HTMLElement | null = row?.parentElement ?? null;
    while (el && el.scrollHeight <= el.clientHeight) {
      el = el.parentElement;
    }
    if (!el) throw new Error('no scrollable ancestor found above .table-row');
    el.scrollTop += 600;
  });

  const headAfter = await head.boundingBox();
  const footAfter = await foot.boundingBox();
  const rowAfter = await firstRow.boundingBox();
  if (!headAfter || !footAfter || !rowAfter) {
    throw new Error('pinned head/foot/first-row disappeared after scrolling');
  }

  // The clause that matters (T263's own text): without it this spec would
  // pass on a page that never scrolled at all.
  expect(rowAfter.y).toBeLessThan(rowBefore.y);

  expect(headAfter.y).toBe(headBefore.y);
  expect(footAfter.y).toBe(footBefore.y);
});
