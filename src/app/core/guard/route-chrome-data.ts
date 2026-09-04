import type { UserRole } from '@app/model';

/**
 * Shape of `Route.data` for every screen under `PrivateLayout`. This is the
 * single source of truth for "who can reach this screen" — {@link rbacGuard}
 * reads `roles` straight off it, and nav chrome (`shared/nav-tabs.ts`,
 * `TabBar`, `ScreenHeader`) derives its `NavTab`s straight off the route tree
 * (hub ADR-0042 §6), carrying `roles`/`navLabel` on the tab itself rather
 * than looking either back up by path.
 */
interface RouteChromeDataBase {
  /**
   * Id joining this route to its `NavTab` entry for active-tab highlighting.
   * Not unique: `home` deliberately labels two routes (`/dashboard`, `/me`) —
   * one per role — so a `home` `NavTab` is emitted once per matching route.
   */
  id: string;
  /** Roles allowed to activate this route. Absent = any authenticated role. */
  roles?: UserRole[];
  /** Decorative motorcycle-rider crossing above the mobile tab bar. */
  moto?: boolean;
  /**
   * The screen's title/stat head stays pinned while its content scrolls
   * (hub ADR-0042 §1). A screen declares the pinned head with
   * `*appScreenHead` on the element that should render there;
   * `PrivateLayout` renders it via `ScreenChromeService` and yields scroll
   * ownership from `main` to `.screen-scroll` whenever this — or
   * {@link footPinned} — is `true`. Default: the screen's head scrolls with
   * the rest of its content (a "flow" screen, ADR-0041 §3).
   */
  headPinned?: boolean;
  /**
   * The screen has a bar below the scroll region that stays pinned (hub
   * ADR-0042 §1). Same mechanism as {@link headPinned}, via `*appScreenFoot`.
   */
  footPinned?: boolean;
}

/** Not a nav entry — `tabBar` and `topNav` are absent or `false`. */
interface NonNavRouteChromeData extends RouteChromeDataBase {
  tabBar?: false;
  topNav?: false;
  navLabel?: never;
}

/**
 * A nav entry — `tabBar` (bottom tab bar, <900px) and/or `topNav` (desktop
 * nav in the screen header, >=900px) is `true`. `navLabel`, the i18n key for
 * the nav entry (distinct from `title`, which names the page), is then
 * required: a missing label would otherwise make the entry silently vanish
 * from the nav instead of failing to compile (hub ADR-0042 §7).
 */
interface NavRouteChromeData extends RouteChromeDataBase {
  tabBar?: boolean;
  topNav?: boolean;
  navLabel: string;
}

export type RouteChromeData = NonNavRouteChromeData | NavRouteChromeData;
