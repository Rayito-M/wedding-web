import { test, expect } from '@playwright/test';

import { signInAsCouple } from '../support/auth';

/**
 * Layout-regression tier (T263) — the footer half of `wedding-web` T348.
 * `.list-footer-info` / `.list-footer-hint` (`guest-manager.html`) can hold
 * two strings at once only while `hasMore()` is true, and French is the
 * locale that overflows first ("Affichage de … sur …" / "Faites défiler
 * pour voir plus"). The task's own acceptance bullet says this cannot be
 * device-verified until that condition holds — a fully-loaded list hides
 * `.list-footer-hint` entirely and the row fits trivially.
 *
 * **This spec asserts the invariant `%truncating-flex-child` (`_layout
 * .scss`, T340) exists to guarantee, not a reproduction of the historical
 * overflow.** Neither span carried `white-space: nowrap` before this task,
 * so the failure mode is not the flex *container* growing wider than its
 * box — `.list-footer`'s own `scrollWidth`/`clientWidth` stay equal whether
 * or not the fix is applied, because a wrappable span shrinks toward its
 * widest *word*, not its full text, and flexbox lets it wrap onto a second
 * line instead of overflowing. The discriminating geometry fact is
 * therefore `Element.getClientRects().length` — one fragment per rendered
 * line — not container width. Measured by hand at 320×568 with a guest
 * count echoing T341's own 104-guest example (`tasks/reports/T341.json`
 * `risks[0]`): reproducing an actual wrap required catching the page
 * mid-font-swap (`font-display: swap` on `DM Sans`), and was not
 * reproducible once settled (`document.fonts.ready` awaited below) even
 * pushed to totals well beyond anything this app's guest lists reach — the
 * current padding/token values leave more margin than the primitive this
 * screen was missing implies. **This spec therefore cannot demonstrate a
 * fail-before/pass-after difference in this environment**, unlike
 * `guest-list-scroll.spec.ts`; recorded honestly in
 * `tasks/28-phase-x-layout-layer/reports/T348.json` rather than presented as
 * proof it does not have. It still asserts something real and keeps the
 * primitive (`@extend %truncating-flex-child;`, `guest-manager.scss`) from
 * silently regressing, and is the geometry-tier equivalent of the bullet's
 * own "verify with a guest list longer than one page, in French" —
 * automated rather than by hand.
 */
test.use({ viewport: { width: 320, height: 568 } });

test('the French list footer stays single-line once it holds two strings, at the narrowest target width', async ({
  page,
}) => {
  await page.addInitScript(() => window.localStorage.setItem('language', 'fr'));
  // 104 of 300 fetched — `hasMore()` stays true (`.list-footer-hint` renders
  // alongside `.list-footer-info`), and the digit count echoes the 104-guest
  // list `tasks/reports/T341.json` `risks[0]` names.
  await signInAsCouple(page, { guestCount: 300, pageSize: 104 });
  await page.goto('/guests');

  const info = page.locator('.list-footer-info');
  const hint = page.locator('.list-footer-hint');

  await expect(info).toContainText('Affichage de');
  await expect(hint).toContainText('Faites défiler');

  // The guard clause: without both strings actually present at once (the
  // task's own caveat — a fully-loaded list hides `.list-footer-hint`), the
  // assertions below would pass trivially.
  const hintText = (await hint.textContent()) ?? '';
  expect(hintText.trim().length).toBeGreaterThan(0);

  // Settle any `font-display: swap` reflow (DM Sans loading in) before
  // measuring — the one source of flakiness found while writing this spec.
  await page.evaluate(() => document.fonts.ready);

  const infoLines = await info.evaluate((el) => el.getClientRects().length);
  const hintLines = await hint.evaluate((el) => el.getClientRects().length);

  expect(infoLines).toBe(1);
  expect(hintLines).toBe(1);
});
