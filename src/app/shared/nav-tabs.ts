import type { Route } from '@angular/router';
import type { UserRole } from '@app/model';

import { routes } from '../app.routes';
import type { RouteChromeData } from '../core';

export interface NavTab {
  id: string;
  labelKey: string;
  link: string;
  /** Roles allowed to see this tab. Absent = any authenticated role. */
  roles?: UserRole[];
  /** This tab belongs to the couple's Manage tool group (hub ADR-0045 §2/§3). */
  group?: 'manage';
  /**
   * This tab is the single visible face of its {@link group} — rendered as
   * an outlined "Manage" pill (hub ADR-0045 §3). Only ever set on the
   * synthesized group tab `collapseGroups()` emits, never on a raw route
   * tab, since a route's own screen identity and the group's door are
   * different `NavTab`s.
   */
  standout?: true;
}

// Order mirrors the DS AppShell nav model (commit 90246bd, updated for the
// five-cap IA, hub ADR-0045): a route cannot know it is third, so this stays
// an explicit constant — but as a list of ids, not hand-copied objects (hub
// ADR-0042 §6). `home` appears once even though two routes carry it
// (`/dashboard`, `/me`): role filtering guarantees only one is ever
// rendered. `manage` is not a route id — it is the synthesized group tab's
// id (`collapseGroups()`), placed last to match the DS's standout position.
const NAV_ORDER: readonly string[] = ['home', 'rsvp', 'schedule', 'album', 'people', 'seating', 'manage'];

/**
 * Walks the route tree once at module load, emitting one `NavTab` per route
 * whose `data` sets `tabBar` or `topNav` — `link` and `roles` come straight
 * off that route, so there is no separate lookup left to drift out of sync
 * with it (hub ADR-0042 §6). The previous `rolesForLink()` lookup failed
 * open on a path miss: it returned `undefined`, and `undefined` read as "no
 * role restriction" — a route rename that wasn't mirrored into a
 * hand-written `link` could put a couple-only screen in every guest's nav
 * (hub ADR-0029 §4.7).
 */
function collect(list: Route[]): NavTab[] {
  const tabs: NavTab[] = [];
  for (const route of list) {
    const data = route.data as RouteChromeData | undefined;
    if (route.path !== undefined && data?.navLabel !== undefined && (data.tabBar || data.topNav)) {
      tabs.push({
        id: data.id,
        labelKey: data.navLabel,
        link: `/${route.path}`,
        roles: data.roles,
        group: data.group,
        standout: data.standout,
      });
    }
    if (route.children) tabs.push(...collect(route.children));
  }
  return tabs;
}

/**
 * Splits the raw, per-route tabs `collect()` emits into the primary
 * per-role surface and each group's own member list (hub ADR-0045 §2/§3).
 * A grouped route never reaches the primary surface itself — only the
 * member flagged {@link RouteChromeData.standout} does, synthesized under
 * the group's own id (`manage`) and a `nav.<group>` label, carrying that
 * member's `link`/`roles` rather than its own. This is still a derivation
 * from the route tree, not a hand-written list (hub ADR-0042 §6): rename
 * the standout route's path and the synthesized tab's `link` follows it,
 * because it is read off the same object `collect()` built from `routes`.
 *
 * The group's member list is returned too so a later Manage area (T364)
 * can enumerate a group's screens — Overview/Guests/Milestones/Settings
 * today — by filtering on `group` instead of writing its own walk of
 * `routes`.
 */
function collapseGroups(tabs: NavTab[]): { primary: NavTab[]; members: Map<string, NavTab[]> } {
  const primary: NavTab[] = [];
  const members = new Map<string, NavTab[]>();
  const doors = new Map<string, NavTab>();

  for (const tab of tabs) {
    if (!tab.group) {
      primary.push(tab);
      continue;
    }
    const groupMembers = members.get(tab.group) ?? [];
    groupMembers.push(tab);
    members.set(tab.group, groupMembers);
    if (tab.standout) doors.set(tab.group, tab);
  }

  for (const [group, door] of doors) {
    primary.push({
      id: group,
      labelKey: `nav.${group}`,
      link: door.link,
      roles: door.roles,
      standout: true,
    });
  }

  return { primary, members };
}

const collected = collapseGroups(collect(routes));

export const NAV_TABS: NavTab[] = collected.primary.sort(
  (a, b) => NAV_ORDER.indexOf(a.id) - NAV_ORDER.indexOf(b.id),
);

/**
 * Every route tagged `group: 'manage'`, in declaration order — the
 * couple's Manage children (Overview/Guests/Milestones/Settings today) for
 * whichever future screen (T364) renders Manage's own rail/tab set. Not
 * consumed anywhere yet; exporting it here (rather than letting that
 * screen re-walk `routes`) keeps the route tree the single place a
 * group's membership is derived (hub ADR-0042 §6).
 */
export const MANAGE_GROUP_TABS: NavTab[] = collected.members.get('manage') ?? [];
