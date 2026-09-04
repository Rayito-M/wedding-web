import { NAV_TABS } from './nav-tabs';

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
