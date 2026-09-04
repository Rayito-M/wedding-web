import { Component, TemplateRef, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter, type Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  AppScreenFoot,
  AppScreenHead,
  EntityNamesEnum,
  LoginService,
  NotificationCenterService,
  ScreenChromeService,
  TranslateLanguageService,
  UserProfileDto,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { GuestManager } from '../../screens/guest-manager/guest-manager';
import { PrivateLayout } from './private-layout';

/**
 * T341 (hub ADR-0042 §1/§2) — the mechanism `screen-chrome-prototype.spec.ts`
 * gated (registration, zoneless change detection, guarded-clear teardown) is
 * not re-proven here; that evidence stands (ADR-0042 §Gate outcome) and this
 * file builds on it rather than repeating it. What this file covers instead,
 * against the shipped (not throwaway) mechanism:
 *
 * 1. The **foot** slot (`AppScreenFoot`/`ScreenChromeService.foot`), which
 *    the spike never built — registration/placement and guarded-clear
 *    teardown, the same two properties the head's gate proved, on the
 *    independent foot signal.
 * 2. **Pinning** — `main`/`.screen-scroll` respond to the active route's
 *    `headPinned`/`footPinned` (`RouteChromeData`, ADR-0042 §1) the way
 *    `private-layout.scss`'s contract says, and *only* then.
 * 3. **The moved pinning-contract assertion**, formerly
 *    `guest-manager.spec.ts:1137` (`expect(…querySelector('.header'))
 *    .not.toBeNull()`, commented "the header … stays on screen"). Under
 *    ADR-0042 §2 that is `PrivateLayout`'s contract, not `GuestManager`'s, so
 *    it moves here — proven against the real `GuestManager` under a real
 *    `PrivateLayout`, not a stand-in, because the original assertion was
 *    about *this* screen's actual header.
 */

/** Stand-in for `NotificationCenterService` — mirrors
 *  `private-layout.spec.ts`'s own stub, same reasoning. */
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

/** The full provider bag `PrivateLayout` needs to mount, shared by every
 *  scenario below — copied from `screen-chrome-prototype.spec.ts`'s own set. */
function chromeProviders() {
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
    provideStore(),
    provideEffects(),
    provideEntityData(entityConfig, withEffects()),
    provideEntityDataServices(),
    {
      provide: LoginService,
      useValue: {
        currentUserClaims: () => undefined,
        role: signal('bride'),
        isCouple: signal(true),
      },
    },
    {
      provide: TranslateLanguageService,
      useValue: { currentLang: signal('en') },
    },
    { provide: NotificationCenterService, useValue: createNotificationCenterStub() },
  ];
}

/** Throwaway, test-only stub screens — never real screens, never imported
 *  outside this file, mirroring `screen-chrome-prototype.spec.ts`'s own. */
@Component({
  selector: 'app-stub-flow-screen',
  imports: [],
  template: `<p>Flow screen body</p>`,
})
class StubFlowScreen {}

@Component({
  selector: 'app-stub-foot-screen-a',
  imports: [AppScreenFoot],
  template: `<p>Screen A body</p>
    <footer class="stub-foot-a" *appScreenFoot>A-FOOT</footer>`,
})
class StubFootScreenA {}

@Component({
  selector: 'app-stub-foot-screen-b',
  imports: [AppScreenFoot],
  template: `<p>Screen B body</p>
    <footer class="stub-foot-b" *appScreenFoot>B-FOOT</footer>`,
})
class StubFootScreenB {}

@Component({
  selector: 'app-stub-both-screen',
  imports: [AppScreenHead, AppScreenFoot],
  template: `<header class="stub-head-both" *appScreenHead>HEAD</header>
    <p>Screen body</p>
    <footer class="stub-foot-both" *appScreenFoot>FOOT</footer>`,
})
class StubBothScreen {}

describe('PrivateLayout — foot slot registration and placement (T341)', () => {
  async function mount() {
    const routes: Routes = [
      {
        path: '',
        component: PrivateLayout,
        children: [{ path: 'a', component: StubFootScreenA, data: {} }],
      },
    ];

    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), ...chromeProviders()],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/a', PrivateLayout);
    harness.detectChanges();
    return harness;
  }

  it("registers and renders in private-layout's own DOM, not inside <app-stub-foot-screen-a>, after <main>", async () => {
    const harness = await mount();
    const root = harness.routeNativeElement as HTMLElement;

    const stubHost = root.querySelector('app-stub-foot-screen-a') as HTMLElement | null;
    expect(stubHost).not.toBeNull();

    const foot = root.querySelector('.stub-foot-a');
    expect(foot).not.toBeNull();
    expect(stubHost!.contains(foot)).toBe(false);

    // The pinned-foot-shaped region sits after <main> (the router outlet's
    // host), not appended arbitrarily elsewhere.
    const main = root.querySelector('main');
    expect(main).not.toBeNull();
    const position = main!.compareDocumentPosition(foot!);
    expect(Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });
});

describe('PrivateLayout — foot slot guarded clear (T341, mirrors the head\'s (c))', () => {
  it('the shipped, guarded ScreenChromeService.clearFoot leaves the incoming registration intact', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ScreenChromeService);
    const templateA = {} as TemplateRef<unknown>;
    const templateB = {} as TemplateRef<unknown>;

    service.registerFoot(templateA);
    service.registerFoot(templateB);
    service.clearFoot(templateA); // guarded: templateA !== current (templateB) -> no-op

    expect(service.foot()).toBe(templateB);
  });

  it('clearing the currently-registered foot template does clear the slot (the guard is not a permanent lock)', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ScreenChromeService);
    const templateA = {} as TemplateRef<unknown>;

    service.registerFoot(templateA);
    service.clearFoot(templateA); // still current -> clears

    expect(service.foot()).toBeUndefined();
  });

  it('the head and foot slots are independent: clearing one never touches the other', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ScreenChromeService);
    const head = {} as TemplateRef<unknown>;
    const foot = {} as TemplateRef<unknown>;

    service.registerHead(head);
    service.registerFoot(foot);
    service.clearFoot(foot);

    expect(service.head()).toBe(head);
    expect(service.foot()).toBeUndefined();
  });
});

describe('PrivateLayout — foot slot end-to-end teardown ordering through real navigation (T341)', () => {
  async function mount() {
    const routes: Routes = [
      {
        path: '',
        component: PrivateLayout,
        children: [
          { path: 'a', component: StubFootScreenA, data: {} },
          { path: 'b', component: StubFootScreenB, data: {} },
          { path: 'c', component: StubFlowScreen, data: {} },
        ],
      },
    ];

    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), ...chromeProviders()],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    return RouterTestingHarness.create();
  }

  it("navigating A -> B (both register a foot) never leaves the slot blank, and shows B's foot", async () => {
    const harness = await mount();

    await harness.navigateByUrl('/a', PrivateLayout);
    harness.detectChanges();
    let root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('.stub-foot-a')).not.toBeNull();
    expect(root.querySelector('.stub-foot-b')).toBeNull();

    await harness.navigateByUrl('/b', PrivateLayout);
    harness.detectChanges();
    root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector('.stub-foot-b')).not.toBeNull();
    expect(root.querySelector('.stub-foot-a')).toBeNull();
  });

  it('navigating A -> C (C registers no foot) empties the slot', async () => {
    const harness = await mount();

    await harness.navigateByUrl('/a', PrivateLayout);
    harness.detectChanges();
    let root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('.stub-foot-a')).not.toBeNull();

    await harness.navigateByUrl('/c', PrivateLayout);
    harness.detectChanges();
    root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector('.stub-foot-a')).toBeNull();
    expect(root.textContent).toContain('Flow screen body');
  });
});

/**
 * Hub ADR-0043 (T352) — supersedes the pre-existing `pinned()` describe block
 * this replaces. Scroll ownership (`screenScroll`) and pinning
 * (`headPinned`/`footPinned`) are now independent route keys, proven here as
 * three separate defects rather than one flag with two effects:
 *
 * 1. A route can pin (register a head/foot) without owning the scroller —
 *    `main`/`.screen-scroll` never gain a `screen-scrolls*` class from
 *    `headPinned`/`footPinned` alone (the `guest-manager` shape: it pins a
 *    head/foot but owns no scroll container of its own).
 * 2. A route can own the scroller without pinning anything — `screenScroll`
 *    alone yields `main`, no `.screen-head`/`.screen-foot` ever renders (the
 *    `config-manager` shape).
 * 3. `headPinned: true` with **no** registered `*appScreenHead` is inert,
 *    not catastrophic — `main`'s 52px clearance follows
 *    `ScreenChromeService.head()`, not the route flag, so it survives a flag
 *    set without its directive. This is the exact regression T343
 *    reproduced against `config-manager` before ADR-0043 (8 of 10 spec cases
 *    failing, every click intercepted by the fixed header).
 *
 * `'md' | 'lg' | 'xl'` are only asserted at the class-computation level here
 * — proof that the CSS behind each class actually gates by breakpoint in a
 * real browser is `e2e/layout/screen-scroll-breakpoint.spec.ts` (JSDOM lays
 * nothing out, so a unit test can only prove the class string, never that
 * the media query applies).
 */
describe('PrivateLayout — scroll ownership follows screenScroll, independently of pinning (hub ADR-0043, T352)', () => {
  async function mount(data: Record<string, unknown>, component = StubBothScreen) {
    const routes: Routes = [
      {
        path: '',
        component: PrivateLayout,
        children: [{ path: 'x', component, data }],
      },
    ];

    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), ...chromeProviders()],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/x', PrivateLayout);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  function scrollClasses(root: HTMLElement, selector: string): string[] {
    const el = root.querySelector(selector);
    return ['screen-scrolls', 'screen-scrolls-md', 'screen-scrolls-lg', 'screen-scrolls-xl'].filter(
      (c) => el?.classList.contains(c),
    );
  }

  it('a route with no screenScroll leaves main/.screen-scroll unyielded — main stays the scroller', async () => {
    const root = await mount({ id: 'x' });

    expect(scrollClasses(root, 'main')).toEqual([]);
    expect(scrollClasses(root, '.screen-scroll')).toEqual([]);
  });

  it('headPinned/footPinned alone (pinning, no screenScroll) never yield main — the guest-manager shape', async () => {
    const root = await mount({ id: 'x', headPinned: true, footPinned: true });

    // The head/foot still render — pinning is unaffected by this ADR.
    expect(root.querySelector('.stub-head-both')).not.toBeNull();
    expect(root.querySelector('.stub-foot-both')).not.toBeNull();
    // But neither flag makes main/.screen-scroll yield.
    expect(scrollClasses(root, 'main')).toEqual([]);
    expect(scrollClasses(root, '.screen-scroll')).toEqual([]);
  });

  it('screenScroll: true yields main to .screen-scroll even though nothing is pinned — the config-manager shape', async () => {
    const root = await mount({ id: 'x', screenScroll: true }, StubFlowScreen);

    expect(root.querySelector('.screen-head')).toBeNull();
    expect(root.querySelector('.screen-foot')).toBeNull();
    expect(scrollClasses(root, 'main')).toEqual(['screen-scrolls']);
    expect(scrollClasses(root, '.screen-scroll')).toEqual(['screen-scrolls']);
  });

  it.each(['md', 'lg', 'xl'] as const)(
    "screenScroll: '%s' computes its own single class, never another breakpoint's",
    async (bp) => {
      const root = await mount({ id: 'x', screenScroll: bp }, StubFlowScreen);
      expect(scrollClasses(root, 'main')).toEqual([`screen-scrolls-${bp}`]);
      expect(scrollClasses(root, '.screen-scroll')).toEqual([`screen-scrolls-${bp}`]);
    },
  );

  it('headPinned: true with no registered *appScreenHead is inert — main keeps its fixed-header clearance (hub ADR-0043 §3)', async () => {
    const root = await mount({ id: 'x', headPinned: true }, StubFlowScreen);

    expect(root.querySelector('.screen-head')).toBeNull();
    expect(root.querySelector('main')?.classList.contains('after-head')).toBe(false);
  });

  it('a registered head gives main after-head regardless of the headPinned flag', async () => {
    const root = await mount({ id: 'x' }, StubBothScreen);

    expect(root.querySelector('.screen-head')).not.toBeNull();
    expect(root.querySelector('main')?.classList.contains('after-head')).toBe(true);
  });
});

/**
 * The moved pinning-contract assertion (T341), formerly
 * `guest-manager.spec.ts:1137`. Uses the real `GuestManager` under a real
 * `PrivateLayout`, on a local route carrying the same `headPinned`/
 * `footPinned` data the `guests` route declares in `app.routes.ts` — not
 * `app.routes.ts` itself, which would also pull in `rbacGuard`/
 * `routeEnabledGuard` and the role/route-enablement plumbing this test does
 * not exist to prove.
 */
describe("PrivateLayout — GuestManager's pinned head/foot render here, end-to-end (T341)", () => {
  function profile(): UserProfileDto {
    return {
      id: 'guest-1',
      firstName: 'Laura',
      lastName: 'Mendoza',
      preferredLang: UserProfileDto.PreferredLangEnum.EN,
      role: UserProfileDto.RoleEnum.GUEST,
    };
  }

  async function mount() {
    const routes: Routes = [
      {
        path: '',
        component: PrivateLayout,
        children: [
          {
            path: 'guests',
            component: GuestManager,
            data: { id: 'guests', headPinned: true, footPinned: true },
          },
        ],
      },
    ];

    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), ...chromeProviders()],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    const collection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
    collection.addOneToCache(profile());

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/guests', PrivateLayout);
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  it('renders the header outside <app-guest-manager>, not destroyed by the route pinning it', async () => {
    const root = await mount();

    const screen = root.querySelector('app-guest-manager') as HTMLElement;
    expect(screen).not.toBeNull();

    const header = root.querySelector('.header');
    expect(header).not.toBeNull();
    expect(screen.contains(header)).toBe(false);
  });

  it('renders the list footer outside <app-guest-manager> too', async () => {
    const root = await mount();

    const screen = root.querySelector('app-guest-manager') as HTMLElement;
    const footer = root.querySelector('.list-footer');

    expect(footer).not.toBeNull();
    expect(screen.contains(footer)).toBe(false);
  });
});
