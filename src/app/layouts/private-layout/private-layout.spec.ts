import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  LoginService,
  NotificationCenterService,
  ProfileModalService,
  TranslateLanguageService,
  UpdateUserProfileDto,
  UserProfileDto,
  WeddingUserProfileService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';
import { ProfileModal } from '@app/shared/profile-modal/profile-modal';

import { PrivateLayout } from './private-layout';

/** Stand-in for `NotificationCenterService` — same reasoning as
 *  `notification-bell.spec.ts`. */
function createNotificationCenterStub() {
  return {
    notifications: signal([]).asReadonly(),
    unreadCount: signal(0).asReadonly(),
    loading: signal(false).asReadonly(),
    error: signal(undefined).asReadonly(),
    ensureUnreadCount: vi.fn().mockResolvedValue(undefined),
    refreshList: vi.fn().mockResolvedValue(undefined),
    markRead: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * T304 — `PrivateLayout` mounts `app-profile-modal` at the shell level,
 * conditionally on `ProfileModalService.isOpen()`, the same pattern already
 * used for the toast stacks (T285).
 */
describe('PrivateLayout — mounts the "My profile" overlay (T304)', () => {
  let fixture: ComponentFixture<PrivateLayout>;
  let profileModal: ProfileModalService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivateLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          provide: LoginService,
          useValue: {
            currentUserClaims: () => undefined,
            role: signal('guest'),
            isCouple: signal(false),
          },
        },
        {
          provide: TranslateLanguageService,
          useValue: { currentLang: signal('en') },
        },
        { provide: NotificationCenterService, useValue: createNotificationCenterStub() },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    profileModal = TestBed.inject(ProfileModalService);
    fixture = TestBed.createComponent(PrivateLayout);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('the modal is absent from the DOM until opened', () => {
    expect(fixture.nativeElement.querySelector('app-profile-modal')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('mounts app-profile-modal once ProfileModalService.open() is called', async () => {
    profileModal.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-profile-modal')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('closing the modal (close output) removes it from the DOM again', async () => {
    profileModal.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    profileModal.close();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-profile-modal')).toBeNull();
  });
});

/**
 * T305 — `PrivateLayout` resolves the signed-in user's `UserProfileDto` and
 * owns the real write behind `app-profile-modal`'s `(save)`.
 */
describe('PrivateLayout — wires "Save changes" to the real profile-update endpoint (T305)', () => {
  let fixture: ComponentFixture<PrivateLayout>;
  let updateSpy: ReturnType<typeof vi.fn>;

  function ownProfile(): UserProfileDto {
    return {
      id: 'u1',
      firstName: 'Laura',
      lastName: 'Ortega',
      nickname: 'Lau',
      preferredLang: UserProfileDto.PreferredLangEnum.ES,
      role: UserProfileDto.RoleEnum.GUEST,
    };
  }

  async function create(
    update: (params: { updateUserProfileDto: UpdateUserProfileDto }) => unknown,
  ): Promise<void> {
    updateSpy = vi.fn(update);

    await TestBed.configureTestingModule({
      imports: [PrivateLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          provide: LoginService,
          useValue: {
            currentUserClaims: () => ({ sub: 'u1', role: 'guest' }),
            role: signal('guest'),
            isCouple: signal(false),
          },
        },
        {
          provide: TranslateLanguageService,
          useValue: { currentLang: signal('en') },
        },
        { provide: NotificationCenterService, useValue: createNotificationCenterStub() },
        { provide: WeddingUserProfileService, useValue: { profileControllerUpdateProfileByIdV1: updateSpy } },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    TestBed.inject(EntityServices)
      .getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE)
      .addOneToCache(ownProfile());

    fixture = TestBed.createComponent(PrivateLayout);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    TestBed.inject(ProfileModalService).open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function modal(): ProfileModal {
    return fixture.debugElement.query(By.directive(ProfileModal)).componentInstance as ProfileModal;
  }

  it('save triggers UserProfileDataService.update() with exactly the writable fields', async () => {
    await create((params) => of({ ...ownProfile(), ...params.updateUserProfileDto } as UserProfileDto));

    modal().save.emit({
      firstName: 'Laura',
      lastName: 'Ortega',
      nickname: 'Lu',
      preferredLang: UserProfileDto.PreferredLangEnum.EN,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const call = updateSpy.mock.calls[0][0] as { id: string; updateUserProfileDto: UpdateUserProfileDto };
    expect(call.id).toBe('u1');
    expect(call.updateUserProfileDto).toEqual({
      id: 'u1',
      firstName: 'Laura',
      lastName: 'Ortega',
      nickname: 'Lu',
      preferredLang: 'en',
    });
  });

  it('a successful save reports back through saving/saveError, letting the modal exit edit mode', async () => {
    await create((params) => of({ ...ownProfile(), ...params.updateUserProfileDto } as UserProfileDto));

    modal().save.emit({
      firstName: 'Laura',
      lastName: 'Ortega',
      nickname: 'Lu',
      preferredLang: UserProfileDto.PreferredLangEnum.ES,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(modal().saving()).toBe(false);
    expect(modal().saveError()).toBe(false);
  });

  it('a failed update leaves the modal in edit mode with an error reported back', async () => {
    await create(() => throwError(() => new Error('boom')));

    modal().save.emit({
      firstName: 'Laura',
      lastName: 'Ortega',
      nickname: 'Lu',
      preferredLang: UserProfileDto.PreferredLangEnum.ES,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // The failure path round-trips through @ngrx/data's effect (dispatch →
    // catchError → failure action → the `update()` observable's `error`)
    // via a scheduling mechanism `whenStable()` doesn't reliably drain under
    // zoneless CD — poll instead of guessing a fixed number of ticks.
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(modal().saving()).toBe(false);
    });

    expect(modal().saveError()).toBe(true);
  });
});

/**
 * T317 — `PrivateLayout` resolves, fetches and writes the real edit target
 * (`ProfileModalService.targetUserId()`), not always the signed-in user's
 * own profile (ADR W-0006 Decision 4).
 */
describe('PrivateLayout — resolves and writes the real edit target, not always self (T317)', () => {
  let fixture: ComponentFixture<PrivateLayout>;
  let updateSpy: ReturnType<typeof vi.fn>;
  let getSpy: ReturnType<typeof vi.fn>;

  function ownProfile(): UserProfileDto {
    return {
      id: 'u1',
      firstName: 'Laura',
      lastName: 'Ortega',
      nickname: 'Lau',
      preferredLang: UserProfileDto.PreferredLangEnum.ES,
      role: UserProfileDto.RoleEnum.GUEST,
    };
  }

  function partnerProfile(): UserProfileDto {
    return {
      id: 'guest-2',
      firstName: 'Marco',
      lastName: 'Diaz',
      nickname: 'Marco',
      preferredLang: UserProfileDto.PreferredLangEnum.ES,
      role: UserProfileDto.RoleEnum.GUEST,
    };
  }

  async function create(options?: { preseedPartner?: boolean }): Promise<void> {
    updateSpy = vi.fn((params: { updateUserProfileDto: UpdateUserProfileDto }) =>
      of({ ...partnerProfile(), ...params.updateUserProfileDto } as UserProfileDto),
    );
    getSpy = vi.fn((params: { id: string }) =>
      of(params.id === 'guest-2' ? partnerProfile() : ownProfile()),
    );

    await TestBed.configureTestingModule({
      imports: [PrivateLayout],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          provide: LoginService,
          useValue: {
            currentUserClaims: () => ({ sub: 'u1', role: 'guest' }),
            role: signal('guest'),
            isCouple: signal(false),
          },
        },
        {
          provide: TranslateLanguageService,
          useValue: { currentLang: signal('en') },
        },
        { provide: NotificationCenterService, useValue: createNotificationCenterStub() },
        {
          provide: WeddingUserProfileService,
          useValue: {
            profileControllerUpdateProfileByIdV1: updateSpy,
            profileControllerGetV1: getSpy,
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    const collection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
    collection.addOneToCache(ownProfile());
    if (options?.preseedPartner) {
      collection.addOneToCache(partnerProfile());
    }

    fixture = TestBed.createComponent(PrivateLayout);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function modal(): ProfileModal {
    return fixture.debugElement.query(By.directive(ProfileModal)).componentInstance as ProfileModal;
  }

  it('opening with a partner target renders app-profile-modal with the partner\'s data and isOwnProfile false', async () => {
    await create({ preseedPartner: true });

    TestBed.inject(ProfileModalService).open('guest-2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(modal().profile()).toEqual(partnerProfile());
    expect(modal().isOwnProfile()).toBe(false);
  });

  it('opening on self (no argument) still renders isOwnProfile true', async () => {
    await create();

    TestBed.inject(ProfileModalService).open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(modal().profile()).toEqual(ownProfile());
    expect(modal().isOwnProfile()).toBe(true);
  });

  it('a partner not already cached is fetched via getByKey (profileControllerGetV1)', async () => {
    await create({ preseedPartner: false });

    TestBed.inject(ProfileModalService).open('guest-2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'guest-2' }));
  });

  it('a partner already cached is not re-fetched', async () => {
    await create({ preseedPartner: true });

    TestBed.inject(ProfileModalService).open('guest-2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getSpy).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'guest-2' }));
  });

  it('save.emit(...) while targeting the partner calls update with the partner\'s id, not the signed-in user\'s own', async () => {
    await create({ preseedPartner: true });

    TestBed.inject(ProfileModalService).open('guest-2');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    modal().save.emit({
      firstName: 'Marco',
      lastName: 'Diaz',
      nickname: 'Marquito',
      preferredLang: UserProfileDto.PreferredLangEnum.ES,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const call = updateSpy.mock.calls[0][0] as { id: string; updateUserProfileDto: UpdateUserProfileDto };
    expect(call.id).toBe('guest-2');
    expect(call.id).not.toBe('u1');
  });
});
