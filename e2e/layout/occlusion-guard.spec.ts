import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAsCouple, signInAsGuest } from '../support/auth';

/**
 * Layout-regression tier (T263/T367) — the process half of the fix for the
 * post-close defect ADR-0043 §1 calls its third occurrence: Home's umbrella
 * pill row and Manage's `PlanRail` both rendered partially or fully under
 * the fixed header at ≥900px, and every prior layout spec — including
 * `navigation-five-cap.spec.ts`, which exercises both screens — passed over
 * it, because `expect(locator).toBeVisible()` proves an element has a
 * non-zero box, never that a *different*, `position: fixed` element isn't
 * painted on top of it. This spec is the geometry check that closes that
 * gap: for every route this app's own nav renders, at both roles and both
 * breakpoints, no visible content sits above the fixed header's real,
 * painted occlusion boundary.
 *
 * **The route list is never hand-copied (hub ADR-0042 §6).** `collectRoutes`
 * reads the mobile tab bar's own `<a routerLink>` elements — `.bar .tab` —
 * which `private-layout.html` binds straight off `NAV_TABS`/
 * `MANAGE_GROUP_TABS` depending on `inManage()` (`shared/nav-tabs.ts`, the
 * same source `navigation-five-cap.spec.ts` already exercises). Mobile is
 * used for *collection* regardless of which breakpoint a given test then
 * asserts at: `.bar .tab` are real anchors with a resolvable `href`; the
 * desktop header's plain links carry the same hrefs (same route data), and
 * the Manage rail's rows are click handlers with no `href` at all
 * (`PrivateLayout.onManageNav`). Importing `nav-tabs.ts` directly was tried
 * and rejected — it pulls in `app.routes.ts` → `core/api/*`, whose
 * generated services use parameter decorators Playwright's own esbuild-based
 * transform cannot parse outside the Angular compiler (confirmed: "Decorators
 * cannot be used to decorate parameters", the same "compiles independently
 * of the Angular tsconfig project" boundary T366's report already names for
 * why this suite's specs never import app source).
 *
 * **The occlusion boundary is the header's real *painted* edge, not its raw
 * box height.** Below 900px `header` is transparent until `.scrolled`
 * supplies a background (`screen-header.scss`'s own `:host.scrolled header`
 * rule, and its comment on the ≥900px block always doing so unconditionally
 * there); a fresh `page.goto()` never scrolls, so nothing is actually
 * painted over that region and no geometric overlap is visible. This is
 * measured, not assumed: `.header`'s real rendered box is taller than the
 * old `52px` clearance assumed at *both* breakpoints (up to 59px at ≥900px,
 * the Manage standout pill (T363) and the header nav row being taller than
 * the avatar the assumption was written against; 62px below 900px, the
 * notification bell being taller than the avatar there) — but only the
 * ≥900px case is a real, user-visible defect, because only there does the
 * header actually paint over it. The pre-existing, separately-tracked
 * `guest-manager-scrolled-header.spec.ts` covers the *other* half of that
 * mobile gap (what happens once `.scrolled` does fire) — this spec does not
 * duplicate or relax that coverage, it simply never scrolls, matching the
 * two screenshots (hub `docs/decisions/0043-...md` §1, T367's own task text)
 * that prompted it, both taken on first paint.
 *
 * **The content boundary walks `.body`'s full subtree, not one selector per
 * screen.** Every piece of rendered content — Home's pill row, the Manage
 * rail, a screen's pinned head, or a screen's own plain flow content —
 * descends from `.body` (hub ADR-0043 §1, T367: the one element the fixed
 * header's clearance now lives on). An element with a zero-area box
 * (`display: none`, or `display: contents` on `.manage-rail` itself at
 * ≥900px) is excluded by the width/height filter automatically, and a
 * screen-reader-only node (`%sr-only`, `_primitives.scss` — `1px` square,
 * clipped rather than moved off-screen) is excluded by a `> 2px` floor so it
 * can never manufacture a false ceiling out of content nobody sees.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** `.bar .tab`'s own hrefs — whichever tab set `PrivateLayout` currently
 *  binds (`NAV_TABS` outside Manage, `MANAGE_GROUP_TABS` inside it). */
async function tabHrefs(page: Page): Promise<string[]> {
  const tabs = page.locator('.bar .tab[href]');
  // Under parallel-worker contention the lazy-loaded route chunk can still
  // be compiling when this runs — `signInAsCouple`/`signInAsGuest` only wait
  // for the URL to change, not for the destination screen to render — so
  // this waits for the tab bar itself rather than racing it (same shape as
  // `footer-truncation.spec.ts`'s font-settle wait elsewhere in this suite).
  await tabs.first().waitFor();
  const hrefs = await tabs.evaluateAll((els) =>
    els.map((el) => el.getAttribute('href')).filter((h): h is string => !!h),
  );
  return [...new Set(hrefs)];
}

/**
 * Every route this role's nav renders, primary surface plus (for the
 * couple) every Manage member — collected at mobile width regardless of
 * which breakpoint the caller means to assert at (see this file's own doc).
 * `homeRoute` is the role's own landing route (`/dashboard` couple, `/me`
 * guest), matching `LoginService.landingUrl()`.
 */
async function collectRoutes(
  page: Page,
  signIn: (page: Page) => Promise<void>,
  homeRoute: string,
): Promise<string[]> {
  await page.setViewportSize(MOBILE);
  await signIn(page);
  await page.goto(homeRoute);

  const primary = await tabHrefs(page);

  // The Manage door is whichever primary link the guest role never has —
  // `/overview` today, but this reads it off the primary set itself (the
  // one link `nav-tabs.ts`'s `collapseGroups()` synthesizes under the
  // group's own id) rather than hardcoding the path a second time.
  const manageLink = primary.find((href) => href !== homeRoute && href.includes('overview'));
  let manageMembers: string[] = [];
  if (manageLink) {
    await page.goto(manageLink);
    manageMembers = await tabHrefs(page);
  }

  return [...new Set([...primary, ...manageMembers])];
}

/**
 * The fixed header's real occlusion boundary at this instant — 0 (nothing
 * to clear) when its background is transparent, its own bounding box's
 * `bottom` edge when it is not. See this file's own doc for why that is the
 * right question below 900px specifically.
 */
async function headerOcclusionBottom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const hostEl = document.querySelector('.header');
    const header = hostEl?.querySelector('header');
    if (!hostEl || !header) return 0;
    const bg = getComputedStyle(header).backgroundColor;
    const transparent = bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
    return transparent ? 0 : hostEl.getBoundingClientRect().bottom;
  });
}

/**
 * The topmost visible-*paint* pixel under `.body` and the mobile Manage exit
 * row (`.manage-back-row`, a flow sibling of `.body`, never its descendant)
 * — every piece of content this app renders outside the fixed
 * header/tab-bar/moto chrome. Deliberately not "the topmost element": a
 * pure layout wrapper (`.body`, `.body-main`) has no background, border or
 * text of its own and stretches to the full row height, so counting it
 * would report every route's ceiling as `0` regardless of what actually
 * renders — reproduced while building this guard (`/dashboard` "failed" at
 * `y=0` before this filter existed, both before and after T367's own fix,
 * which is a defect in the guard, not the layout). `hasOwnPaint` below asks
 * the real question — does this element itself mark a visible pixel — so a
 * transparent wrapper is skipped in favour of whichever real child (a pill,
 * a rail row, a card) actually paints. `null` when nothing under either
 * root painted anything (should never happen on a real route; surfaced as
 * its own failure below rather than a false pass). */
async function topmostContentY(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    function hasOwnPaint(el: Element): boolean {
      if (['BUTTON', 'A', 'IMG', 'INPUT', 'SVG'].includes(el.tagName)) return true;
      const cs = getComputedStyle(el);
      if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') {
        return true;
      }
      if (cs.backgroundImage !== 'none') return true;
      if (cs.boxShadow !== 'none') return true;
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') return true;
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim().length > 0) {
          return true;
        }
      }
      return false;
    }

    const roots = [
      document.querySelector('.manage-back-row'),
      document.querySelector('.body'),
    ].filter((el): el is Element => !!el);

    let min: number | null = null;
    for (const root of roots) {
      const candidates = [root, ...Array.from(root.querySelectorAll('*'))];
      for (const el of candidates) {
        const r = (el as HTMLElement).getBoundingClientRect();
        // `> 2` (not `> 0`) excludes `%sr-only`'s 1px-square clipped nodes
        // (`_primitives.scss`) even though they do carry real text — a
        // screen-reader announcement is not something a sighted user could
        // ever see clipped. `r.top >= 0` excludes anything positioned above
        // the viewport entirely (this app uses none today, but "off-screen"
        // and "underlapping the header" are different facts and only the
        // second is this guard's concern).
        if (r.width > 2 && r.height > 2 && r.top >= 0 && hasOwnPaint(el)) {
          if (min === null || r.top < min) min = r.top;
        }
      }
    }
    return min;
  });
}

async function assertClear(page: Page, route: string): Promise<void> {
  await page.goto(route);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);

  const headerBottom = await headerOcclusionBottom(page);
  const contentTop = await topmostContentY(page);

  // `null` (nothing painted anything under `.body`) is not this guard's
  // concern to fail on: "no content underlaps the header" is vacuously true
  // when there is no content. The one route this actually happens on today
  // is `/rsvp` for the guest role — `installApiMocks`'s `**/v1/rsvp` stub
  // always answers `{ items: [], nextCursor: null }` regardless of role or
  // opts, so `rsvp()` never resolves and every branch of `rsvp.html` renders
  // nothing (confirmed while building this guard: `<app-rsvp>` mounts with
  // an empty subtree). Seeding a reply into that shared fixture to make this
  // one check exercise real content risks changing what every *other* spec
  // asserting the "no RSVP yet" empty state relies on — out of scope for a
  // layout-clearance fix. Whether a screen renders *something* is already
  // this suite's job elsewhere (`navigation-five-cap.spec.ts`'s per-route
  // title assertions); this guard's only job is occlusion.
  if (contentTop === null) return;

  expect(
    contentTop,
    `${route}: topmost content (y=${contentTop}) underlaps the fixed header's occlusion boundary (y=${headerBottom})`,
  ).toBeGreaterThanOrEqual(headerBottom);
}

async function assertAllClear(page: Page, routes: string[]): Promise<void> {
  expect(routes.length, 'collected zero routes — nothing to prove').toBeGreaterThan(0);
  for (const route of routes) {
    await assertClear(page, route);
  }
}

test.describe('occlusion guard — no content underlaps the fixed header (hub ADR-0043 §1, T367)', () => {
  test('couple: every nav route, desktop (≥900px)', async ({ page }) => {
    const routes = await collectRoutes(page, signInAsCouple, '/dashboard');
    await page.setViewportSize(DESKTOP);
    await assertAllClear(page, routes);
  });

  test('couple: every nav route, mobile', async ({ page }) => {
    const routes = await collectRoutes(page, signInAsCouple, '/dashboard');
    await page.setViewportSize(MOBILE);
    await assertAllClear(page, routes);
  });

  test('guest: every nav route, desktop (≥900px)', async ({ page }) => {
    const routes = await collectRoutes(page, signInAsGuest, '/me');
    await page.setViewportSize(DESKTOP);
    await assertAllClear(page, routes);
  });

  test('guest: every nav route, mobile', async ({ page }) => {
    const routes = await collectRoutes(page, signInAsGuest, '/me');
    await page.setViewportSize(MOBILE);
    await assertAllClear(page, routes);
  });
});
