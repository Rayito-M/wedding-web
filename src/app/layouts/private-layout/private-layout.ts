import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  Signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';

import {
  AppJwtClaimsDto,
  EntityNamesEnum,
  LoginService,
  ProfileModalService,
  RouteChromeData,
  ScreenChromeService,
  ToastCenterService,
  UserProfileDto,
  WeddingUserProfileService,
} from '@app/core';
import { CONFIG_SECTION_PARAM, SECTIONS as CONFIG_SECTIONS } from '@app/shared/config-sections';
import { MANAGE_GROUP_TABS, NAV_TABS } from '@app/shared/nav-tabs';
import { PlanRail, type PlanRailItem } from '@app/shared/plan-rail/plan-rail';

import { DecorMotorcycleRider } from '../../shared/decor/motorcycle-rider/motorcycle-rider';
import { DelegateChip } from '../../shared/delegate-chips/delegate-chips';
import { ProfileModal } from '../../shared/profile-modal/profile-modal';
import { ScreenHeader } from '../../shared/screen-header/screen-header';
import { TabBar } from '../../shared/tab-bar/tab-bar';
import { Toast } from '../../shared/toast/toast';
import { ToastStack } from '../../shared/toast-stack/toast-stack';

/**
 * Chrome flags read from the active child route's `data` — the shared
 * `RouteChromeData` shape, `Partial` because the deepest snapshot route can be
 * one without any (the layout route itself, before a child activates).
 * Deliberately *not* a local re-declaration: the previous one spelled the
 * nav-tab id `tab`, so `chrome().tab` was always `undefined` and no tab ever
 * highlighted.
 */
type RouteChrome = Partial<RouteChromeData>;

/**
 * Shell for the authenticated ("private") zone: renders the shared screen
 * header (which carries the desktop nav ≥900px) and the mobile tab-bar around a
 * `<router-outlet>`. Which chrome shows is driven by the active child route's
 * `data` (`tab`, `tabBar`, `topNav`).
 *
 * Also mounts the app's toast stacks (T285) — one `app-toast-stack` per
 * placement `ToastCenterService.stacks()` currently holds toasts for, so a
 * toast survives navigation between private screens. Every stack is asked to
 * clear the mobile tab bar; `clearsTabBar` is a no-op on any placement the
 * bar cannot cover (`toast-stack.scss`). Producers pick a placement per
 * toast, defaulting to `bottom-center`. There is no stack on the public/auth
 * shell.
 *
 * Also mounts the "My profile" overlay (T304) — `app-profile-modal`,
 * conditionally on `ProfileModalService.isOpen()`, the same shell-level
 * pattern as the toast stacks. This replaces the old `/profile` route:
 * `ScreenHeader`'s account dropdown and `People`'s "isMine" card both open it
 * via `ProfileModalService.open()` instead of navigating.
 *
 * **Owns the real write (T305).** `app-profile-modal` itself never touches
 * `HttpClient`/`EntityCollectionService` (see its own class doc) — this
 * layout resolves whichever profile `ProfileModalService.targetUserId()`
 * points at, defaulting to the signed-in user's own (`LoginService
 * .currentUserClaims()?.sub`), against the shared `EntityNamesEnum
 * .USER_PROFILE` collection, and is the consumer that calls
 * `EntityCollectionService.update()` on `(save)`, reporting the outcome back
 * through the modal's `saving`/`saveError` inputs (ADR W-0006 Decision 4).
 * The signed-in user's own profile is guaranteed cached before this modal
 * can open — `ScreenHeader` is unconditionally mounted above in this same
 * template and already loads it into this same shared collection in its own
 * `ngOnInit`. A partner's profile is not pre-loaded anywhere in a guest's own
 * session, so a `constructor()` `effect()` fetches it (`getByKey()`) the
 * first time `ProfileModalService.targetUserId()` points at an id not
 * already present in the cache.
 *
 * **Also resolves the delegate-chip names (hub ADR-0039 §6, T336).**
 * `UserProfileDto.delegateTo` now carries `{id, kind}` pairs only; this
 * layout maps each id to a display name — from `profiles()` when already
 * cached, otherwise via a second `constructor()` `effect()` doing a targeted
 * `POST /v1/profile` lookup — and hands `app-profile-modal` the fully
 * resolved `delegateChips()`, the same "host resolves it, modal only
 * renders it" split `profile`/`save` already use. `showsDelegation()` —
 * `isOwnProfile() && isGuest()` — is the single gate for that list and for
 * the modal's `[canHaveDelegates]`, so the chips and the section framing
 * them can never disagree. Two independent reasons, neither of which is
 * "the array happens to be non-empty": the API populates `delegateTo` on
 * *every* profile a couple viewer reads, not only their own, so the field's
 * mere presence is never read as permission to render it (CLAUDE.md hard
 * rule 16's `lastSeen` reasoning); and delegation is a guest-only relation
 * (ADR-0039 §1 omits `delegateTo` from the bride/groom/provider documents),
 * so the couple must not see even its empty state.
 *
 * **Owns the pinned regions (hub ADR-0042 §2, T341).** Renders whichever
 * `TemplateRef`s `ScreenChromeService.head()`/`foot()` currently hold — a
 * screen registers one via `*appScreenHead` / `*appScreenFoot` on an element
 * in its own template (e.g. `guest-manager`'s `<header class="header">` and
 * `.list-footer`), and this layout projects them via `NgTemplateOutlet`.
 *
 * **Pinning and scroll ownership are separate facts (hub ADR-0043).**
 * Whether a head/foot renders is driven by `ScreenChromeService.head()`/
 * `foot()` (the directive registration) alone. Whether `main` yields
 * scrolling to `.screen-scroll` is driven by the active route's
 * `screenScroll` alone — absent (flow, `main` scrolls), `true` (shell at
 * every breakpoint) or a breakpoint name (flow below it, shell from it up).
 * The two used to be conflated in one `pinned()` flag; ADR-0043 §1–§3
 * withdraws that — a route can pin a head with no `screenScroll`
 * (`guest-manager`, which owns no scroll container of its own and is
 * correctly flow), or declare `screenScroll` while pinning nothing
 * (`config-manager`). `main`'s `after-head` class (52px fixed-header
 * clearance) follows `screenChrome.head()` for the same reason: the
 * clearance belongs to whichever element actually renders it, not to a
 * route flag that could be set without a registered head. See
 * `private-layout.scss` for the CSS side (the closed four-variant set) and
 * `screen-chrome.spec.ts` for the coverage — registration/placement,
 * change-detection and guarded-clear teardown were proven zoneless-safe by
 * the T341 prototype gate (ADR-0042 §Gate outcome, `screen-chrome-prototype
 * .spec.ts`) before this shipped.
 *
 * **Also owns scrolling a screen back to the top on request** (hub
 * ADR-0042 §Consequences, T348). `ScreenChromeService.scrollResetRequest()`
 * is a bare counter a screen bumps via `requestScrollReset()`; a
 * `constructor()` `effect()` here reads it and resets both `main` and
 * `.screen-scroll` to `{ top: 0 }`. Deliberately unconditional rather than
 * picking one by a flag: which element actually owns scrolling is now a
 * per-breakpoint CSS fact (`screenScroll: 'lg'` and friends, hub ADR-0043
 * §1/§4), not a route-static boolean this layout could evaluate correctly in
 * TypeScript without re-implementing `respond-to()`'s media queries.
 * Resetting the element that is not the active scroller is a harmless
 * no-op — it is either `overflow: clip` (nothing to scroll) or
 * `display: contents` (no box at all). This is the "control" half of the
 * same gap the head/foot slots close for "chrome": once a screen hands its
 * scroller to this layout, it can no longer zero that element's own
 * `scrollTop` directly.
 */
@Component({
  selector: 'app-private-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    ScreenHeader,
    TabBar,
    ToastStack,
    Toast,
    DecorMotorcycleRider,
    ProfileModal,
    NgTemplateOutlet,
    PlanRail,
    TranslatePipe,
  ],
  templateUrl: './private-layout.html',
  styleUrl: './private-layout.scss',
})
export class PrivateLayout {
  private readonly router = inject(Router);
  private readonly login = inject(LoginService);
  protected readonly toastCenter = inject(ToastCenterService);
  protected readonly profileModal = inject(ProfileModalService);

  /**
   * Hub ADR-0042 §2, T341 — the screen-registered pinned head/foot,
   * rendered here via `NgTemplateOutlet`. See `ScreenChromeService`'s own
   * class doc for why this is a service and not an NgRx slice.
   */
  protected readonly screenChrome = inject(ScreenChromeService);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  /** Snapshot of the shared `UserProfileDto` collection, typed for
   *  consistency with `app-profile-modal`'s own `profile` input (not
   *  `UserDto`, which `screen-header.ts` uses for the same collection). */
  private readonly profiles: Signal<UserProfileDto[]> = toSignal(
    this.userProfileCollection.entities$,
    { initialValue: [] },
  );

  /** Whichever profile `ProfileModalService.targetUserId()` points at,
   *  defaulting to the signed-in user's own (ADR W-0006 Decision 4) — never
   *  hardcoded to "self" the way the pre-T317 `ownProfile` was. */
  protected readonly resolvedProfile: Signal<UserProfileDto | undefined> = computed(() => {
    const targetId = this.profileModal.targetUserId() ?? this.login.currentUserClaims()?.sub;
    return targetId ? this.profiles().find((p) => p.id === targetId) : undefined;
  });

  /**
   * `true` exactly when this modal shows the signed-in guest's own account —
   * the one explicit signal `app-profile-modal`'s `[isOwnProfile]` input and
   * the delegation-chip gate below both key on. **Never** gate on whether
   * `resolvedProfile()?.delegateTo` happens to be present: the API populates
   * that field on *every* profile a couple viewer reads, not only their own
   * (hub ADR-0039, T336's own instruction — the same `lastSeen` reasoning as
   * CLAUDE.md hard rule 16, applied to a second field). Single source of
   * truth for both the template's `[isOwnProfile]` binding and `delegateChips`
   * below, so the two can never disagree about which profile this is.
   */
  protected readonly isOwnProfile = computed(() => !this.profileModal.targetUserId());

  /**
   * `true` exactly when the signed-in user is a guest — read from the JWT's
   * `role` claim (ADR-0013) through `LoginService`, deliberately **not**
   * from `resolvedProfile()?.role`: the profile document is the thing being
   * gated, and its `role` field is on its way off the user schemas, so a
   * permission gate must not key on it.
   *
   * Delegation is a guest-only relation: hub ADR-0039 §1 keeps `delegateTo`
   * off `BrideDocumentSchema`, `GroomDocumentSchema` and
   * `ProviderDocumentSchema` — "the couple and providers cannot *have*
   * delegates". A couple member opening their own profile must therefore see
   * no delegation surface at all, not even the "Nobody answers for you"
   * empty state, which would describe an arrangement they can never have.
   */
  protected readonly isGuest = computed(() => this.login.role() === AppJwtClaimsDto.RoleEnum.GUEST);

  /** The one gate for the whole "who answers your RSVP" surface: the
   *  signed-in user's own profile (`isOwnProfile`), and only when that user
   *  is a guest (`isGuest`). Drives both the resolution below and the
   *  modal's `[canHaveDelegates]` input. */
  protected readonly showsDelegation = computed(() => this.isOwnProfile() && this.isGuest());

  /**
   * Delegate ids on the own guest profile (hub ADR-0039 §6, T336) whose name isn't
   * in `profiles()` (the shared, already-loaded collection) yet — a guest's
   * own session rarely has anyone but themself and a linked partner cached,
   * so this is the common case, not an edge case. The effect below resolves
   * them through the targeted `POST /v1/profile` lookup rather than bulk-
   * loading the whole collection just to read a few names.
   */
  private readonly missingDelegateIds = computed<string[]>(() => {
    if (!this.showsDelegation()) return [];
    const entries = this.resolvedProfile()?.delegateTo ?? [];
    if (entries.length === 0) return [];
    const known = new Set(this.profiles().map((p) => p.id));
    const fetched = this.fetchedDelegateNames();
    return entries.map((d) => d.id).filter((id) => !known.has(id) && !fetched.has(id));
  });

  /**
   * The targeted fallback's results — `null` for an id the API confirmed it
   * cannot resolve (never re-fetched again, so a stale/deleted delegate id
   * doesn't retry forever), a display name otherwise. Deliberately not
   * merged into `userProfileCollection`: these are one-off reads for a chip
   * label, not profiles this session otherwise cares about.
   */
  private readonly fetchedDelegateNames = signal<Map<string, string | null>>(new Map());

  private readonly userProfileApi = inject(WeddingUserProfileService);

  /** `<app-profile-modal>`'s `[delegateChips]` (T336) — resolved here, never
   *  inside the modal itself (its own class doc: no `HttpClient`, no
   *  `EntityCollectionService`). An id neither `profiles()` nor the fallback
   *  fetch could resolve degrades to `name: ''`; `app-delegate-chips` itself
   *  renders that as the kind alone, never a blank chip. */
  protected readonly delegateChips = computed<DelegateChip[]>(() => {
    if (!this.showsDelegation()) return [];
    const entries = this.resolvedProfile()?.delegateTo ?? [];
    if (entries.length === 0) return [];
    const byId = new Map(this.profiles().map((p) => [p.id, p]));
    const fetched = this.fetchedDelegateNames();
    return entries.map((entry) => {
      const known = byId.get(entry.id);
      const name = known
        ? `${known.firstName} ${known.lastName}`.trim()
        : (fetched.get(entry.id) ?? '');
      return { id: entry.id, kind: entry.kind, name };
    });
  });

  protected readonly savingProfile = signal(false);
  protected readonly profileSaveError = signal(false);

  @ViewChild('mainContent') private mainContent?: ElementRef<HTMLElement>;
  @ViewChild('screenScroll') private screenScrollContent?: ElementRef<HTMLElement>;
  protected readonly isScrolled = signal(false);

  // Seed from the current route: this layout mounts *after* the NavigationEnd
  // that activated it, so the stream alone would miss the first value.
  protected readonly chrome = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.deepestChrome()),
    ),
    { initialValue: this.deepestChrome() },
  );

  /**
   * Entering a `group: 'manage'` route swaps desktop to `PlanRail` and
   * mobile to the Manage tab set, with a "← Back to app" exit above the
   * content (hub ADR-0045 §3) — this is the one flag both halves of that
   * swap read. Deliberately **not** a second chrome mechanism (ADR-0045 §3's
   * own warning): it is `chrome().group`, the same route-data fact
   * `nav-tabs.ts` already reads to keep grouped routes out of the primary
   * nav, just consumed here for the layout swap instead of tab collapsing.
   */
  protected readonly inManage = computed(() => this.chrome().group === 'manage');

  protected readonly NAV_TABS = NAV_TABS;
  protected readonly MANAGE_GROUP_TABS = MANAGE_GROUP_TABS;

  /** Where "← Back to app" and the Manage door's own active state exit to —
   *  the signed-in role's own Home tab, read off `NAV_TABS` rather than
   *  hardcoded `/dashboard`/`/me` so a route rename can't silently strand
   *  the exit (hub ADR-0042 §6, the same reasoning `nav-tabs.ts` itself
   *  documents for why it walks the route tree instead of hand-copying). */
  protected readonly manageHomeLink = computed(() => {
    const role = this.login.role();
    return (
      NAV_TABS.find((tab) => tab.id === 'home' && (!tab.roles || tab.roles.includes(role)))
        ?.link ?? '/'
    );
  });

  /** `PlanRail`'s top-level items — every Manage member except Settings,
   *  which is pinned to the rail foot with its sections nested beneath it
   *  (hub ADR-0045 §3, DS `PlanRail`'s own `MANAGE_RAIL`/footer split). */
  protected readonly manageRailItems = computed<PlanRailItem[]>(() =>
    MANAGE_GROUP_TABS.filter((tab) => tab.id !== 'config').map((tab) => ({
      id: tab.id,
      labelKey: tab.labelKey,
    })),
  );

  /** Settings, alone, at the rail foot — its seven sections nest beneath it
   *  only while it is the active item (`PlanRail`'s own anatomy), sourced
   *  from `config-sections.ts` rather than a second hand-typed list. */
  protected readonly manageRailFooter = computed<PlanRailItem[]>(() => {
    const config = MANAGE_GROUP_TABS.find((tab) => tab.id === 'config');
    if (!config) return [];
    return [
      {
        id: config.id,
        labelKey: config.labelKey,
        sections: CONFIG_SECTIONS,
      },
    ];
  });

  /** `config-manager`'s own active section (`?section=`, `CONFIG_SECTION_PARAM`)
   *  — read the same way {@link chrome} is, seeded on mount and refreshed on
   *  every `NavigationEnd`, so the rail's nested Settings sections track
   *  `config-manager`'s section-controlled state (T364) without a second
   *  source of truth for "which section is active". Meaningless (and
   *  harmless) on any other route — `PlanRail` only renders it under the
   *  active item's own nested list. */
  protected readonly manageActiveSection = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.currentQueryParam(CONFIG_SECTION_PARAM)),
    ),
    { initialValue: this.currentQueryParam(CONFIG_SECTION_PARAM) },
  );

  constructor() {
    // The "control" half of ADR-0042 §Consequences (T348): a screen that no
    // longer owns its scroller asks this layout to scroll it back to the
    // top instead (`ScreenChromeService.requestScrollReset()`), the same
    // shape as handing over a head/foot template. Resets both `main` and
    // `.screen-scroll` unconditionally (hub ADR-0043) — see this class's own
    // doc for why picking one by a route-static flag is no longer correct
    // now that scroll ownership can be per breakpoint.
    effect(() => {
      this.screenChrome.scrollResetRequest();
      this.mainContent?.nativeElement.scrollTo({ top: 0 });
      this.screenScrollContent?.nativeElement.scrollTo({ top: 0 });
    });

    // Fresh save state on every (re)open — otherwise a stale error/saving
    // flag from a previous session with the modal could leak into a new one
    // (this layout, unlike `app-profile-modal`, is never destroyed/remounted
    // between opens).
    effect(() => {
      if (this.profileModal.isOpen()) {
        this.savingProfile.set(false);
        this.profileSaveError.set(false);
      }
    });

    // A partner's profile is never pre-loaded anywhere in a guest's own
    // session (unlike the self case, guaranteed cached by `ScreenHeader`'s
    // init fetch) — fetch it the first time the target id isn't already in
    // the shared collection, mirroring `guest-profile-modal.ts`'s "fetch by
    // id if not already cached" shape (ADR W-0006 Decision 4).
    effect(() => {
      const targetId = this.profileModal.targetUserId();
      if (targetId && !this.profiles().some((p) => p.id === targetId)) {
        this.userProfileCollection.getByKey(targetId);
      }
    });

    // The delegate-chip name resolution (T336) — a targeted read, not a
    // collection load: only fires for the ids `delegateChips()` cannot
    // already resolve out of `profiles()`, and never for a linked partner's
    // profile nor for a couple viewer (`missingDelegateIds` is structurally
    // empty whenever `showsDelegation()` is false).
    effect(() => {
      const ids = this.missingDelegateIds();
      if (ids.length === 0) return;
      this.userProfileApi.profileControllerGetListV1({ getProfilesListDto: { ids } }).subscribe({
        next: (response) => {
          this.fetchedDelegateNames.update((current) => {
            const next = new Map(current);
            for (const item of response.items) {
              next.set(item.id, `${item.firstName} ${item.lastName}`.trim());
            }
            // Anything the batch endpoint didn't return (`notFoundIds`, or
            // simply absent) is marked resolved-to-nothing so this effect
            // never re-requests it — `delegateChips()` degrades that id to
            // the kind alone, permanently, not just until the next retry.
            for (const id of ids) {
              if (!next.has(id)) next.set(id, null);
            }
            return next;
          });
        },
        // Best-effort (T336): a failed lookup still marks these ids
        // resolved-to-nothing (same as an id the batch endpoint couldn't
        // find), so a transient network error degrades those chips to the
        // kind alone once rather than retrying this fetch on every signal
        // recomputation. Never blocks or errors the profile modal itself.
        error: () => {
          this.fetchedDelegateNames.update((current) => {
            const next = new Map(current);
            for (const id of ids) if (!next.has(id)) next.set(id, null);
            return next;
          });
        },
      });
    });
  }

  private deepestChrome(): RouteChrome {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data;
  }

  /** Reads a query param off the router's own current URL — same trick as
   *  {@link deepestChrome}, for the same reason: this layout mounts after
   *  the `NavigationEnd` that first activated it, so a param the URL already
   *  carries on first paint must be read directly rather than only from the
   *  event stream. */
  private currentQueryParam(name: string): string | undefined {
    return this.router.parseUrl(this.router.url).queryParamMap.get(name) ?? undefined;
  }

  /** `PlanRail`'s `navSelect` (hub ADR-0045 §3) — a top-level Manage item was
   *  clicked; `id` is one of {@link manageRailItems}/{@link manageRailFooter},
   *  each carrying its own route `link`, so this is a plain navigation, not
   *  a lookup that could drift from the route tree (hub ADR-0042 §6). */
  protected onManageNav(id: string): void {
    const tab = MANAGE_GROUP_TABS.find((t) => t.id === id);
    if (tab) void this.router.navigateByUrl(tab.link);
  }

  /** `PlanRail`'s `sectionSelect` — a Settings section was clicked while
   *  Settings is the rail's active item; drives `config-manager`'s own
   *  section-controlled state via the shared `CONFIG_SECTION_PARAM` (T364),
   *  never a private lookup this layout owns. */
  protected onManageSection(id: string): void {
    const config = MANAGE_GROUP_TABS.find((t) => t.id === 'config');
    if (!config) return;
    void this.router.navigate([config.link], { queryParams: { [CONFIG_SECTION_PARAM]: id } });
  }

  /**
   * Drives `app-screen-header`'s `.scrolled` class from `main`'s own scroll
   * position — the same signal on every route, pinned head or not (Phase O
   * hygiene, T371). A prior revision (535428d) suppressed this to `false`
   * whenever `screenChrome.head()` held a registered head, which predates
   * hub ADR-0043's decoupling of pinning from scroll ownership: back when
   * `headPinned`/`footPinned` decided who scrolled, a pinned head implied
   * `main` was `overflow-y: clip` and never actually moved, so the `false`
   * branch was inert. ADR-0043 made `main` `/guests`'s real scroller (it
   * declares no `screenScroll`) while still registering a pinned head, so
   * the same ternary went from harmless to a standing defect: `.scrolled`
   * could never fire on the one screen that both scrolls via `main` and
   * pins a head — `guest-manager-scrolled-header.spec.ts`'s own root cause,
   * confirmed pre-existing by two independent tasks (T364, T366) before
   * this one fixed it. `screenChrome.head()` no longer has any bearing on
   * whether `main` scrolled; only `main`'s own `scrollTop` does.
   */
  protected onMainScroll(): void {
    if (this.mainContent) {
      this.isScrolled.set((this.mainContent.nativeElement.scrollTop ?? 0) > 0);
    }
  }

  /**
   * `app-profile-modal`'s `(save)` — writes through the real profile-update
   * endpoint (`EntityCollectionService.update()` → `UserProfileDataService`
   * → `PATCH /v1/profile/{id}`), mirroring `guest-profile-modal.ts`'s
   * `saveProfile()` call shape. `id` is carried forward unchanged from the
   * resolved profile; `preferredLang` is forwarded too — it is a real
   * writable field on `UpdateUserProfileDto` and the modal's `save` payload
   * already always includes it (T303), so leaving it out here would
   * silently discard a language change the guest just made in the form.
   * `email`/`phoneNumber` are never part of this payload (T303).
   */
  protected onProfileSave(changes: {
    firstName: string;
    lastName: string;
    nickname?: string;
    preferredLang: UserProfileDto.PreferredLangEnum;
  }): void {
    const profile = this.resolvedProfile();
    if (!profile || this.savingProfile()) return;
    this.savingProfile.set(true);
    this.profileSaveError.set(false);
    this.userProfileCollection
      .update({
        id: profile.id,
        firstName: changes.firstName,
        lastName: changes.lastName,
        nickname: changes.nickname,
        preferredLang: changes.preferredLang,
      })
      .subscribe({
        next: () => this.savingProfile.set(false),
        error: (err: unknown) => {
          console.error('Failed to save profile', err);
          this.profileSaveError.set(true);
          this.savingProfile.set(false);
        },
      });
  }
}
