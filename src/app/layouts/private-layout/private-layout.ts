import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  Signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { filter, map } from 'rxjs';

import {
  EntityNamesEnum,
  LoginService,
  ProfileModalService,
  ToastCenterService,
  UserProfileDto,
} from '@app/core';

import { DecorMotorcycleRider } from '../../shared/decor/motorcycle-rider/motorcycle-rider';
import { ProfileModal } from '../../shared/profile-modal/profile-modal';
import { ScreenHeader } from '../../shared/screen-header/screen-header';
import { TabBar } from '../../shared/tab-bar/tab-bar';
import { Toast } from '../../shared/toast/toast';
import { ToastStack } from '../../shared/toast-stack/toast-stack';

/** Chrome flags read from the active child route's `data`. */
interface RouteChrome {
  tab?: string;
  tabBar?: boolean;
  topNav?: boolean;
  /** Show the decorative motorcycle-rider crossing above the mobile tab bar. */
  moto?: boolean;
}

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
 * layout resolves the signed-in user's `UserProfileDto` the same way
 * `screen-header.ts` does (`LoginService.currentUserClaims()?.sub` against
 * the shared `EntityNamesEnum.USER_PROFILE` collection) and is the consumer
 * that calls `EntityCollectionService.update()` on `(save)`, reporting the
 * outcome back through the modal's `saving`/`saveError` inputs. No second
 * `getByKey()` fetch here: `ScreenHeader` is unconditionally mounted above
 * in this same template and already loads the signed-in user's profile into
 * this same shared collection in its own `ngOnInit`, well before a guest can
 * interact with anything that opens this modal.
 */
@Component({
  selector: 'app-private-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    ScreenHeader,
    TabBar,
    ToastStack,
    Toast,
    DecorMotorcycleRider,
    ProfileModal,
  ],
  templateUrl: './private-layout.html',
  styleUrl: './private-layout.scss',
})
export class PrivateLayout {
  private readonly router = inject(Router);
  private readonly login = inject(LoginService);
  protected readonly toastCenter = inject(ToastCenterService);
  protected readonly profileModal = inject(ProfileModalService);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  /** The signed-in user's own profile — same lookup `screen-header.ts` does
   *  against the shared collection, typed `UserProfileDto` for consistency
   *  with `app-profile-modal`'s own `profile` input (not `UserDto`, which
   *  `screen-header.ts` uses for the same collection). */
  protected readonly ownProfile: Signal<UserProfileDto | undefined> = toSignal(
    this.userProfileCollection.entities$.pipe(
      map((profiles) => {
        const currentUser = this.login.currentUserClaims();
        return currentUser?.sub ? profiles.find((p) => p.id === currentUser.sub) : undefined;
      }),
    ),
    { initialValue: undefined },
  );

  protected readonly savingProfile = signal(false);
  protected readonly profileSaveError = signal(false);

  @ViewChild('mainContent') private mainContent?: ElementRef<HTMLElement>;
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

  constructor() {
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
  }

  private deepestChrome(): RouteChrome {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data;
  }

  protected onMainScroll(): void {
    if (this.mainContent) {
      this.isScrolled.set((this.mainContent.nativeElement.scrollTop ?? 0) > 0);
    }
  }

  /**
   * `app-profile-modal`'s `(save)` — writes through the real profile-update
   * endpoint (`EntityCollectionService.update()` → `UserProfileDataService`
   * → `PATCH /v1/profile/{id}`), mirroring `guest-profile-modal.ts`'s
   * `saveProfile()` call shape. `id`/`role` are carried forward unchanged
   * from the resolved profile; `preferredLang` is forwarded too — it is a
   * real writable field on `UpdateUserProfileDto` and the modal's `save`
   * payload already always includes it (T303), so leaving it out here would
   * silently discard a language change the guest just made in the form.
   * `email`/`phoneNumber` are never part of this payload (T303).
   */
  protected onProfileSave(changes: {
    firstName: string;
    lastName: string;
    nickname?: string;
    preferredLang: UserProfileDto.PreferredLangEnum;
  }): void {
    const profile = this.ownProfile();
    if (!profile || this.savingProfile()) return;
    this.savingProfile.set(true);
    this.profileSaveError.set(false);
    this.userProfileCollection
      .update({
        id: profile.id,
        role: profile.role,
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
