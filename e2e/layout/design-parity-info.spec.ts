import { test, expect } from '@playwright/test';

import { signInAsGuest } from '../support/auth';
import {
  blockOutline,
  boxOf,
  expectClose,
  openDsKitScreen,
  startDsKitServer,
  stylesOf,
  type DsKitServer,
} from '../helpers/ds-kit';

/**
 * Design-parity spec for Home's "Good to know" section (T375) — kit
 * `ScreenInfo.jsx` ↔ `app-good-to-know` at `/me?section=info`. Measured
 * against the served DS kit through the T368/T369/T373 harness
 * (`e2e/helpers/ds-kit.ts`): block outline plus the per-element metrics the
 * kit hard-codes inline.
 *
 * Both sides render the SAME five blocks in the SAME stored order — the
 * app's come from `api-mocks.ts`'s `goodToKnowBlocks()`, which mirrors the
 * kit's own seed copy on purpose so a difference here is a *design*
 * difference, not a content one.
 *
 * Two differences are structural and deliberate, asserted loosely (count and
 * two-column-ness) rather than pretended away:
 *
 * 1. **Desktop column distribution.** The kit hand-picks which of its five
 *    fixture blocks go left (dress code, contacts) and which go right (gifts,
 *    FAQ, the day line) — an editorial choice about content that does not
 *    exist yet when the couple has written their own. The app splits the
 *    stored sequence in half instead: first half down the left column, the
 *    rest down the right, so the couple's order (hub ADR-0046 §3) survives
 *    the split. Same blocks, same sequence, both columns used.
 * 2. **The gift card's serif headline.** The kit draws one ("A gift, if you
 *    insist") above the intro prose; the stored `gift` block has no field for
 *    it (ADR-0046 §2 — `intro`, then the labelled rows), so the app renders
 *    the block's `title` as the section label and nothing in that slot. Not a
 *    kit defect and not an app defect: the ADR narrowed the shape after the
 *    mock was drawn.
 *
 * 3. **Two contact rows carry no number.** The kit draws three names and
 *    three numbers; since `wedding-api` T246 (hub ADR-0046 Amendment 2 §A)
 *    a stored entry carries the person itself and `phoneNumber` is optional
 *    — absent means no number line and no call button, never a disabled one.
 *    The fixture gives exactly one of the three a number, so one call button
 *    renders and two rows correctly show none.
 *
 * One measurement below is a kit finding rather than an app one and is
 * recorded in `../wedding-ui-design/contract/FINDINGS.md`, never as a defect
 * here: the kit's gift-row key label is `9px` while every other eyebrow on
 * the same screen (`label()`) is `10px` — the app uses the `--text-label`
 * token (10px) for both.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** The kit's wide branch: the two-column grid holding the five blocks. */
const KIT_DESKTOP_ROOT = 'div[style*="grid-template-columns: 1fr 1fr"]';
/** The kit's non-wide branch: the scrolling flex column holding the same five. */
const KIT_MOBILE_ROOT = 'div[style*="gap: 22px"]';

async function openApp(page: import('@playwright/test').Page, viewport: { width: number; height: number }) {
  await signInAsGuest(page);
  await page.setViewportSize(viewport);
  await page.goto('/me?section=info');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('app-good-to-know .block').first()).toBeVisible();
}

test.describe('Home · Good to know — parity with the DS kit (T375, hub ADR-0046)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  test('desktop: block outline — the same five blocks, in two columns', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, {
      device: 'Desktop',
      role: 'Guest',
      viewLabel: 'Home · Good to know',
    });

    await openApp(page, DESKTOP);

    const kitOutline = await blockOutline(kitPage, KIT_DESKTOP_ROOT);
    const appOutline = await blockOutline(page, 'app-good-to-know .layout');

    // Pinned to the literal five so neither side can pass vacuously on a
    // selector that stopped matching.
    expect(kitOutline.length, 'kit: five blocks').toBe(5);
    expect(appOutline.length, 'block count (dress code, gifts, FAQ, contacts, day line)').toBe(
      kitOutline.length,
    );
    // Both sides distribute the same sequence across exactly two columns.
    expect(new Set(kitOutline.map((b) => b.column)), 'kit columns').toEqual(new Set([1, 2]));
    expect(new Set(appOutline.map((b) => b.column)), 'app columns').toEqual(new Set([1, 2]));

    await kitPage.close();
  });

  test('mobile: block outline — one flow, stored order', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, {
      device: 'Mobile',
      role: 'Guest',
      viewLabel: 'Home · Good to know',
    });

    await openApp(page, MOBILE);

    const kitOutline = await blockOutline(kitPage, KIT_MOBILE_ROOT);
    const appOutline = await blockOutline(page, 'app-good-to-know .layout');

    // No grid on either side here — `column` is `null` throughout; count and
    // DOM order is the whole check, same convention as the Home spec's own
    // mobile case.
    expect(kitOutline.length, 'kit: five blocks').toBe(5);
    expect(appOutline.length, 'block count').toBe(kitOutline.length);
    expect(
      appOutline.map((b) => b.column),
      'no grid columns below 900px',
    ).toEqual(kitOutline.map(() => null));

    await kitPage.close();
  });

  test('mobile: card surface, eyebrow and dress-code type match the kit', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, {
      device: 'Mobile',
      role: 'Guest',
      viewLabel: 'Home · Good to know',
    });

    await openApp(page, MOBILE);

    // The kit's `card()` helper: `var(--surface)` fill, 1px `var(--line)`
    // border, radius 14, padding 16. Read off the dress-code card, the first
    // one it draws.
    const kitCard = await kitPage.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div')).find((d) =>
        (d.getAttribute('style') ?? '').includes('border-radius: 14px'),
      ) as HTMLElement | undefined;
      if (!el) return null;
      const cs = getComputedStyle(el);
      return {
        backgroundColor: cs.backgroundColor,
        borderTopWidth: cs.borderTopWidth,
        borderTopColor: cs.borderTopColor,
        borderRadius: cs.borderTopLeftRadius,
        padding: cs.paddingTop,
      };
    });
    const appCard = await stylesOf(page, 'app-good-to-know .dress-card', [
      'backgroundColor',
      'borderTopWidth',
      'borderTopColor',
      'borderTopLeftRadius',
      'paddingTop',
    ]);
    expect(kitCard, 'kit: card surface not found').not.toBeNull();
    expect(appCard, 'app: .dress-card not found').not.toBeNull();
    expect(appCard!.backgroundColor, 'card fill').toBe(kitCard!.backgroundColor);
    expect(appCard!.borderTopWidth, 'card hairline width').toBe(kitCard!.borderTopWidth);
    expect(appCard!.borderTopColor, 'card hairline color').toBe(kitCard!.borderTopColor);
    expect(appCard!.borderTopLeftRadius, 'card radius').toBe(kitCard!.borderRadius);
    expect(appCard!.paddingTop, 'card padding').toBe(kitCard!.padding);

    // The section label above each card (kit `label()`): 10px, 0.14em,
    // uppercase, muted.
    const appLabel = await stylesOf(page, 'app-good-to-know .block .label', [
      'fontSize',
      'letterSpacing',
      'textTransform',
      'color',
    ]);
    expect(appLabel!.fontSize, 'eyebrow size').toBe('10px');
    expect(appLabel!.letterSpacing, 'eyebrow tracking').toBe('1.4px');
    expect(appLabel!.textTransform, 'eyebrow case').toBe('uppercase');

    // The dress-code headline: serif, 22px, line-height 1.15.
    const appHeadline = await stylesOf(page, 'app-good-to-know .headline', ['fontSize', 'fontFamily']);
    expect(appHeadline!.fontSize, 'dress-code headline size').toBe('22px');
    expect(appHeadline!.fontFamily, 'dress-code headline face').toContain('DM Serif Display');

    await kitPage.close();
  });

  test('mobile: swatch row, row heights and the call target match the kit', async ({ page }) => {
    await openApp(page, MOBILE);

    // Five swatches, derived from the active theme — never authored, never
    // stored (hub ADR-0046 §2). 40px circles in a 62px column.
    const swatches = page.locator('app-good-to-know .swatch');
    await expect(swatches).toHaveCount(5);
    const chip = await boxOf(page, 'app-good-to-know .swatch .chip');
    expectClose(chip!.width, 40, 1, 'swatch circle width');
    expectClose(chip!.height, 40, 1, 'swatch circle height');
    const swatch = await boxOf(page, 'app-good-to-know .swatch');
    expectClose(swatch!.width, 62, 1, 'swatch column width');

    // Kit row heights: gift 52, FAQ question 52, contact 60; call button 44
    // (also the WCAG 2.5.5 target size).
    const giftRow = await boxOf(page, 'app-good-to-know .gift-row');
    expect(giftRow!.height, 'gift row min-height 52').toBeGreaterThanOrEqual(52);
    const faqRow = await boxOf(page, 'app-good-to-know .faq-q');
    expect(faqRow!.height, 'FAQ row min-height 52').toBeGreaterThanOrEqual(52);
    const contactRow = await boxOf(page, 'app-good-to-know .contact-row');
    expect(contactRow!.height, 'contact row min-height 60').toBeGreaterThanOrEqual(60);
    const call = await boxOf(page, 'app-good-to-know .call-btn');
    expectClose(call!.width, 44, 1, 'call button width');
    expectClose(call!.height, 44, 1, 'call button height');

    // Transcription, not resolution (Amendment 2 §A/§D): every name comes
    // off the block itself — one of the three entries has no account at all
    // — and the two rows without a stored number show no number and no
    // button rather than an empty affordance.
    await expect(page.locator('app-good-to-know .contact-row')).toHaveCount(3);
    await expect(page.locator('app-good-to-know .contact-name').first()).toHaveText('Sara Bride');
    await expect(page.locator('app-good-to-know .call-btn')).toHaveCount(1);
  });

  test('the FAQ opens closed and stays single-open (ADR-0046 §3, overriding the mock)', async ({
    page,
    context,
  }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, {
      device: 'Mobile',
      role: 'Guest',
      viewLabel: 'Home · Good to know',
    });

    // The mock itself opens its first row (`useState(0)`, `ScreenInfo.jsx:55`)
    // — asserted here so this spec fails loudly if the kit ever changes and
    // the app's deliberate override stops being an override.
    const kitExpanded = await kitPage.locator('button[aria-expanded="true"]').count();
    expect(kitExpanded, 'kit: the mock opens its first FAQ row').toBe(1);

    await openApp(page, MOBILE);

    const questions = page.locator('app-good-to-know .faq-q');
    await expect(questions).toHaveCount(6);
    await expect(page.locator('app-good-to-know .faq-q[aria-expanded="true"]')).toHaveCount(0);

    await questions.nth(2).click();
    await expect(page.locator('app-good-to-know .faq-q[aria-expanded="true"]')).toHaveCount(1);
    await expect(page.locator('app-good-to-know .faq-a')).toHaveCount(1);

    await questions.nth(4).click();
    await expect(page.locator('app-good-to-know .faq-q[aria-expanded="true"]')).toHaveCount(1);
    await expect(questions.nth(2)).toHaveAttribute('aria-expanded', 'false');

    await kitPage.close();
  });

  test('desktop: the section sits in the shell 900px column, not one of its own', async ({ page }) => {
    await openApp(page, DESKTOP);

    // `contract/ds-contract.json` → `screens.ScreenInfo.shell.maxWidth` is
    // 900, and Home's own column already is that (see
    // `design-parity-home.spec.ts`). This section adds no cap of its own.
    const host = await boxOf(page, 'app-good-to-know');
    expectClose(host!.width, 900, 1, 'desktop: Good to know fills the shell column');
  });
});
