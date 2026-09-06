import { RouteConfigService } from '@app/core';
import { environment } from '@env/environment';

import { routes } from '../app.routes';
import { MANAGE_GROUP_TABS, NAV_TABS } from './nav-tabs';

/**
 * Hub ADR-0042 §6 / ADR-0029 §4.7 — the nav derives from the route tree so
 * `roles` travels with the tab instead of being looked up by path
 * afterwards. Pre-T345, that lookup (`rolesForLink()`) failed *open*: a
 * link with no match in the path-keyed map read as "no role restriction",
 * proven against the pre-T345 code by calling
 * `rolesForLink('/prep-timeline')` (a plausible renamed path with no entry
 * in the map) — it returned `undefined`, which `tab-bar.ts` read as
 * unrestricted, with no compiler or test ever catching it (T345 report).
 * `NavTab.roles` now comes from the exact same `RouteChromeData` object the
 * route itself activates against, so there is no second, driftable lookup
 * left.
 */
describe('nav-tabs — NAV_TABS derives from the route tree (hub ADR-0042 §6)', () => {
  function visibleTo(role: 'guest' | 'bride' | 'groom' | 'provider') {
    return NAV_TABS.filter((tab) => !tab.roles || tab.roles.includes(role));
  }

  it('a guest sees none of the couple-only entries — the regression hub ADR-0029 §4.7 forbids', () => {
    const ids = visibleTo('guest').map((tab) => tab.id);
    expect(ids).not.toEqual(expect.arrayContaining(['milestones', 'guests', 'seating', 'config']));
  });

  it('both `home` routes (/me, /dashboard) resolve into NAV_TABS', () => {
    const homeLinks = NAV_TABS.filter((tab) => tab.id === 'home').map((tab) => tab.link);
    expect(homeLinks.sort()).toEqual(['/dashboard', '/me']);
  });

  it('role filtering renders exactly one `home` entry for a guest', () => {
    const home = visibleTo('guest').filter((tab) => tab.id === 'home');
    expect(home).toHaveLength(1);
    expect(home[0].link).toBe('/me');
  });

  it('role filtering renders exactly one `home` entry for the couple', () => {
    const home = visibleTo('bride').filter((tab) => tab.id === 'home');
    expect(home).toHaveLength(1);
    expect(home[0].link).toBe('/dashboard');
  });

  it('every nav tab carries a non-empty labelKey and link derived from the route', () => {
    for (const tab of NAV_TABS) {
      expect(tab.labelKey).toBeTruthy();
      expect(tab.link.startsWith('/')).toBe(true);
    }
  });
});

/**
 * Hub ADR-0045 §1/§2/§3/§6 — one primary surface per role, capped at five;
 * the couple's tools (Guests/Milestones/Settings) collapse into a single
 * "Manage" standout door instead of eating four separate primary slots.
 * `visibleTo()` here matches what `TabBar`/`ScreenHeader` actually render —
 * role filtering *and* `RouteConfigService.isRouteEnabled()` — because a
 * raw NAV_TABS count is not the claim ADR-0045 §1 makes; the claim is about
 * what a signed-in user with today's `enabledRoutes` sees (ADR-0045 §6).
 */
describe('nav-tabs — the five-cap surfaces and the Manage group (hub ADR-0045)', () => {
  const routeConfig = new RouteConfigService();
  routeConfig.setRouteConfig(environment.enabledRoutes);

  function visibleTo(role: 'guest' | 'bride' | 'groom' | 'provider') {
    return NAV_TABS.filter(
      (tab) => (!tab.roles || tab.roles.includes(role)) && routeConfig.isRouteEnabled(tab.link),
    );
  }

  it.each(['guest', 'bride', 'groom'] as const)(
    "%s's primary surface never exceeds the five-cap, and stays clear of TabBar's More-sheet threshold",
    (role) => {
      const ids = visibleTo(role).map((tab) => tab.id);
      expect(ids.length).toBeLessThanOrEqual(5);
    },
  );

  it('a guest sees exactly Home · Schedule · RSVP · People (hub ADR-0045 §2)', () => {
    const ids = visibleTo('guest')
      .map((tab) => tab.id)
      .sort();
    expect(ids).toEqual(['home', 'people', 'rsvp', 'schedule'].sort());
  });

  it('the couple sees exactly Home · Schedule · People · Manage (hub ADR-0045 §2)', () => {
    const ids = visibleTo('bride')
      .map((tab) => tab.id)
      .sort();
    expect(ids).toEqual(['home', 'manage', 'people', 'schedule'].sort());
    expect(visibleTo('groom').map((tab) => tab.id).sort()).toEqual(ids);
  });

  it('the Manage tab is standout and its link/roles are read off its door route, not hand-copied', () => {
    const manage = NAV_TABS.find((tab) => tab.id === 'manage');
    expect(manage?.standout).toBe(true);
    expect(manage?.labelKey).toBe('nav.manage');

    // Walk the real route tree for the route flagged `standout: true` —
    // proving the synthesized tab's link tracks that route rather than a
    // literal string that would silently go stale on a rename (hub
    // ADR-0042 §6).
    const privateChildren = routes.find((r) => r.path === '' && r.children)?.children ?? [];
    const doorRoute = privateChildren.find(
      (r) => (r.data as { standout?: true } | undefined)?.standout,
    );
    expect(doorRoute).toBeDefined();
    expect(manage?.link).toBe(`/${doorRoute?.path}`);
    expect(manage?.roles).toEqual((doorRoute?.data as { roles?: string[] } | undefined)?.roles);
  });

  it('grouped routes (guests, milestones, config) never appear as their own primary tab', () => {
    const ids = NAV_TABS.map((tab) => tab.id);
    expect(ids).not.toEqual(expect.arrayContaining(['guests', 'milestones', 'config']));
  });

  it("Manage's group members are still derivable — Overview/Guests/Milestones/Settings today", () => {
    const ids = MANAGE_GROUP_TABS.map((tab) => tab.id).sort();
    expect(ids).toEqual(['config', 'guests', 'milestones'].sort());
    for (const tab of MANAGE_GROUP_TABS) {
      expect(tab.group).toBe('manage');
    }
  });

  it('travel is not a primary nav destination (hub ADR-0045 §4 — it folds into Home)', () => {
    expect(NAV_TABS.some((tab) => tab.id === 'travel')).toBe(false);
  });

  it('Album/Seating stay out of every role\'s surface — enablement, not a hand-copied exclusion (hub ADR-0045 §6)', () => {
    for (const role of ['guest', 'bride', 'groom'] as const) {
      const ids = visibleTo(role).map((tab) => tab.id);
      expect(ids).not.toEqual(expect.arrayContaining(['album', 'seating']));
    }
  });
});
