import type { UserRole } from '@app/model';

/**
 * Shape of `Route.data` for every screen under `PrivateLayout`. This is the
 * single source of truth for "who can reach this screen" — {@link rbacGuard}
 * reads `roles` straight off it, and nav chrome (`shared/nav-tabs.ts`,
 * `TabBar`, `ScreenHeader`) derives its `NavTab`s straight off the route tree
 * (hub ADR-0042 §6), carrying `roles`/`navLabel` on the tab itself rather
 * than looking either back up by path. `group`/`standout` (hub ADR-0045)
 * carry the same discipline forward for the couple's Manage tool group —
 * membership and the group's single nav-visible door are route facts, not a
 * second hand-written list.
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
   * `*appScreenHead` on the element that should render there; `PrivateLayout`
   * renders it via `ScreenChromeService`. Default: no pinned head — nothing
   * registers, `.screen-head` never renders.
   *
   * **Does not decide scroll ownership** (hub ADR-0043 §1/§2, amending
   * ADR-0042 §2). Set this only when the screen actually registers
   * `*appScreenHead` — a route that sets it without registering a head is
   * inert (`PrivateLayout`'s `after-head` class follows
   * `ScreenChromeService.head()`, not this flag), not broken, but it is
   * still a lie about what the screen does. See {@link screenScroll} for who
   * scrolls.
   */
  headPinned?: boolean;
  /**
   * The screen has a bar below the scroll region that stays pinned (hub
   * ADR-0042 §1). Same mechanism as {@link headPinned}, via `*appScreenFoot`.
   *
   * **Does not decide scroll ownership** — same amendment as
   * {@link headPinned}. A screen that pins nothing never declares this key
   * (hub ADR-0043 §2): it does not exist to "make `main` yield".
   */
  footPinned?: boolean;
  /**
   * Who owns vertical scrolling on this screen (hub ADR-0043 §1, amending
   * ADR-0042 §2/§4; ADR-0041 §3 for the single-scroller rule itself).
   * Independent of {@link headPinned}/{@link footPinned} — pinning a region
   * and owning the scroller are two different facts that happen to coincide
   * on some screens (e.g. `guest-manager`) and not on others (`milestones`).
   *
   * - Absent — **flow**: `main` scrolls. The default, and most screens.
   * - `true` — **shell at every breakpoint**: `.screen-scroll` scrolls,
   *   `main` yields (`overflow-y: clip`).
   * - `'md' | 'lg' | 'xl'` — flow below that breakpoint, shell from it up.
   *   Must match one of `_layout.scss`'s `$bp-md`/`$bp-lg`/`$bp-xl` names
   *   exactly — a typo is a compile error, not a screen that silently stays
   *   flow.
   */
  screenScroll?: true | 'md' | 'lg' | 'xl';
  /**
   * This route belongs to the couple's **Manage** tool group (hub ADR-0045
   * §2/§3/§6). Grouped routes keep their own `navLabel` (it names the
   * screen inside Manage's future rail/tab set — T364) but `nav-tabs.ts`
   * excludes every grouped route from the primary per-role surface: only
   * the group's {@link standout} member represents the whole group there,
   * as the single "Manage" door. This key marks membership, not
   * visibility — it is what lets a later Manage area enumerate its
   * children by walking the route tree instead of hand-copying a list
   * (hub ADR-0042 §6).
   */
  group?: 'manage';
  /**
   * This route is the single visible face of its {@link group} in the
   * primary nav — rendered as an outlined "Manage" pill (hub ADR-0045 §3,
   * DS `AppHeader.standoutId` / `TabBar` standout). Exactly one route per
   * group should set this. `nav-tabs.ts` takes only this route's
   * `link`/`roles` to synthesize the group's `NavTab`, under the group's
   * own id and a `nav.<group>` label — **not** this route's own `id` or
   * `navLabel`, which keep naming the screen itself for when Manage's own
   * sub-nav (T364) is built.
   */
  standout?: true;
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
