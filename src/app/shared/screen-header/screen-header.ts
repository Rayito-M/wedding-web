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
  RouteConfigService,
  TranslateLanguageService,
  UserProfileDto,
} from '@app/core';

import { LangCode } from '../../model';
import { Monogram } from '../monogram/monogram';
import { NAV_TABS } from '../nav-tabs';

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
  imports: [RouterLink, KeyValuePipe, TranslatePipe, Monogram],
  templateUrl: './screen-header.html',
  styleUrl: './screen-header.scss',
})
export class ScreenHeader implements OnInit {
  private readonly login = inject(LoginService);
  private readonly config = inject(ConfigurationService);
  private readonly lang = inject(TranslateLanguageService);
  private readonly routeConfig = inject(RouteConfigService);
  private readonly router = inject(Router);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  private readonly userProfile: Signal<UserProfileDto | undefined> = toSignal(
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

  protected readonly tabs = computed(() =>
    NAV_TABS.filter((tab) => !tab.roles || tab.roles.includes(this.login.role())),
  );

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

  isRouteEnabled(path: string) {
    return this.routeConfig.isRouteEnabled(path);
  }

  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  /** "My profile" row (DS `AccountMenu`) — closes the dropdown; navigation is
   *  handled by `routerLink`. */
  protected goToProfile(event: MouseEvent): void {
    this.menuOpen.set(false);
    event.stopPropagation();
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
