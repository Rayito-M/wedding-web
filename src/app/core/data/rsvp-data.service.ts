import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { Observable, map, switchMap, throwError } from 'rxjs';

import {
  WeddingRsvpService,
  RsvpListResponseDto,
  RsvpDto,
  UpdateRsvpDto,
} from '../api';

import { EntityNamesEnum } from './entity-metadata';

/**
 * Custom @ngrx/data data service for the `Rsvp` entity
 * (ADR W-0001 decision 3): delegates every read to the generated API client —
 * the single source of endpoint URLs and typing — instead of @ngrx/data's
 * default URL-guessing data service.
 *
 * Unlike the public/admin wedding-config singleton, RSVP is a guest
 * self-service write: every guest creates and edits their own RSVP. Auth
 * headers are the interceptor's job (Hard Rule #6).
 *
 * `POST /v1/rsvp/{id}` takes no body — it creates a minimal record (`status:
 * 'pending'`, `adults.partner1` set server-side from the caller's identity,
 * `adults.partner2` set server-side only if the guest already has a linked
 * partner account). The orchestrator (`app-rsvp`) calls that endpoint
 * directly on first load, before any screen renders, so by the time
 * `app-rsvp-create` mounts the record already exists — every guest-submitted
 * answer is a plain `update()` (`PATCH`) against it. `add()` below is kept
 * only to satisfy `EntityCollectionDataService<RsvpDto>`'s interface; nothing
 * in the app calls it.
 */
@Injectable({ providedIn: 'root' })
export class RsvpDataService implements EntityCollectionDataService<RsvpDto> {
  readonly name = EntityNamesEnum.RSVP;

  private readonly rsvpApi = inject(WeddingRsvpService);

  getAll(): Observable<RsvpDto[]> {
    return this.rsvpApi
      .rsvpControllerGetAllV1()
      .pipe(map((rsvp: RsvpListResponseDto) => rsvp.items));
  }

  getById(id: string): Observable<RsvpDto> {
    return this.rsvpApi.rsvpControllerGetV1({ id });
  }

  getWithQuery(): Observable<RsvpDto[]> {
    return this.readOnly();
  }

  /**
   * Create the guest's RSVP. `entity.id` is the guest id (or `'me'`) the
   * record is created for; `entity.status`/`entity.adults`/`entity.children`
   * carry the guest's actual first answer, applied via an immediate follow-up
   * `PATCH` (see class doc). Other envelope fields on `entity` (version,
   * timestamps, submittedBy) are ignored — the server owns them.
   */
  add(entity: RsvpDto): Observable<RsvpDto> {
    return this.rsvpApi.rsvpControllerCreateV1({ id: entity.id }).pipe(
      switchMap((created) => {
        const updateRsvpDto: UpdateRsvpDto = {
          id: created.id,
          version: created.version,
          status: entity.status,
          adults: {
            partner1: created.adults.partner1,
            partner2: entity.adults.partner2 ?? created.adults.partner2,
          },
          children: entity.children,
        };
        return this.rsvpApi.rsvpControllerUpdateV1({ id: created.id, updateRsvpDto });
      }),
    );
  }

  /**
   * Update the guest's RSVP in place. `update.changes` must carry the full
   * desired `adults`/`children` (the API replaces, not deep-merges, those
   * fields) plus the envelope `version` for the optimistic-lock guard —
   * always pass the currently-loaded entity's `version`, not a default.
   */
  update(update: { id: string; changes: Partial<RsvpDto> }): Observable<RsvpDto> {
    const updateRsvpDto: UpdateRsvpDto = {
      id: update.id,
      version: update.changes.version ?? 0,
      status: update.changes.status,
      adults: update.changes.adults,
      children: update.changes.children,
    };
    return this.rsvpApi.rsvpControllerUpdateV1({ id: update.id, updateRsvpDto });
  }

  upsert(): Observable<RsvpDto> {
    return this.readOnly();
  }

  delete(): Observable<string | number> {
    return this.readOnly();
  }

  private readOnly(): Observable<never> {
    return throwError(
      () => new Error('Rsvp upsert/delete are not supported by this app (self-service create/update only)'),
    );
  }
}
