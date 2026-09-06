import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  signal,
  type Signal,
  OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { KeyValuePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import {
  ConfigurationService,
  EntityNamesEnum,
  LoginService,
  ProfileModalService,
  RouteConfigService,
  TranslateLanguageService,
  UserDto,
} from '@app/core';

import { LangCode } from '../../model';
import { Monogram } from '../monogram/monogram';
import { MANAGE_GROUP_TABS, NAV_TABS } from '../nav-tabs';
import { NotificationBell } from '../notification-bell/notification-bell';

/**
 * Six items is the ceiling for the desktop nav (DS `AppHeader.d.ts`
 * `items` — "Six is the ceiling"; hub ADR-0045 §1's "header renders at most
 * six items"). One of the six is the standout pill when a role has one, so
 * the plain nav caps one lower in that case.
 */
const MAX_HEADER_ITEMS = 6;

/**
 * Per-screen header row: monogram left, an uppercase meta label right, and the
 * account avatar. On large screens (≥900px) it also carries the primary nav
 * (same role-filtered entries as the bottom TabBar); the TabBar covers
 * navigation on small screens. The avatar is always present (every screen and
 * size) and opens a menu to switch language or sign out. Rendered once by
 * {@link PrivateLayout}
 */
@Component({
  selector: 'app-screen-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, KeyValuePipe, TranslatePipe, Monogram, NotificationBell],
  templateUrl: './screen-header.html',
  styleUrl: './screen-header.scss',
})
export class ScreenHeader implements OnInit {
  private readonly login = inject(LoginService);
  private readonly config = inject(ConfigurationService);
  private readonly lang = inject(TranslateLanguageService);
  private readonly routeConfig = inject(RouteConfigService);
  private readonly router = inject(Router);
  private readonly profileModal = inject(ProfileModalService);

  private readonly userProfileCollection: EntityCollectionService<UserDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserDto>(EntityNamesEnum.USER_PROFILE);

  private readonly userProfile: Signal<UserDto | undefined> = toSignal(
    this.userProfileCollection.entities$.pipe(
      map((profiles) => {
        const currentUser = this.login.currentUserClaims();
        return currentUser?.sub ? profiles.find((p) => p.id === currentUser.sub) : undefined;
      }),
    ),
    { initialValue: undefined },
  );

  /** Active nav entry id (matches a NAV_TABS `id`), for the desktop nav accent. */
  readonly active = input('');
  /** Whether to show the desktop nav (route `data.topNav`); still gated to ≥900px. */
  readonly showNav = input(true);

  /** Translation key for the user role from JWT claims. */
  protected readonly roleKey = computed(() => {
    const role = this.login.currentUserClaims()?.role;
    return `roles.${role}`;
  });

  // Filtered once (role + enabled-route) before splitting into nav/standout,
  // so a disabled route can't eat a "primary slot" (same reasoning as
  // TabBar's `visibleTabs`).
  protected readonly tabs = computed(() =>
    NAV_TABS.filter(
      (tab) =>
        (!tab.roles || tab.roles.includes(this.login.role())) &&
        this.routeConfig.isRouteEnabled(tab.link),
    ),
  );

  /** The Manage door (hub ADR-0045 §3) — rendered as the outlined standout
   *  pill at the end of the nav, DS `AppHeader.standoutId`. */
  protected readonly standoutTab = computed(() => this.tabs().find((tab) => tab.standout));

  /** Plain nav links, capped so the standout pill never pushes the row past
   *  the DS's six-item ceiling. */
  protected readonly navTabs = computed(() => {
    const rest = this.tabs().filter((tab) => !tab.standout);
    const cap = this.standoutTab() ? MAX_HEADER_ITEMS - 1 : MAX_HEADER_ITEMS;
    return rest.slice(0, cap);
  });

  /**
   * True while the active route is the standout's own door, *or* any other
   * member of its group (hub ADR-0045 §3) — the risk T362 carried forward.
   * A couple viewing `/milestones` or `/config` sees `active()` as
   * `'milestones'`/`'config'`, neither of which is `standoutTab().id`
   * (`'guests'`, the door route), so membership must be checked against
   * {@link MANAGE_GROUP_TABS} rather than the tab's own id alone. Mirrors
   * DS `AppHeader`'s `standoutActive`: while true, the plain nav's own dots
   * go dark (`on = id === active && !standoutActive`) because the active
   * thing is inside Manage, not the header.
   */
  protected readonly standoutActive = computed(() => {
    const standout = this.standoutTab();
    if (!standout) return false;
    const activeId = this.active();
    return activeId === standout.id || MANAGE_GROUP_TABS.some((tab) => tab.id === activeId);
  });

  /** Account avatar glyph — the signed-in user's initials from firstName and lastName. */
  protected readonly initial = computed(() => {
    const profile = this.userProfile();
    if (!profile) return '';
    const first = profile.firstName?.[0]?.toUpperCase() ?? '';
    const last = profile.lastName?.[0]?.toUpperCase() ?? '';
    return `${first}${last}`;
  });

  /** Full display name shown at the top of the account dropdown (DS `AccountMenu`). */
  protected readonly userName = computed(() => {
    const profile = this.userProfile();
    if (!profile) return '';
    return [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  });

  /** Languages enabled for this wedding (code → display name), or undefined until config loads. */
  protected readonly languages = computed(() => this.config.weddingConfigPublic()?.language);

  protected readonly menuOpen = signal(false);

  protected readonly currentLang = this.lang.currentLang;

  ngOnInit(): void {
    const currentUser = this.login.currentUserClaims();
    if (currentUser?.sub) {
      this.userProfileCollection.getByKey(currentUser.sub);
    }
  }

  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  /** "My profile" row (DS `AccountMenu`) — closes the dropdown and opens the
   *  account-dropdown overlay (`ProfileModalService`, T304), replacing the
   *  old `/profile` route. */
  protected openProfile(event: MouseEvent): void {
    this.menuOpen.set(false);
    event.stopPropagation();
    this.profileModal.open();
  }

  protected selectLanguage(code: string): void {
    this.lang.setLanguage(code as LangCode);
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.menuOpen.set(false);
    this.login.logout();
    void this.router.navigate(['/']);
  }

  /** Any click outside the menu (the toggle stops propagation) closes it. */
  @HostListener('document:click')
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
