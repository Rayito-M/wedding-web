import type { UserRole } from '@app/model';

/**
 * Shape of `Route.data` for every screen under `PrivateLayout`. This is the
 * single source of truth for "who can reach this screen" — {@link rbacGuard}
 * reads `roles` straight off it, and nav chrome (`shared/nav-tabs.ts`,
 * `TabBar`, `ScreenHeader`) derives its own role filtering from the same
 * object by route path instead of repeating `roles` on `NavTab`.
 */
export interface RouteChromeData {
  /**
   * Id joining this route to its `NavTab` entry for active-tab highlighting.
   * Not unique: `home` deliberately labels two routes (`/dashboard`, `/me`) —
   * one per role — so role lookups must key off the route path, not this id.
   */
  id: string;
  /** Roles allowed to activate this route. Absent = any authenticated role. */
  roles?: UserRole[];
  /** Bottom tab bar entry on mobile (<900px). */
  tabBar?: boolean;
  /** Desktop nav entry in the screen header (>=900px). */
  topNav?: boolean;
  /** Decorative motorcycle-rider crossing above the mobile tab bar. */
  moto?: boolean;
}
