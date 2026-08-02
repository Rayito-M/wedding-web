import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { map, Observable, throwError } from 'rxjs';

import { UserProfileDto, UpdateUserProfileDto, WeddingUserProfileService } from '../api';

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
    return this.serviceApi.profileControllerGetAllV1().pipe(map((response) => response.profiles));
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

  /**
   * `PATCH /v1/profile/{id}` — only `firstName`, `lastName`, `preferredLang`,
   * `role` and `relation` are editable per `UpdateUserProfileDto` (`email` /
   * `phoneNumber` are read-only server-side; the profile edit view keeps them
   * display-only for that reason). `role` is required by the DTO even though
   * this app never changes it, so callers must pass the existing value through.
   */
  update(update: { id: string; changes: Partial<UserProfileDto> }): Observable<UserProfileDto> {
    const changes = update.changes;
    if (!changes.role) {
      return throwError(
        () => new Error('UserProfile update requires "role" to be included in changes.'),
      );
    }
    const updateUserProfileDto: UpdateUserProfileDto = {
      id: update.id,
      firstName: changes.firstName,
      lastName: changes.lastName,
      preferredLang: changes.preferredLang,
      role: changes.role,
      guestInfo: changes.guestInfo ? { relation: changes.guestInfo.relation } : undefined,
    };
    return this.serviceApi.profileControllerUpdateProfileByIdV1({
      id: update.id,
      updateUserProfileDto,
    });
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
