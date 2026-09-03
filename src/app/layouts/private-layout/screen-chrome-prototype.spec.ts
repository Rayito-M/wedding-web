import { Component, TemplateRef, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter, type Routes } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  AppScreenHead,
  LoginService,
  NotificationCenterService,
  ScreenChromeService,
  TranslateLanguageService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { PrivateLayout } from './private-layout';

/**
 * T341 prototype gate (hub ADR-0042 §2) — settles whether a `TemplateRef`
 * declared in a screen but rendered in `private-layout`'s own view behaves
 * correctly in this app: Angular 22, zoneless, signals-first, OnPush layout.
 * Three sub-questions, matching the task brief exactly: (a) registration and
 * DOM placement, (b) change detection on a screen-owned signal with no
 * manual nudge, (c) guarded-clear teardown ordering.
 *
 * This spec does **not** implement the rest of T341 (route-data
 * `headPinned`/`footPinned`, the foot slot, `_layout.scss`) — see the task's
 * "Prototype gate" bullet and `TASKS.md` T341.
 *
 * **All three sub-questions are proven against throwaway stub screens
 * (`StubScreenA`/`StubScreenB`/`StubScreenC` below), never against a real
 * screen.** The gate is about the mechanism (`ScreenChromeService`,
 * `AppScreenHead`, `PrivateLayout`'s outlet), not about any one screen's
 * business logic, and a real screen half-wired into a throwaway spec is
 * exactly the half-migration T341's first acceptance bullet undoes. Stub
 * screens live only in this file and are never imported anywhere else.
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
 *  scenario below — copied from `private-layout.spec.ts`'s own set. */
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

/**
 * Throwaway, test-only stub screens. Never real screens, never imported
 * outside this file. `StubScreenA` carries its own signal
 * (`count`, mutated directly by test (b)) so the same declaration serves
 * both the (a)/(b) registration/change-detection group and the (c) teardown
 * group below — one set of stubs, not one per group.
 */
@Component({
  selector: 'app-stub-screen-a',
  imports: [AppScreenHead],
  template: `<header class="stub-head-a" *appScreenHead>
      <span class="stub-count-value">{{ count() }}</span>
    </header>
    <p>Screen A body</p>`,
})
class StubScreenA {
  /** The stub's own signal — test (b) mutates it directly (no
   *  `ChangeDetectorRef`, no `markForCheck()`) to prove the template
   *  projected into `private-layout`'s view still re-renders through the
   *  signal graph. */
  readonly count = signal(1);
}

@Component({
  selector: 'app-stub-screen-b',
  imports: [AppScreenHead],
  template: `<header class="stub-head-b" *appScreenHead>B-HEAD</header>
    <p>Screen B body</p>`,
})
class StubScreenB {}

@Component({
  selector: 'app-stub-screen-c',
  imports: [],
  template: `<p>Screen C body (registers no head)</p>`,
})
class StubScreenC {}

/**
 * (a)/(b) — `PrivateLayout` routed to the throwaway `StubScreenA`, whose
 * head registers `*appScreenHead` on an element containing the stub's own
 * `count` signal.
 */
describe('Prototype gate (a)/(b) — a screen TemplateRef rendered by private-layout', () => {
  async function mount() {
    const routes: Routes = [
      {
        path: '',
        component: PrivateLayout,
        children: [{ path: 'a', component: StubScreenA, data: {} }],
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

  it("(a) registers and renders in private-layout's own DOM, not inside <app-stub-screen-a>", async () => {
    const harness = await mount();
    const root = harness.routeNativeElement as HTMLElement;

    const stubHost = root.querySelector('app-stub-screen-a') as HTMLElement | null;
    expect(stubHost).not.toBeNull();

    // The registered head renders somewhere in private-layout's DOM...
    const head = root.querySelector('.stub-head-a');
    expect(head).not.toBeNull();

    // ...but not inside the screen's own host element — proof it was placed
    // there by private-layout (a different injector, a different place in
    // the DOM), not left in place by StubScreenA itself.
    expect(stubHost!.contains(head)).toBe(false);

    // And it renders in the layout's DOM order before <main> (the router
    // outlet's host), i.e. as a pinned-head-shaped region, not appended
    // arbitrarily at the end.
    const main = root.querySelector('main');
    expect(main).not.toBeNull();
    const position = main!.compareDocumentPosition(head!);
    expect(Boolean(position & Node.DOCUMENT_POSITION_PRECEDING)).toBe(true);
  });

  it('(b) re-renders when the screen-owned signal changes, with no manual CD nudge in app code', async () => {
    const harness = await mount();
    const root = harness.routeNativeElement as HTMLElement;

    const countValue = () =>
      (root.querySelector('.stub-head-a .stub-count-value') as HTMLElement).textContent?.trim();

    expect(countValue()).toBe('1');

    const stubDebug = harness.routeDebugElement!.query(By.directive(StubScreenA));
    const stubInstance = stubDebug.componentInstance as StubScreenA;

    // Mutate the screen's own signal directly — no ChangeDetectorRef, no
    // markForCheck() anywhere in ScreenChromeService, AppScreenHead or
    // PrivateLayout (grep confirms: none of the three files imports
    // ChangeDetectorRef). `harness.detectChanges()`/`whenStable()` below is
    // test-harness plumbing (equivalent to the zoneless scheduler's own
    // pass in a real browser), not an app-code nudge.
    stubInstance.count.set(2);

    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(countValue()).toBe('2');
  });
});

// ─────────────────────────────────────────────────────────────
// (c) Teardown ordering
// ─────────────────────────────────────────────────────────────

/**
 * (c, necessary) — reproduces the guard's absence directly against a
 * throwaway class shaped exactly like `ScreenChromeService` but with an
 * *unguarded* `clearHead`, the version ADR-0042 §2 rejects. This class lives
 * only in this spec file; the shipped `ScreenChromeService` never contains
 * this code path.
 */
class UnguardedScreenChromeStub {
  private readonly _head = signal<TemplateRef<unknown> | undefined>(undefined);
  readonly head = this._head.asReadonly();

  registerHead(t: TemplateRef<unknown>): void {
    this._head.set(t);
  }

  /** No identity check — clears unconditionally, whoever calls it. The
   *  argument is accepted (to mirror the real API's call shape) but
   *  deliberately never read; that omission is the bug. */
  clearHead(template: TemplateRef<unknown>): void {
    void template;
    this._head.set(undefined);
  }
}

describe('Prototype gate (c) — guarded clear: necessary and sufficient', () => {
  it('(c, necessary) an unguarded clearHead wipes the incoming screen\'s registration', () => {
    const stub = new UnguardedScreenChromeStub();
    const templateA = {} as TemplateRef<unknown>;
    const templateB = {} as TemplateRef<unknown>;

    // Angular constructs the incoming route's component tree (and so its own
    // *appScreenHead, if any) before destroying the outgoing one.
    stub.registerHead(templateA); // screen A activates
    stub.registerHead(templateB); // screen B activates — incoming, before A tears down
    stub.clearHead(templateA); // screen A's DestroyRef.onDestroy fires, unguarded

    // BUG: the slot goes blank even though B is the active screen.
    expect(stub.head()).toBeUndefined();
  });

  it('(c, sufficient) the shipped, guarded ScreenChromeService.clearHead leaves the incoming registration intact', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ScreenChromeService);
    const templateA = {} as TemplateRef<unknown>;
    const templateB = {} as TemplateRef<unknown>;

    service.registerHead(templateA);
    service.registerHead(templateB);
    service.clearHead(templateA); // guarded: templateA !== current (templateB) -> no-op

    expect(service.head()).toBe(templateB);
  });

  it('(c, sufficient) clearing the currently-registered template does clear the slot (the guard is not a permanent lock)', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ScreenChromeService);
    const templateA = {} as TemplateRef<unknown>;

    service.registerHead(templateA);
    service.clearHead(templateA); // still current -> clears

    expect(service.head()).toBeUndefined();
  });
});

describe('Prototype gate (c) — end-to-end teardown ordering through real navigation', () => {
  async function mount() {
    const routes: Routes = [
      {
        path: '',
        component: PrivateLayout,
        children: [
          { path: 'a', component: StubScreenA, data: {} },
          { path: 'b', component: StubScreenB, data: {} },
          { path: 'c', component: StubScreenC, data: {} },
        ],
      },
    ];

    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), ...chromeProviders()],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    return RouterTestingHarness.create();
  }

  it('navigating A -> B (both register a head) never leaves the slot blank, and shows B\'s head', async () => {
    const harness = await mount();

    await harness.navigateByUrl('/a', PrivateLayout);
    harness.detectChanges();
    let root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('.stub-head-a')).not.toBeNull();
    expect(root.querySelector('.stub-head-b')).toBeNull();

    await harness.navigateByUrl('/b', PrivateLayout);
    harness.detectChanges();
    root = harness.routeNativeElement as HTMLElement;

    // The crux: B's head is present (registration survived) and A's is gone
    // (the guarded clear did fire for A, just harmlessly, since A was no
    // longer the current registration by the time its teardown ran).
    expect(root.querySelector('.stub-head-b')).not.toBeNull();
    expect(root.querySelector('.stub-head-a')).toBeNull();
  });

  it('navigating A -> C (C registers no head) empties the slot', async () => {
    const harness = await mount();

    await harness.navigateByUrl('/a', PrivateLayout);
    harness.detectChanges();
    let root = harness.routeNativeElement as HTMLElement;
    expect(root.querySelector('.stub-head-a')).not.toBeNull();

    await harness.navigateByUrl('/c', PrivateLayout);
    harness.detectChanges();
    root = harness.routeNativeElement as HTMLElement;

    expect(root.querySelector('.stub-head-a')).toBeNull();
    expect(root.querySelector('.stub-head-b')).toBeNull();
    expect(root.textContent).toContain('Screen C body');
  });
});
