import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { Observable, map, throwError } from 'rxjs';

import {
  WeddingGuestsService,
  GuestListResponseDto,
  GuestDto,
  UpdateGuestDto,
  CreateGuestDto,
} from '../api';

import { EntityNamesEnum } from './entity-metadata';

/**
 * Custom @ngrx/data data service for the `Guest` entity
 * (ADR W-0001 decision 3): delegates every read to the generated API client —
 * the single source of endpoint URLs and typing — instead of @ngrx/data's
 * default URL-guessing data service.
 *
 * Unlike the public/admin wedding-config singleton, Guest is a guest
 * self-service write: every guest creates and edits their own Guest. Auth
 * headers are the interceptor's job (Hard Rule #6).
 *
 * `POST /v1/Guest/{id}` takes no body — it creates a minimal record (`status:
 * 'pending'`, `adults.partner1` set server-side from the caller's identity,
 * `adults.partner2` set server-side only if the guest already has a linked
 * partner account). The orchestrator (`app-Guest`) calls that endpoint
 * directly on first load, before any screen renders, so by the time
 * `app-Guest-create` mounts the record already exists — every guest-submitted
 * answer is a plain `update()` (`PATCH`) against it. `add()` below is kept
 * only to satisfy `EntityCollectionDataService<GuestDto>`'s interface; nothing
 * in the app calls it.
 */
@Injectable({ providedIn: 'root' })
export class GuestDataService implements EntityCollectionDataService<GuestDto> {
  readonly name = EntityNamesEnum.GUEST;

  private readonly guestApi = inject(WeddingGuestsService);

  getAll(): Observable<GuestDto[]> {
    return this.guestApi
      .guestsControllerListV1()
      .pipe(map((Guest: GuestListResponseDto) => Guest.items));
  }

  getById(id: string): Observable<GuestDto> {
    return this.guestApi.guestsControllerGetV1({ id: id });
  }

  getWithQuery(): Observable<GuestDto[]> {
    return this.readOnly();
  }

  /**
   * Create the guest's Guest. `entity.id` is the guest id (or `'me'`) the
   * record is created for; `entity.status`/`entity.adults`/`entity.children`
   * carry the guest's actual first answer, applied via an immediate follow-up
   * `PATCH` (see class doc). Other envelope fields on `entity` (version,
   * timestamps, submittedBy) are ignored — the server owns them.
   */
  add(entity: GuestDto): Observable<GuestDto> {
    const createGuestDto: CreateGuestDto = {
      firstName: entity.firstName,
      lastName: entity.lastName,
      email: entity.email,
      nickname: entity.nickname,
      phoneNumber: entity.phoneNumber,
      preferredLang: entity.preferredLang,
      delegateTo: entity.delegateTo,
      relation: entity.relation,
    };
    return this.guestApi.guestsControllerCreateV1({ createGuestDto });
  }

  /**
   * Update the guest's Guest in place. `update.changes` must carry the full
   * desired `adults`/`children` (the API replaces, not deep-merges, those
   * fields) plus the envelope `version` for the optimistic-lock guard —
   * always pass the currently-loaded entity's `version`, not a default.
   */
  update(update: { id: string; changes: Partial<GuestDto> }): Observable<GuestDto> {
    const updateGuestDto: UpdateGuestDto = {
      id: update.id,
      version: update.changes.version!,
      firstName: update.changes.firstName!,
      lastName: update.changes.lastName!,
      nickname: update.changes.nickname!,
      preferredLang: update.changes.preferredLang!,
      delegateTo: update.changes.delegateTo!,
      relation: update.changes.relation!,
    };
    return this.guestApi.guestsControllerUpdateV1({
      id: update.id,
      updateGuestDto,
    });
  }

  upsert(): Observable<GuestDto> {
    return this.readOnly();
  }

  delete(): Observable<string | number> {
    return this.readOnly();
  }

  private readOnly(): Observable<never> {
    return throwError(
      () =>
        new Error(
          'Guest upsert/delete are not supported by this app (self-service create/update only)',
        ),
    );
  }
}
