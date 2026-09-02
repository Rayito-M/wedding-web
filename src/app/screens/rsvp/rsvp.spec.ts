import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  AppJwtClaimsDto,
  EntityNamesEnum,
  LoginService,
  RsvpDto,
  RsvpListResponseDtoItemsInner,
  WeddingConfigResponseDto,
  WeddingRsvpService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { Rsvp } from './rsvp';

/**
 * An `attending` flag that is **absent**, not `false`.
 *
 * Hub ADR-0040 made `attending` required on every adult member, so a member
 * carrying no flag is no longer constructible — but it is still readable
 * (stored RSVPs are not re-validated on read, ADR-0040 §1; and this bundle
 * outlives any single API deploy, CLAUDE.md hard rule 17). These fixtures keep
 * the shape they were written with, so what they assert is unchanged.
 */
const NO_FLAG = undefined as unknown as boolean;

/**
 * Orchestrator test: this screen's whole job is to route between
 * `app-rsvp-create` (a `pending` record) and `app-rsvp-edit` (a decided
 * one) — no route, no step state of its own (see `rsvp.ts`'s header
 * comment). "Change my answer" is gone (T273): there is no path back to
 * `app-rsvp-create` for a `decided` record any more, so a `pending` RSVP
 * reaching `app-rsvp-create` is the *only* way into it, and that path must
 * stay open.
 */
function rsvpWith(status: RsvpDto.StatusEnum): RsvpDto {
  return {
    id: 'guest-1',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status,
    adults: {
      partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: NO_FLAG },
    },
    children: [],
    submittedBy: 'guest-1',
  };
}

describe('Rsvp', () => {
  let fixture: ComponentFixture<Rsvp>;
  // Read lazily by the `WeddingRsvpService` stub below, so each test can pick
  // its own fixture without re-configuring the TestBed providers.
  let currentRsvp: RsvpDto;
  // T337 — `GET /v1/rsvp`'s mirror-list read. Empty by default so every
  // pre-existing test in this file exercises the true zero-delegation path
  // with no per-test wiring of its own (T337's own acceptance: with zero
  // delegations this screen is byte-for-byte what it was before this task).
  let currentDelegated: RsvpListResponseDtoItemsInner[];

  async function create(rsvp: RsvpDto, delegated: RsvpListResponseDtoItemsInner[] = []): Promise<void> {
    currentRsvp = rsvp;
    currentDelegated = delegated;
    fixture = TestBed.createComponent(Rsvp);
    fixture.detectChanges();
    await fixture.whenStable();
    // `ngOnInit()` runs an async `firstValueFrom` round trip that
    // `whenStable()` doesn't track (nothing routes it through Angular's
    // zoneless pending-task tracker) — flush the microtask queue and run a
    // second change-detection pass so `loaded()`/`rsvp()` are settled before
    // assertions read the DOM.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rsvp],
      providers: [
        provideRouter([]),
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
            currentUserClaims: () => ({
              sub: 'guest-1',
              role: AppJwtClaimsDto.RoleEnum.GUEST,
            }),
            // Kept in step with the real service, where `currentUserId()` is
            // derived from `currentUserClaims()?.sub`. `RsvpEditor` only reads
            // it when `partner2` has an `id`, so omitting it here fails no test
            // today — it would throw the moment a fixture gains a registered
            // partner.
            currentUserId: () => 'guest-1',
          },
        },
        {
          provide: WeddingRsvpService,
          useValue: {
            rsvpControllerGetV1: () => of(currentRsvp),
            rsvpControllerCreateV1: () => of(currentRsvp),
            rsvpControllerGetAllV1: () =>
              of({ items: currentDelegated, nextCursor: null, count: currentDelegated.length }),
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);
    TestBed.inject(EntityServices)
      .getEntityCollectionService<WeddingConfigResponseDto>(EntityNamesEnum.WEDDING_CONFIG)
      .clearCache();
    TestBed.inject(EntityServices)
      .getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP)
      .clearCache();
  });

  it('routes a pending RSVP to app-rsvp-create — the only remaining path there, now that "Change my answer" is gone', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.PENDING));

    expect(fixture.nativeElement.querySelector('app-rsvp-create')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-rsvp-edit')).toBeNull();
  });

  it('routes an attending RSVP to app-rsvp-edit', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));

    expect(fixture.nativeElement.querySelector('app-rsvp-edit')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-rsvp-create')).toBeNull();
  });

  it('routes a declined RSVP to app-rsvp-edit — the guest edits their status inline, not back through app-rsvp-create', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.DECLINED));

    expect(fixture.nativeElement.querySelector('app-rsvp-edit')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-rsvp-create')).toBeNull();
  });

  // T337's own acceptance: with zero delegations this screen is
  // byte-for-byte what it was before this task. The three routing tests
  // above already exercise the zero-delegation path end to end (their own
  // `WeddingRsvpService` stub answers `rsvpControllerGetAllV1` with an empty
  // list); this test is the explicit assertion that the hub component never
  // mounts alongside them, for every status the guest's own reply can be in.
  it('never renders the delegate hub with zero delegations, whatever the own reply status', async () => {
    for (const status of [
      RsvpDto.StatusEnum.PENDING,
      RsvpDto.StatusEnum.ATTENDING,
      RsvpDto.StatusEnum.DECLINED,
    ]) {
      await create(rsvpWith(status));
      expect(fixture.nativeElement.querySelector('app-rsvp-hub')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-delegate-edit')).toBeNull();
    }
  });
});

/** A delegated subject's RSVP — the shape `GET /v1/rsvp` returns for a
 *  non-couple caller (`RsvpListResponseDtoItemsInner`), structurally
 *  identical to `RsvpDto` plus the (unread, here) `delegatedTo` string. */
function delegatedRsvp(overrides: Partial<RsvpListResponseDtoItemsInner> = {}): RsvpListResponseDtoItemsInner {
  return {
    id: 'subject-1',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: RsvpDto.StatusEnum.PENDING,
    adults: {
      partner1: { id: 'subject-1', firstName: 'Ana', lastName: 'Ruiz', options: {}, attending: NO_FLAG },
    },
    children: [],
    submittedBy: 'subject-1',
    ...overrides,
  };
}

describe('Rsvp — delegate hub (hub ADR-0039, T337)', () => {
  let fixture: ComponentFixture<Rsvp>;
  let currentRsvp: RsvpDto;
  let currentDelegated: RsvpListResponseDtoItemsInner[];

  async function create(rsvp: RsvpDto, delegated: RsvpListResponseDtoItemsInner[]): Promise<void> {
    currentRsvp = rsvp;
    currentDelegated = delegated;
    fixture = TestBed.createComponent(Rsvp);
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Rsvp],
      providers: [
        provideRouter([]),
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
            currentUserClaims: () => ({ sub: 'guest-1', role: AppJwtClaimsDto.RoleEnum.GUEST }),
            currentUserId: () => 'guest-1',
          },
        },
        {
          provide: WeddingRsvpService,
          useValue: {
            rsvpControllerGetV1: () => of(currentRsvp),
            rsvpControllerCreateV1: () => of(currentRsvp),
            rsvpControllerGetAllV1: () =>
              of({ items: currentDelegated, nextCursor: null, count: currentDelegated.length }),
            rsvpControllerUpdateV1: (params: { guestId: string; updateRsvpDto: Partial<RsvpDto> }) =>
              of({
                ...currentDelegated.find((d) => d.id === params.guestId),
                ...params.updateRsvpDto,
              } as RsvpDto),
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation(
      'en',
      {
        rsvp: {
          hub: {
            title: 'Replies you look after',
            own: { title: 'Your own reply' },
            ownCardTitle: 'You and your party',
            delegatesTitle: 'You answer for',
            outstanding: { none: 'none', singular: '{{count}} outstanding', plural: '{{count}} outstanding' },
            state: { attending: 'Confirmed', declined: 'Declined', pending: 'Not answered yet' },
            seats: { singular: '{{count}} person', plural: '{{count}} people' },
            back: 'Back to your replies',
          },
        },
      },
      true,
    );
    TestBed.inject(EntityServices)
      .getEntityCollectionService<WeddingConfigResponseDto>(EntityNamesEnum.WEDDING_CONFIG)
      .clearCache();
    TestBed.inject(EntityServices)
      .getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP)
      .clearCache();
  });

  it('renders the hub, additively, when the guest holds at least one delegation', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING), [delegatedRsvp()]);

    expect(fixture.nativeElement.querySelector('app-rsvp-hub')).not.toBeNull();
    // The plain owner screen never mounts underneath the hub.
    expect(fixture.nativeElement.querySelector('app-rsvp-edit')).toBeNull();
  });

  it('keeps a guest who has not answered for themselves on app-rsvp-create — a delegation never pre-empts their own first reply', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.PENDING), [delegatedRsvp()]);

    expect(fixture.nativeElement.querySelector('app-rsvp-create')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-rsvp-hub')).toBeNull();
  });

  it('opening the own-reply card falls through to the exact same app-rsvp-edit/app-rsvp-create the zero-delegation screen uses', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING), [delegatedRsvp()]);

    (fixture.nativeElement.querySelector('.card.mine') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-rsvp-edit')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-rsvp-hub')).toBeNull();

    // …and carries the same way back to the hub a delegation card does — it
    // is reached the same way, so it has to be leavable the same way.
    const back = fixture.nativeElement.querySelector(
      'app-rsvp-edit .back-link',
    ) as HTMLButtonElement;
    expect(back).not.toBeNull();
    back.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-rsvp-hub')).not.toBeNull();
  });

  it('opening a delegation card opens app-delegate-edit headed with the subject\'s party label, with a back link to the hub', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING), [
      delegatedRsvp({ id: 'subject-1', status: RsvpDto.StatusEnum.PENDING }),
    ]);

    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.card:not(.mine)'),
    ) as HTMLButtonElement[];
    cards[0].click();
    await fixture.whenStable();
    fixture.detectChanges();

    const delegateEdit = fixture.nativeElement.querySelector('app-delegate-edit');
    expect(delegateEdit).not.toBeNull();
    expect(delegateEdit?.querySelector('h2')?.textContent?.trim()).toBe('Ana Ruiz');

    (delegateEdit?.querySelector('.back-link') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-rsvp-hub')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-delegate-edit')).toBeNull();
  });

  it('never renders a relation line on any card (hard rule 18(c))', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING), [delegatedRsvp()]);

    // The DS mock's `meta={d.relation}` has no equivalent here at all — this
    // asserts the absence structurally, not by string-matching copy that
    // could coincidentally not appear for an unrelated reason.
    expect(fixture.nativeElement.textContent).not.toMatch(/sister|brother|father|mother/i);
  });
});
