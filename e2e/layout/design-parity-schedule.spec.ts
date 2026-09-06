import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAsGuest } from '../support/auth';
import {
  boxOf,
  expectClose,
  kitContentColumnBox,
  openDsKitScreen,
  startDsKitServer,
  stylesOf,
  type DsKitServer,
} from '../helpers/ds-kit';

/**
 * Design-parity rescan (T369) — Guest/Schedule (kit) ↔ `/schedule` (app,
 * guest role). Kit source: `ScreenSchedule.jsx` (no separate DS component —
 * the whole screen is hand-built inline styles); app source:
 * `schedule.html`/`.scss` + the shared `app-status-pill`/`app-timeline-item`
 * components. `WEDDING_SCHEDULE` (`schedule.data.js`) is mirrored into
 * `api-mocks.ts`'s `agendaItems()` (T369 — the mock's `agenda.items` was
 * previously empty, a fixture gap no spec depended on) so both sides render
 * the same six-row timeline, `provisional` status, first row "Welcome".
 *
 * Four deviations found by the T369 rescan (header-to-title gap at both
 * breakpoints, note font-size, status-pill fill/border/padding) were fixed
 * at T370 — every assertion below is now enforced (no `test.fixme()` left
 * in this file).
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

interface ElementStyle {
  background: string;
  borderColor: string;
  borderStyle: string;
  color: string;
  fontSize: string;
  fontWeight: string;
  padding: string;
  letterSpacing: string;
  textTransform: string;
}

interface ScheduleMetrics {
  contentTop: number;
  titleTop: number;
  titleLeft: number;
  noteLeft: number | null;
  pill: ElementStyle | null;
  note: ElementStyle | null;
  firstItemTitleFontSize: string | null;
}

const STYLE_PROPS = [
  'backgroundColor',
  'borderColor',
  'borderStyle',
  'color',
  'fontSize',
  'fontWeight',
  'padding',
  'letterSpacing',
  'textTransform',
];

function toElementStyle(raw: Record<string, string>): ElementStyle {
  return {
    background: raw.backgroundColor,
    borderColor: raw.borderColor,
    borderStyle: raw.borderStyle,
    color: raw.color,
    fontSize: raw.fontSize,
    fontWeight: raw.fontWeight,
    padding: raw.padding,
    letterSpacing: raw.letterSpacing,
    textTransform: raw.textTransform,
  };
}

/** `ScreenSchedule.jsx` renders no classes/ids of its own — elements are
 *  found the same way `design-parity-home.spec.ts` finds the greeting: by
 *  their known, stable text content (`WEDDING_SCHEDULE`'s own fixture
 *  data, mirrored verbatim into `agendaItems()`). */
async function measureKitSchedule(kitPage: Page, wide: boolean): Promise<ScheduleMetrics> {
  return kitPage.evaluate((wide) => {
    const host = document.querySelector('[data-overlay-host]');
    if (!host) throw new Error('DS kit: AppShell root not found');
    const header = (wide ? host.children[0] : host.children[1]) as HTMLElement | undefined;
    if (!header) throw new Error('DS kit: AppHeader not found');

    const dayTitle = Array.from(document.querySelectorAll('div')).find(
      (el) => el.children.length === 0 && el.textContent?.trim() === 'The day',
    ) as HTMLElement | undefined;
    if (!dayTitle) throw new Error('DS kit: "The day" title not found');

    const statusPill = Array.from(document.querySelectorAll('span')).find((el) =>
      ['Provisional', 'Final schedule'].includes(el.textContent?.trim() ?? ''),
    ) as HTMLElement | undefined;

    const noteMsgSpan = Array.from(document.querySelectorAll('span')).find((el) =>
      (el.textContent ?? '').startsWith('Times'),
    ) as HTMLElement | undefined;
    const noteDiv = (noteMsgSpan?.parentElement ?? null) as HTMLElement | null;

    const firstItemTitle = Array.from(document.querySelectorAll('*')).find(
      (el) => el.children.length === 0 && el.textContent?.trim() === 'Welcome',
    ) as HTMLElement | undefined;

    const style = (el: HTMLElement) => {
      const cs = getComputedStyle(el);
      return {
        background: cs.backgroundColor,
        borderColor: cs.borderColor,
        borderStyle: cs.borderStyle,
        color: cs.color,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        padding: cs.padding,
        letterSpacing: cs.letterSpacing,
        textTransform: cs.textTransform,
      };
    };

    return {
      contentTop: header.getBoundingClientRect().bottom,
      titleTop: dayTitle.getBoundingClientRect().top,
      titleLeft: dayTitle.getBoundingClientRect().left,
      noteLeft: noteDiv ? noteDiv.getBoundingClientRect().left : null,
      pill: statusPill ? style(statusPill) : null,
      note: noteDiv ? style(noteDiv) : null,
      firstItemTitleFontSize: firstItemTitle ? getComputedStyle(firstItemTitle).fontSize : null,
    };
  }, wide);
}

async function measureAppSchedule(page: Page, wide: boolean): Promise<ScheduleMetrics> {
  const contentTopEl = await boxOf(page, wide ? '.body' : 'main');
  const title = await boxOf(page, '.title-block h1');
  const note = await boxOf(page, '.note');
  const pillStyle = await stylesOf(page, 'app-status-pill', STYLE_PROPS);
  const noteStyle = await stylesOf(page, '.note', STYLE_PROPS);
  const firstItemTitleStyle = await stylesOf(page, '.timeline app-timeline-item .item-title', ['fontSize']);
  if (!contentTopEl || !title) throw new Error('App: schedule header/title not found');
  return {
    contentTop: contentTopEl.top,
    titleTop: title.top,
    titleLeft: title.left,
    noteLeft: note ? note.left : null,
    pill: pillStyle ? toElementStyle(pillStyle) : null,
    note: noteStyle ? toElementStyle(noteStyle) : null,
    firstItemTitleFontSize: firstItemTitleStyle ? firstItemTitleStyle.fontSize : null,
  };
}

async function openBoth(
  kit: DsKitServer,
  context: import('@playwright/test').BrowserContext,
  page: Page,
  device: 'Desktop' | 'Mobile',
  viewport: { width: number; height: number },
): Promise<Page> {
  const kitPage = await context.newPage();
  await openDsKitScreen(kitPage, kit.baseUrl, { device, role: 'Guest', viewLabel: 'Schedule' });
  await signInAsGuest(page);
  await page.goto('/schedule');
  await page.setViewportSize(viewport);
  await page.waitForLoadState('networkidle');
  return kitPage;
}

test.describe('Schedule (guest) — pixel parity with the DS kit (T369)', () => {
  let kit: DsKitServer;

  test.beforeAll(async () => {
    kit = await startDsKitServer();
  });

  test.afterAll(async () => {
    await kit.stop();
  });

  for (const [breakpoint, viewport, wide, device] of [
    ['desktop', DESKTOP, true, 'Desktop'],
    ['mobile', MOBILE, false, 'Mobile'],
  ] as const) {
    test(`${breakpoint}: alignment, column width, and status-pill/note type match`, async ({ page, context }) => {
      const kitPage = await openBoth(kit, context, page, device, viewport);
      const kitM = await measureKitSchedule(kitPage, wide);
      const appM = await measureAppSchedule(page, wide);

      // Alignment: title left edge flush with the note banner below it, in
      // BOTH renderings independently (frame widths differ between pages).
      if (kitM.noteLeft != null) {
        expectClose(kitM.noteLeft - kitM.titleLeft, 0, 1, `${breakpoint} kit: note not flush with title`);
      }
      if (appM.noteLeft != null) {
        expectClose(appM.noteLeft - appM.titleLeft, 0, 1, `${breakpoint} app: note not flush with title`);
      }

      expect(appM.pill?.fontSize, `${breakpoint}: status pill font-size`).toBe(kitM.pill?.fontSize);
      expect(appM.pill?.textTransform, `${breakpoint}: status pill text-transform`).toBe(
        kitM.pill?.textTransform,
      );
      expect(appM.pill?.letterSpacing, `${breakpoint}: status pill letter-spacing`).toBe(
        kitM.pill?.letterSpacing,
      );
      expect(appM.firstItemTitleFontSize, `${breakpoint}: first timeline row title font-size`).toBeTruthy();

      await kitPage.close();
    });
  }

  test('desktop content column width vs ds-contract.json maxWidth 620', async ({ page, context }) => {
    const kitPage = await openBoth(kit, context, page, 'Desktop', DESKTOP);
    const kitCol = await kitContentColumnBox(kitPage);
    const appCol = await boxOf(page, 'app-schedule');
    expect(kitCol, 'kit: Schedule content column not found').not.toBeNull();
    expect(appCol, 'app: app-schedule host not found').not.toBeNull();
    expectClose(kitCol!.width, 620, 1, 'desktop kit: content column width vs ds-contract.json maxWidth 620');
    expectClose(appCol!.width, 620, 1, 'desktop app: content column width vs ds-contract.json maxWidth 620');
    await kitPage.close();
  });

  // — T369 deviations, fixed at T370 (now enforced) —

  test('desktop: header-to-title gap — kit 26px (AppShell.jsx content-column top padding), app now 26px (schedule.scss .title-block, T370)', async ({
    page,
    context,
  }) => {
    const kitPage = await openBoth(kit, context, page, 'Desktop', DESKTOP);
    const kitM = await measureKitSchedule(kitPage, true);
    const appM = await measureAppSchedule(page, true);
    expectClose(appM.titleTop - appM.contentTop, kitM.titleTop - kitM.contentTop, 1, 'header-to-title gap');
    await kitPage.close();
  });

  test('mobile: header-to-title gap — kit 12px (ScreenSchedule.jsx non-wide title padding), app now 12px (schedule.scss .title-block, T370)', async ({
    page,
    context,
  }) => {
    const kitPage = await openBoth(kit, context, page, 'Mobile', MOBILE);
    const kitM = await measureKitSchedule(kitPage, false);
    const appM = await measureAppSchedule(page, false);
    expectClose(appM.titleTop - appM.contentTop, kitM.titleTop - kitM.contentTop, 1, 'header-to-title gap');
    await kitPage.close();
  });

  test('note font-size — kit 11px (ScreenSchedule.jsx note block), app now 11px ($text-micro, T370), both breakpoints', async ({
    page,
    context,
  }) => {
    const kitPage = await openBoth(kit, context, page, 'Desktop', DESKTOP);
    const kitM = await measureKitSchedule(kitPage, true);
    const appM = await measureAppSchedule(page, true);
    expect(appM.note?.fontSize).toBe(kitM.note?.fontSize);
    await kitPage.close();
  });

  test('status pill style — kit renders a SOLID filled pill (background var(--status-provisional), 1px solid transparent, padding 2px 8px); app\'s app-status-pill "provisional" variant now matches (T370 — status-pill.scss split the agenda final/provisional pair off milestone\'s dashed default), both breakpoints', async ({
    page,
    context,
  }) => {
    const kitPage = await openBoth(kit, context, page, 'Desktop', DESKTOP);
    const kitM = await measureKitSchedule(kitPage, true);
    const appM = await measureAppSchedule(page, true);
    expect(appM.pill?.background).toBe(kitM.pill?.background);
    expect(appM.pill?.borderStyle).toBe(kitM.pill?.borderStyle);
    expect(appM.pill?.padding).toBe(kitM.pill?.padding);
    await kitPage.close();
  });
});
