import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signInAsCouple, signInAsGuest } from '../support/auth';

/**
 * Layout-regression tier (T263) — the closing spec of Phase N (hub
 * ADR-0045, `tasks/30-phase-n-navigation-five-cap/`). T361-T365 built the
 * five-cap IA (`PlanRail`, route-data `group`/`standout`, the header/tab-bar
 * standout pill, Home's umbrella, and the es/en/fr labels); this is the e2e
 * proof the ADR's own §Consequences promises: every role's primary nav caps
 * at five with a visible active state, the Manage door opens and closes
 * cleanly on both breakpoints, `/travel` lands on the right Home section,
 * and the screens behind the new IA (RSVP, schedule, guests, milestones,
 * settings) still resolve.
 *
 * Two identities: `signInAsCouple` (bride, `e2e/support/auth.ts`, existing)
 * and `signInAsGuest` (new here, same real `/login` OTP flow, `opts.role:
 * 'guest'` in `installApiMocks` swapping which identity `**\/v1/auth/otp
 * /verify` hands back) — the guest primary surface (Home · Schedule · RSVP
 * · People, hub ADR-0045 §2) has no Manage door, so it needed its own
 * identity to reach at all; every earlier layout spec only ever signed in
 * the couple.
 *
 * Desktop/mobile are forced with `page.setViewportSize` (same convention as
 * `milestones.spec.ts`/`seating-plan.spec.ts`) rather than branched off the
 * project's own default viewport, so the header-nav and tab-bar assertions
 * below run identically under all five configured projects.
 */

const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** The plain header links plus the one standout pill, in DOM order — the
 *  whole primary surface `header nav.nav` renders for the signed-in role. */
function desktopNavItems(page: Page) {
  return page.locator('header nav.nav > .link, header nav.nav > .standout');
}

/** The mobile tab bar's own primary row (`.bar .tab`) — whichever tab set
 *  `PrivateLayout` currently binds (`NAV_TABS` outside Manage,
 *  `MANAGE_GROUP_TABS` inside it, hub ADR-0045 §3). */
function tabBarItems(page: Page) {
  return page.locator('.bar .tab');
}

test.describe('per-role primary nav caps at five, with a visible active state (hub ADR-0045 §1/§2)', () => {
  test('couple: desktop header nav', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signInAsCouple(page);
    await page.goto('/dashboard');

    const items = desktopNavItems(page);
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeLessThanOrEqual(5);

    // Exactly one active indicator — the plain link's dot-lit `.on`, or the
    // standout pill's own `.on` — never both, never zero.
    const activeCount = await page
      .locator('header nav.nav > .link.on, header nav.nav > .standout.on')
      .count();
    expect(activeCount).toBe(1);
    await expect(page.locator('header nav.nav > .link.on')).toHaveText('Home');

    // The couple's Manage door is visible in the primary surface, outlined
    // and not (yet) active.
    await expect(page.locator('header nav.nav > .standout')).toHaveText('Manage');
    await expect(page.locator('header nav.nav > .standout')).not.toHaveClass(/\bon\b/);
  });

  test('couple: mobile tab bar', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signInAsCouple(page);
    await page.goto('/dashboard');

    const tabs = tabBarItems(page);
    await expect(tabs.first()).toBeVisible();
    expect(await tabs.count()).toBeLessThanOrEqual(5);
    await expect(page.locator('.bar .tab.on')).toHaveCount(1);
    await expect(page.locator('.bar .tab.on')).toHaveText('Home');
    await expect(page.locator('.bar .tab.standout')).toHaveText('Manage');
  });

  test('guest: desktop header nav', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signInAsGuest(page);
    await page.goto('/me');

    const items = desktopNavItems(page);
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeLessThanOrEqual(5);
    await expect(page.locator('header nav.nav > .link.on')).toHaveCount(1);
    await expect(page.locator('header nav.nav > .link.on')).toHaveText('Home');

    // The guest surface (Home · Schedule · RSVP · People, hub ADR-0045 §2)
    // has no Manage door at all.
    await expect(page.locator('header nav.nav > .standout')).toHaveCount(0);
    const labels = (await items.allTextContents()).map((label) => label.trim());
    expect(new Set(labels)).toEqual(new Set(['Home', 'RSVP', 'Schedule', 'Contacts']));
  });

  test('guest: mobile tab bar', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signInAsGuest(page);
    await page.goto('/me');

    const tabs = tabBarItems(page);
    await expect(tabs.first()).toBeVisible();
    expect(await tabs.count()).toBeLessThanOrEqual(5);
    await expect(page.locator('.bar .tab.on')).toHaveCount(1);
    await expect(page.locator('.bar .tab.on')).toHaveText('Home');
    await expect(page.locator('.bar .tab.standout')).toHaveCount(0);
  });
});

test.describe('Manage in/out (hub ADR-0045 §3)', () => {
  test('desktop: PlanRail mounts for the Manage group, and Home exits it', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signInAsCouple(page);
    await page.goto('/overview');

    // Entering any `group: 'manage'` route (Overview is the door) mounts
    // the rail with the group's members — Overview/Guests/Milestones at
    // the top, Settings pinned to the foot (`private-layout.ts`'s
    // `manageRailItems`/`manageRailFooter`) — and marks the header's
    // standout pill active via group membership, not its own id.
    const railItems = page.locator('.manage-rail .rail-item');
    await expect(railItems).toHaveCount(4);
    await expect(railItems).toHaveText(['Overview', 'Guests', 'Milestones', 'Config']);
    await expect(page.locator('.manage-rail .rail-item.on')).toHaveText('Overview');
    await expect(page.locator('header nav.nav > .standout.on')).toHaveText('Manage');

    // Picking a different Manage member from the rail navigates and stays
    // inside Manage — the rail persists, now on Milestones.
    await railItems.filter({ hasText: 'Milestones' }).click();
    await page.waitForURL('**/milestones');
    await expect(page.locator('.manage-rail .rail-item.on')).toHaveText('Milestones');
    await expect(page.locator('header nav.nav > .standout.on')).toHaveText('Manage');

    // The plain "Home" nav link is the exit — it is not part of Manage, so
    // following it must close the rail entirely (it is `@if (inManage())`
    // in `private-layout.html`, not merely CSS-hidden).
    await page.locator('header nav.nav > .link', { hasText: 'Home' }).click();
    await page.waitForURL('**/dashboard');
    await expect(page.locator('.manage-rail')).toHaveCount(0);
    await expect(page.locator('header nav.nav > .link.on')).toHaveText('Home');
    await expect(page.locator('header nav.nav > .standout')).not.toHaveClass(/\bon\b/);
  });

  test('mobile: the tab set swaps to Manage, and "Back to app" exits it', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await signInAsCouple(page);
    await page.goto('/overview');

    // The primary tab set (Home/Schedule/Contacts/Manage) is replaced by
    // the Manage group's own members — no "you left Home" indicator other
    // than the tab set itself and the back row below.
    await expect(tabBarItems(page)).toHaveText(['Overview', 'Guests', 'Milestones', 'Config']);
    await expect(page.locator('.bar .tab.on')).toHaveText('Overview');

    const backRow = page.locator('.manage-back-row');
    await expect(backRow).toBeVisible();
    await expect(backRow).toContainText('Back to app');
    await expect(backRow).toContainText('Manage');

    await page.locator('.manage-back-row .back-link').click();
    await page.waitForURL('**/dashboard');

    await expect(page.locator('.manage-back-row')).toHaveCount(0);
    await expect(tabBarItems(page)).toHaveText(['Home', 'Schedule', 'Contacts', 'Manage']);
    await expect(page.locator('.bar .tab.on')).toHaveText('Home');
  });
});

test.describe('/travel redirects into Home (hub ADR-0045 §4)', () => {
  test('an old /travel deep link lands on Home with "Getting there" active', async ({ page }) => {
    await signInAsCouple(page);
    await page.goto('/travel');

    await page.waitForURL('**/dashboard?section=travel');
    await expect(page.locator('.pills .pill.on')).toHaveText('Getting there');
    // A genuine re-arrangement, not a stub: the same `Travel` screen that
    // used to own `/travel` is live under the pill, embedded (`travel.ts`'s
    // `embedded` input only skips its own `HeaderService.set()` call) —
    // proven via its own static copy, present regardless of seeded venue
    // data (this suite's `weddingConfigAdmin()` fixture seeds none).
    await expect(page.locator('.sub')).toHaveText('Fly to Granada (GRX) · 20 min to City Center.');
  });
});

test.describe('pre-existing journeys still resolve, unchanged by the new IA', () => {
  test('couple: schedule, guests, milestones and settings all load their own screen', async ({
    page,
  }) => {
    // The desktop header nav is used to reach `/schedule` below (the header
    // `.nav` is CSS-hidden below `900px`, `screen-header.scss`) — the point
    // of this test is that the screens still resolve, not to also re-prove
    // the mobile tab bar (already covered above).
    await page.setViewportSize(DESKTOP);
    await signInAsCouple(page);

    await page.locator('header nav.nav > .link', { hasText: 'Schedule' }).click();
    await page.waitForURL('**/schedule');
    await expect(page).toHaveTitle(/The day/);

    // Guests/Milestones/Settings are reached through Manage now (hub
    // ADR-0045 §3), not the primary nav — but the screens themselves are
    // untouched by this phase and must still resolve.
    await page.goto('/guests');
    await expect(page).toHaveTitle(/Guest manager/);

    await page.goto('/milestones');
    await expect(page).toHaveTitle(/Milestones/);

    await page.goto('/config');
    await expect(page).toHaveTitle(/Configuration/);
  });

  test('guest: RSVP and schedule both load their own screen', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await signInAsGuest(page);

    await page.locator('header nav.nav > .link', { hasText: 'RSVP' }).click();
    await page.waitForURL('**/rsvp');
    await expect(page).toHaveTitle(/RSVP/);

    await page.locator('header nav.nav > .link', { hasText: 'Schedule' }).click();
    await page.waitForURL('**/schedule');
    await expect(page).toHaveTitle(/The day/);
  });
});
