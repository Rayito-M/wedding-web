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
  RouteConfigService,
  TranslateLanguageService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';
import { environment } from '@env/environment';

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

/**
 * Hub ADR-0045 §3, T363 — the couple's Manage door renders as an outlined
 * standout pill pushed to the end of the desktop nav, and reads active
 * while the route is any member of its group (`MANAGE_GROUP_TABS`), not
 * only its own door route (`guests`) — the risk T362 carried forward for
 * this task to close.
 */
describe('ScreenHeader — the standout (Manage) pill and its group-aware active state (hub ADR-0045 §3)', () => {
  let fixture: ComponentFixture<ScreenHeader>;

  async function create(role: 'guest' | 'bride' | 'groom', active: string): Promise<void> {
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
            role: signal(role),
            isCouple: signal(role !== 'guest'),
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
      {
        nav: {
          home: 'Home',
          schedule: 'Schedule',
          rsvp: 'RSVP',
          people: 'People',
          manage: 'Manage',
        },
      },
      true,
    );

    TestBed.inject(RouteConfigService).setRouteConfig(environment.enabledRoutes);

    fixture = TestBed.createComponent(ScreenHeader);
    fixture.componentRef.setInput('active', active);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it("renders the couple's Manage tab as the last child of the nav, as an outlined standout pill", async () => {
    await create('bride', 'home');

    const nav = fixture.nativeElement.querySelector('.nav') as HTMLElement;
    const standout = nav.querySelector('.standout');
    expect(standout).not.toBeNull();
    expect(standout?.textContent?.trim()).toBe('Manage');
    expect(nav.children[nav.children.length - 1]).toBe(standout);
  });

  it('a guest — who has no Manage group — gets no standout pill', async () => {
    await create('guest', 'home');

    expect(fixture.nativeElement.querySelector('.standout')).toBeNull();
  });

  it('the standout pill is active while on its own door route (guests)', async () => {
    await create('bride', 'guests');

    expect(fixture.nativeElement.querySelector('.standout.on')).not.toBeNull();
  });

  it.each(['milestones', 'config'])(
    'the standout pill reads active on the other Manage-group route %s too, via MANAGE_GROUP_TABS',
    async (activeId) => {
      await create('bride', activeId);

      expect(fixture.nativeElement.querySelector('.standout.on')).not.toBeNull();
    },
  );

  it('plain nav links go dark while the standout is active — DS `standoutActive` suppresses their dot', async () => {
    await create('bride', 'guests');

    expect(fixture.nativeElement.querySelector('.link.on')).toBeNull();
  });

  it('plain nav links still show their own active state when the standout is not active', async () => {
    await create('bride', 'home');

    const homeLink = Array.from(fixture.nativeElement.querySelectorAll('.link')).find(
      (el) => (el as HTMLElement).textContent?.trim() === 'Home',
    ) as HTMLElement;
    expect(homeLink.classList.contains('on')).toBe(true);
  });
});
