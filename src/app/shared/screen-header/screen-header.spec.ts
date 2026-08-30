import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  LoginService,
  NotificationCenterService,
  ProfileModalService,
  TranslateLanguageService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { ScreenHeader } from './screen-header';

/** Stand-in for `NotificationCenterService` — same reasoning as
 *  `notification-bell.spec.ts`: a plain signals object, not the real
 *  HTTP-backed service. */
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

describe('ScreenHeader — "My profile" opens the account-dropdown modal (T304)', () => {
  let fixture: ComponentFixture<ScreenHeader>;
  let router: Router;
  let profileModal: ProfileModalService;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ScreenHeader],
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

    TestBed.inject(TranslateService).setTranslation(
      'en',
      { shared: { myProfile: 'My profile', language: 'Language', logout: 'Log out' } },
      true,
    );

    router = TestBed.inject(Router);
    profileModal = TestBed.inject(ProfileModalService);
    fixture = TestBed.createComponent(ScreenHeader);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function openMenu(): void {
    const avatarButton = fixture.nativeElement.querySelector('.avatar') as HTMLButtonElement;
    avatarButton.click();
    fixture.detectChanges();
  }

  function findMenuItem(label: string): HTMLElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll('.menu-item')).find(
      (el) => (el as HTMLElement).querySelector('.menu-item-label')?.textContent?.trim() === label,
    ) as HTMLElement | undefined;
  }

  it('clicking "My profile" opens ProfileModalService without navigating', async () => {
    await create();
    const navigateSpy = vi.spyOn(router, 'navigate');

    openMenu();
    findMenuItem('My profile')!.click();

    expect(profileModal.isOpen()).toBe(true);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('clicking "My profile" closes the account dropdown', async () => {
    await create();
    openMenu();

    findMenuItem('My profile')!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.menu')).toBeNull();
  });
});
