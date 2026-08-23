import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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
  WeddingConfigResponseDto,
  WeddingRsvpService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { Rsvp } from './rsvp';

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
      partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: {} },
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

  async function create(rsvp: RsvpDto): Promise<void> {
    currentRsvp = rsvp;
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
          },
        },
        {
          provide: WeddingRsvpService,
          useValue: {
            rsvpControllerGetV1: () => of(currentRsvp),
            rsvpControllerCreateV1: () => of(currentRsvp),
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
});
