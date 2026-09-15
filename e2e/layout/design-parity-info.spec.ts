import { test, expect, type Page } from '@playwright/test';

import { signInAsGuest } from '../support/auth';
import { CONFIG_DATES, FAQ_ULID_PREFIX, GENERAL_INFORMATION, NOTE_ULID } from '../support/api-mocks';
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
 * Design-parity spec for Home's "Good to know" section — kit `ScreenInfo.jsx`
 * ↔ `app-good-to-know` at `/me?section=info`. Measured against the served DS
 * kit through the T368/T369/T373 harness (`e2e/helpers/ds-kit.ts`): section
 * outline plus the per-element metrics the kit hard-codes inline.
 *
 * **Rewritten by T388 for hub ADR-0047 §1/§2/§4.** What it measured before was
 * ADR-0046's ordered array of typed blocks: a stored sequence, split in half
 * across two columns, with the couple's own order as the thing under test.
 * That shape is gone. `generalInfo` is a fixed object of **six named
 * sections** — `dressCode`, `gift`, `contact`, `faq`, `dayLine`, `note` —
 * **ordering is structural**, and the arrangement under test is now the design
 * system's own, asserted by name via each section's `data-slot`.
 *
 * Content on both sides is the same seed copy: the app's comes from
 * `api-mocks.ts`'s `generalInfoSections()`, which mirrors the kit's own
 * `info.data.js`, so a difference measured here is a *design* difference and
 * never a content one.
 *
 * Six differences are structural and deliberate. They are asserted for what
 * they actually are rather than pretended away, and the two that are the
 * **kit's** own are recorded in `../wedding-ui-design/contract/FINDINGS.md`,
 * never reported here as app defects (hub ADR-0044).
 *
 * 1. **The app renders six sections; the kit draws five.** `note` (ADR-0047
 *    §1) has no counterpart in a mock drawn against the block array, so the
 *    five kit-comparable sections are compared to the kit and the sixth is
 *    asserted on the app side alone. *Recorded as a kit finding.*
 * 2. **The column distribution is the kit's own now.** T375's app split the
 *    stored sequence in half so the couple's authored order survived; with
 *    ordering structural there is no authored order to preserve, so the app
 *    hard-codes the kit's own assignment — dress code and contacts left;
 *    gifts, FAQ and the day line right — and `note` closes the right column.
 *    This spec therefore asserts the arrangement exactly, where its
 *    predecessor could only assert "two columns, same sequence".
 * 3. **The gift card's serif headline.** The kit draws one ("A gift, if you
 *    insist"); the stored `gift` section has no field for it (ADR-0047 §1 —
 *    `intro`, then the labelled rows), so that slot renders nothing. *Already
 *    recorded as a kit finding (2026-09-09 ds-missing-spec).*
 * 4. **Four contact rows, three numbers.** The kit derives three contacts
 *    from its people directory by role and gives all three a number. The
 *    app's come from `contact.couple` — composed server-side by
 *    `GET /v1/config/general-information` and **required** on it (ADR-0047 §4,
 *    Amendment 2) — plus the stored planner and guest entries. `phoneNumber`
 *    is *required* on a planner and a guest entry and optional only on the
 *    couple digest, so the groom is the one row the contract lets go without
 *    one, and the fixture gives him none: no number line and **no call
 *    button — absent, not disabled**.
 * 5. **The contact meta line.** The kit prints `why · phone` on one line for
 *    everyone. The app prints the couple's authored `purpose` on a guest row
 *    and the person's **role** on a couple or planner row (ADR-0047 §2: a
 *    planner's role already states what to ask them), and puts number and
 *    email on a line of their own — email being §3's new exposure, which the
 *    kit never drew.
 * 6. **The gift-row key label is `9px` in the kit** and `--text-label` (10px)
 *    here. *Already recorded as a kit finding (2026-09-09 ds-offgrid).*
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** The kit's wide branch: the two-column grid holding the five blocks. */
const KIT_DESKTOP_ROOT = 'div[style*="grid-template-columns: 1fr 1fr"]';
/** The kit's non-wide branch: the scrolling flex column holding the same five. */
const KIT_MOBILE_ROOT = 'div[style*="gap: 22px"]';

/** The design system's fixed desktop arrangement (`ScreenInfo.jsx:195-205`),
 *  by `data-slot`. `note` is the app's own addition — see difference 1. */
const DS_DESKTOP_COLUMNS = {
  left: ['dress-code', 'contact'],
  right: ['gift', 'faq', 'day-line', 'note'],
};

/** The design system's fixed mobile sequence (`ScreenInfo.jsx:210-216`), with
 *  `note` closing the flow. Ordering is structural — nothing stored says it. */
const DS_MOBILE_ORDER = ['dress-code', 'gift', 'faq', 'contact', 'day-line', 'note'];

/**
 * Every rendered section's `data-slot`, in **reading order** — not DOM order.
 * Below 900px the two column wrappers are `display: contents` and CSS `order`
 * decides the sequence, so DOM order is not what a guest scans; above it the
 * grid reads column-then-row, the same convention {@link blockOutline} uses
 * for a grid root.
 */
async function renderedSlots(page: Page, mode: 'grid' | 'flow'): Promise<string[]> {
  return page.evaluate((layout) => {
    const blocks = Array.from(document.querySelectorAll('app-good-to-know .block')).map((el) => {
      const r = el.getBoundingClientRect();
      return { slot: el.getAttribute('data-slot') ?? '', top: r.top, left: r.left };
    });
    blocks.sort((a, b) =>
      layout === 'grid' ? a.left - b.left || a.top - b.top : a.top - b.top || a.left - b.left,
    );
    return blocks.map((b) => b.slot);
  }, mode);
}

async function openApp(page: Page, viewport: { width: number; height: number }) {
  await signInAsGuest(page);
  await page.setViewportSize(viewport);
  await page.goto('/me?section=info');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('app-good-to-know .block').first()).toBeVisible();
}

test.describe('Home · Good to know — parity with the DS kit (T388, hub ADR-0047)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  test('desktop: the six named sections, in the DS’s fixed two-column arrangement', async ({
    page,
    context,
  }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, {
      device: 'Desktop',
      role: 'Guest',
      viewLabel: 'Home · Good to know',
    });

    await openApp(page, DESKTOP);

    const kitOutline = await blockOutline(kitPage, KIT_DESKTOP_ROOT);
    const appOutline = await blockOutline(page, 'app-good-to-know .layout');

    // Pinned to the literal counts so neither side can pass vacuously on a
    // selector that stopped matching — and so the five-vs-six difference
    // stays visible rather than being absorbed into a `>=`.
    expect(kitOutline.length, 'kit: five blocks, drawn before `note` existed').toBe(5);
    expect(appOutline.length, 'app: six named sections').toBe(6);
    // Both sides distribute their sections across exactly two columns.
    expect(new Set(kitOutline.map((b) => b.column)), 'kit columns').toEqual(new Set([1, 2]));
    expect(new Set(appOutline.map((b) => b.column)), 'app columns').toEqual(new Set([1, 2]));

    // The arrangement itself, by name. `blockOutline`'s grid ordering is
    // column-then-row, so the slot list splits at the column boundary.
    const slots = await renderedSlots(page, 'grid');
    expect(slots, 'the DS’s fixed desktop arrangement').toEqual([
      ...DS_DESKTOP_COLUMNS.left,
      ...DS_DESKTOP_COLUMNS.right,
    ]);
    const columnOf = new Map(appOutline.map((b, i) => [slots[i], b.column]));
    for (const slot of DS_DESKTOP_COLUMNS.left) {
      expect(columnOf.get(slot), `${slot} sits in the left column`).toBe(1);
    }
    for (const slot of DS_DESKTOP_COLUMNS.right) {
      expect(columnOf.get(slot), `${slot} sits in the right column`).toBe(2);
    }

    await kitPage.close();
  });

  test('mobile: one flow, the DS’s fixed order', async ({ page, context }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, {
      device: 'Mobile',
      role: 'Guest',
      viewLabel: 'Home · Good to know',
    });

    await openApp(page, MOBILE);

    const kitOutline = await blockOutline(kitPage, KIT_MOBILE_ROOT);
    expect(kitOutline.length, 'kit: five blocks').toBe(5);
    // No grid on the kit side here — `column` is `null` throughout, the same
    // convention the Home spec's own mobile case uses.
    expect(new Set(kitOutline.map((b) => b.column)), 'kit: no grid columns').toEqual(
      new Set([null]),
    );

    // The app's own columns are `display: contents` below 900px, so the six
    // sections are the flow's own children and `order` alone decides the
    // sequence. That is what a guest scans, and what is asserted.
    const slots = await renderedSlots(page, 'flow');
    expect(slots, 'the DS’s fixed mobile order, notes closing the flow').toEqual(
      DS_MOBILE_ORDER,
    );
    const laidOutInOneColumn = await page.evaluate(() => {
      const lefts = Array.from(document.querySelectorAll('app-good-to-know .block')).map(
        (el) => Math.round(el.getBoundingClientRect().left),
      );
      return new Set(lefts).size;
    });
    expect(laidOutInOneColumn, 'one column below 900px').toBe(1);

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
    // stored (hub ADR-0046 Amendment 3, re-affirmed by ADR-0047 §6). 40px
    // circles in a 62px column.
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
  });

  test('the contacts card opens with the composed couple, and a person with no number gets no call button', async ({
    page,
  }) => {
    await openApp(page, MOBILE);

    // The couple first — `contact.couple`, composed server-side by the read
    // route and REQUIRED on it (ADR-0047 §4) — then the wedding planner, then
    // the guests. Four rows for the fixture's four people.
    const rows = page.locator('app-good-to-know .contact-row');
    await expect(rows).toHaveCount(4);
    await expect(page.locator('app-good-to-know .contact-name')).toHaveText([
      'Sara Moreno',
      'Christophe Lefèvre',
      'Elena Vidal',
      'Guest0 Fixture0',
    ]);

    // The groom carries no `phoneNumber` — the one row the contract lets go
    // without one. No number, and NO call button: absent, not disabled.
    const groom = rows.nth(1);
    await expect(groom.locator('.call-btn'), 'no number, no call button').toHaveCount(0);
    await expect(groom.locator('.contact-id'), 'email only, no number line').toHaveText([
      'christophe@example.com',
    ]);
    // The other three do have one, so both branches render in one fixture.
    await expect(page.locator('app-good-to-know .call-btn')).toHaveCount(3);
    await expect(rows.nth(0).locator('.call-btn')).toHaveAttribute('href', 'tel:+34600112233');

    // A guest row carries the couple's authored `purpose` — what to ask them
    // about; a couple or planner row names itself by role (ADR-0047 §2).
    await expect(rows.nth(3).locator('.contact-meta')).toHaveText('Travel, transfers, logistics');
    await expect(rows.nth(0).locator('.contact-meta')).toHaveText('Bride');
    await expect(rows.nth(2).locator('.contact-meta')).toHaveText('Wedding planner');
  });

  test('identifiers are transcribed, never reformatted (hub ADR-0046 §5, kept by ADR-0047 §6)', async ({
    page,
  }) => {
    await openApp(page, MOBILE);

    const gift = GENERAL_INFORMATION.gift;
    // Byte-identical to what the API returned: no `Intl` formatting, no
    // regrouping of the IBAN, no re-casing of the BIC or the holder's name.
    const values = page.locator('app-good-to-know .gift-row .value');
    await expect(values).toHaveText([
      gift.accountHolder,
      gift.iban,
      gift.bic,
      gift.reference.en,
    ]);
    await expect(page.locator('app-good-to-know .bizum .value')).toHaveText(gift.bizumPhone);
  });

  test('the FAQ opens closed, stays single-open, and keys its rows by the stored ULID', async ({
    page,
    context,
  }) => {
    const kitPage = await context.newPage();
    await openDsKitScreen(kitPage, kit.baseUrl, {
      device: 'Mobile',
      role: 'Guest',
      viewLabel: 'Home · Good to know',
    });

    // The mock itself opens its first row (`useState(0)`, `ScreenInfo.jsx:72`)
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
    // Rows are keyed by the entry's stored ULID, never by its index
    // (ADR-0047 §1) — an index-keyed render could not produce this id.
    await expect(page.locator('app-good-to-know .faq-a')).toHaveAttribute(
      'id',
      `gtk-faq-${FAQ_ULID_PREFIX}2`,
    );

    await questions.nth(4).click();
    await expect(page.locator('app-good-to-know .faq-q[aria-expanded="true"]')).toHaveCount(1);
    await expect(questions.nth(2)).toHaveAttribute('aria-expanded', 'false');

    await kitPage.close();
  });

  test('the note renders its authored title as its label, and the day line renders exactly one variant', async ({
    page,
  }) => {
    await openApp(page, MOBILE);

    // `note` is the section the kit never drew. Its authored `title` IS the
    // section label (ADR-0047 §1) — never unlabelled prose — and its row is
    // keyed by the stored ULID, like the FAQ's.
    const note = page.locator('app-good-to-know .block[data-slot="note"]');
    await expect(note).toHaveCount(1);
    await expect(note.locator('.label')).toHaveText(GENERAL_INFORMATION.note[0].title.en);
    await expect(note.locator('.note-card .prose')).toHaveText(GENERAL_INFORMATION.note[0].body.en);
    expect(NOTE_ULID, 'the fixture note carries a ULID id').toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

    // One of three authored sentences, chosen client-side against today's
    // `Europe/Madrid` calendar date (hub ADR-0046 §4). Nothing stored says
    // which, so the expected variant is derived here by the same rule rather
    // than hard-coded — otherwise this asserts only that *a* sentence showed.
    const madrid = (value: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(value);
    const today = madrid(new Date());
    const dayLine = GENERAL_INFORMATION.dayLine;
    const expected =
      today <= madrid(new Date(CONFIG_DATES.rsvpDeadline))
        ? dayLine.rsvpOpen.en
        : today <= madrid(new Date(CONFIG_DATES.date))
          ? dayLine.rsvpClosed.en
          : dayLine.afterWedding.en;

    const line = page.locator('app-good-to-know .day-line');
    await expect(line).toHaveCount(1);
    await expect(line).toHaveText(expected);
    // And only that one: the other two are stored but must not be on screen.
    const section = page.locator('app-good-to-know');
    for (const other of [dayLine.rsvpOpen.en, dayLine.rsvpClosed.en, dayLine.afterWedding.en]) {
      if (other === expected) continue;
      await expect(section, `the ${other} variant must not render`).not.toContainText(other);
    }
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
