import { TestBed } from '@angular/core/testing';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import {
  EntityDataService,
  EntityOp,
  EntityServices,
  provideEntityData,
  withEffects,
  type EntityCollectionDataService,
  type EntityCollectionService,
} from '@ngrx/data';
import { throwError } from 'rxjs';

import type { RsvpDto, UserProfileDto } from '../api';
import { EntityNamesEnum, entityConfig } from '../data';

import { StatisticService } from './statistic.service';

/** The signed-in couple member — what `ScreenHeader.ngOnInit` fetches by key. */
const OWN_PROFILE = { id: 'c1', role: 'groom' } as unknown as UserProfileDto;

/**
 * The guest list, as `getAll` returns it. `g1p` is `g1`'s linked partner: the
 * API hands them the couple's shared summary, whose id stays `g1`'s.
 */
const GUESTS = [
  { id: 'g1', role: 'guest', guestInfo: { rsvp: { id: 'g1', status: 'attending', adults: 2 } } },
  { id: 'g1p', role: 'guest', guestInfo: { rsvp: { id: 'g1', status: 'attending', adults: 2 } } },
  { id: 'g2', role: 'guest', guestInfo: { rsvp: { id: 'g2', status: 'declined', adults: 1 } } },
  { id: 'g3', role: 'guest' },
] as unknown as UserProfileDto[];

/**
 * The RSVP records behind them. `g1` is a couple sharing one record — `g1p`
 * holds the second adult seat as a `kind: 'guest'` partner2, and has said yes.
 */
const RSVPS = [
  {
    id: 'g1',
    status: 'attending',
    adults: {
      // Every adult carries `attending` since hub ADR-0040 (`wedding-api`
      // a97cbf2 plus the backfill), so the fixtures do too — `adultHeadCount`
      // reads `=== true` and a flagless seat is deliberately not counted.
      partner1: { id: 'g1', firstName: 'Ada', lastName: 'Vance', attending: true },
      partner2: { kind: 'guest', id: 'g1p', firstName: 'Bo', lastName: 'Vance', attending: true },
    },
    children: [{ firstName: 'Cy', age: 6 }],
  },
  {
    id: 'g2',
    status: 'declined',
    adults: { partner1: { id: 'g2', firstName: 'Dee', lastName: 'Roth', attending: false } },
  },
] as unknown as RsvpDto[];

describe('StatisticService.loading', () => {
  let collection: EntityCollectionService<UserProfileDto>;
  let rsvpCollection: EntityCollectionService<RsvpDto>;
  let statistics: StatisticService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // `provideEffects()` bootstraps the effects runner; without it
      // `provideEntityData(..., withEffects())` registers the effect but nothing
      // ever runs it, and `getAll()` silently never settles.
      providers: [provideStore(), provideEffects(), provideEntityData(entityConfig, withEffects())],
    });

    collection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
    rsvpCollection = TestBed.inject(EntityServices).getEntityCollectionService<RsvpDto>(
      EntityNamesEnum.RSVP,
    );
    statistics = TestBed.inject(StatisticService);
  });

  function dispatch(op: EntityOp, data?: unknown): void {
    collection['dispatch'](collection.createEntityAction(op, data));
  }

  function dispatchRsvps(rsvps: RsvpDto[]): void {
    rsvpCollection['dispatch'](
      rsvpCollection.createEntityAction(EntityOp.QUERY_ALL_SUCCESS, rsvps),
    );
  }

  it('waits before anything has been read', () => {
    expect(statistics.loading()).toBe(true);
  });

  it('keeps waiting while only the header profile is cached', () => {
    // `ScreenHeader` draws the account monogram from a `getByKey` on this same
    // singleton collection. It lands one non-guest row, which used to end the
    // wait and publish a full set of zeros.
    dispatch(EntityOp.QUERY_BY_KEY_SUCCESS, OWN_PROFILE);

    expect(statistics.loading()).toBe(true);
    expect(statistics.guestStatistics().total).toBe(0);
  });

  it('publishes only once the full read lands', () => {
    dispatchRsvps(RSVPS);
    dispatch(EntityOp.QUERY_BY_KEY_SUCCESS, OWN_PROFILE);
    dispatch(EntityOp.QUERY_ALL_SUCCESS, [OWN_PROFILE, ...GUESTS]);

    expect(statistics.loading()).toBe(false);
    // `g1` and `g1p` share one record but are two guest-list rows, and an
    // attending record with a `kind: 'guest'` partner2 counts both seats.
    // `pending` absorbs `g3`, who has no RSVP record at all.
    expect(statistics.guestStatistics()).toEqual({
      attending: 2,
      declined: 1,
      pending: 1,
      total: 4,
      headCount: { adults: 2, children: 1 },
    });
  });

  it('counts a couple once, both seats and their children', () => {
    dispatchRsvps(RSVPS);
    dispatch(EntityOp.QUERY_ALL_SUCCESS, GUESTS);

    // Two adult seats because both members of the couple carry
    // `attending: true`; the record itself is only counted once.
    expect(statistics.guestStatistics().headCount).toEqual({ adults: 2, children: 1 });
    // `g3` has no RSVP record at all and lands in `pending`.
    expect(statistics.guestStatistics().pending).toBe(1);
  });

  it('leaves the second seat empty when the linked partner has not said yes', () => {
    const [couple, declined] = RSVPS;
    dispatchRsvps([
      {
        ...couple,
        adults: { ...couple.adults, partner2: { ...couple.adults.partner2, attending: false } },
      } as RsvpDto,
      declined,
    ]);
    dispatch(EntityOp.QUERY_ALL_SUCCESS, GUESTS);

    expect(statistics.guestStatistics().headCount.adults).toBe(1);
  });

  it('stops waiting when the read fails, rather than spinning forever', async () => {
    // Through the real effect, so the failure is correlated to the `getAll()`
    // the service actually issued — a hand-dispatched QUERY_ALL_ERROR is not.
    TestBed.inject(EntityDataService).registerService(EntityNamesEnum.USER_PROFILE, {
      getAll: () => throwError(() => new Error('boom')),
    } as unknown as EntityCollectionDataService<UserProfileDto>);

    statistics.load();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(statistics.loading()).toBe(false);
  });
});
