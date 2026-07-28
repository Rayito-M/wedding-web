import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { Observable, throwError } from 'rxjs';

import { UserProfileDto, WeddingUserProfileService } from '../api';

import { EntityNamesEnum } from './entity-metadata';

/**
 * Custom @ngrx/data data service for the `UserProfile` entity
 * (ADR W-0001 decision 3): delegates every read to the generated API client —
 * the single source of endpoint URLs and typing — instead of @ngrx/data's
 * default URL-guessing data service.
 *
 * `GET /v1/config/public` is a public, read-only singleton: reads resolve to a
 * one-element collection and mutations are rejected. Auth headers are the
 * interceptor's job (Hard Rule #6) — and this endpoint needs none.
 */
@Injectable({ providedIn: 'root' })
export class UserProfileDataService implements EntityCollectionDataService<UserProfileDto> {
  readonly name = EntityNamesEnum.USER_PROFILE;

  private readonly serviceApi = inject(WeddingUserProfileService);

  getAll(): Observable<UserProfileDto[]> {
    return throwError(() => new Error('Not implemented'));
  }

  getById(id: string): Observable<UserProfileDto> {
    return this.serviceApi.profileControllerGetV1({ id });
  }

  getWithQuery(): Observable<UserProfileDto[]> {
    return this.getAll();
  }

  add(): Observable<UserProfileDto> {
    return this.notImplemented();
  }

  update(): Observable<UserProfileDto> {
    return this.notImplemented();
  }

  upsert(): Observable<UserProfileDto> {
    return this.notImplemented();
  }

  delete(): Observable<string | number> {
    return this.notImplemented();
  }

  private notImplemented(): Observable<never> {
    return throwError(() => new Error('Not implemented'));
  }
}
