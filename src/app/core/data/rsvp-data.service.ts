import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { Observable, map, throwError } from 'rxjs';

import { WeddingRsvpService, RsvpListResponseDto, RsvpDto } from '../api';

import { EntityNamesEnum } from './entity-metadata';

/**
 * Custom @ngrx/data data service for the `Rsvp` entity
 * (ADR W-0001 decision 3): delegates every read to the generated API client —
 * the single source of endpoint URLs and typing — instead of @ngrx/data's
 * default URL-guessing data service.
 *
 * `GET /v1/config/public` is a public, read-only singleton: reads resolve to a
 * one-element collection and mutations are rejected. Auth headers are the
 * interceptor's job (Hard Rule #6) — and this endpoint needs none.
 */
@Injectable({ providedIn: 'root' })
export class RsvpDataService implements EntityCollectionDataService<RsvpDto> {
  readonly name = EntityNamesEnum.RSVP;

  private readonly configApi = inject(WeddingRsvpService);

  getAll(): Observable<RsvpDto[]> {
    return this.configApi
      .rsvpControllerGetAllV1()
      .pipe(map((rsvp: RsvpListResponseDto) => rsvp.items));
  }

  getById(id: string): Observable<RsvpDto> {
    return this.configApi.rsvpControllerGetV1({ id });
  }

  getWithQuery(): Observable<RsvpDto[]> {
    return this.readOnly();
  }

  add(): Observable<RsvpDto> {
    return this.readOnly();
  }

  update(): Observable<RsvpDto> {
    return this.readOnly();
  }

  upsert(): Observable<RsvpDto> {
    return this.readOnly();
  }

  delete(): Observable<string | number> {
    return this.readOnly();
  }

  private readOnly(): Observable<never> {
    return throwError(
      () => new Error('Rsvp is read-only; admin edits go through /v1/config (T213)'),
    );
  }
}
