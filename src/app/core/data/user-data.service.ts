import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { Observable, throwError, map } from 'rxjs';

import { CreateUserDto, UserDto, WeddingUsersService } from '../api';

import { EntityNamesEnum } from './entity-metadata';

/**
 * Custom @ngrx/data data service for the `User` entity
 * (ADR W-0001 decision 3): delegates every read to the generated API client —
 * the single source of endpoint URLs and typing — instead of @ngrx/data's
 * default URL-guessing data service.
 *
 * `GET /v1/config/public` is a public, read-only singleton: reads resolve to a
 * one-element collection and mutations are rejected. Auth headers are the
 * interceptor's job (Hard Rule #6) — and this endpoint needs none.
 */
@Injectable({ providedIn: 'root' })
export class UserDataService implements EntityCollectionDataService<UserDto> {
  readonly name = EntityNamesEnum.USER;

  private readonly serviceApi = inject(WeddingUsersService);

  getAll(): Observable<UserDto[]> {
    return this.serviceApi.usersControllerListV1().pipe(map((response) => response.items));
  }

  getById(id: string): Observable<UserDto> {
    return this.serviceApi.usersControllerGetV1({ id });
  }

  getWithQuery(): Observable<UserDto[]> {
    return this.getAll();
  }

  /**
   * `POST /v1/users` (admin) — creates the guest account the guest manager's
   * "Add guest" flow needs. `entity.id`/`entity.version` are ignored (the
   * server assigns both); pass a `UserDraft` so the guest's `guestInfo`
   * (`relation`, and `partnerId` when the guest is created linked to a
   * partner account) travels with the create — it is the only request that
   * accepts either field.
   */
  add(entity: UserDto): Observable<UserDto> {
    const createUserDto: CreateUserDto = {
      firstName: entity.firstName,
      lastName: entity.lastName,
      role: entity.role,
      phoneNumber: entity.phoneNumber,
      email: entity.email,
      preferredLang: entity.preferredLang,
      guestInfo: (entity as CreateUserDto).guestInfo,
    };
    return this.serviceApi.usersControllerCreateV1({ createUserDto });
  }

  update(): Observable<UserDto> {
    return this.notImplemented();
  }

  upsert(): Observable<UserDto> {
    return this.notImplemented();
  }

  delete(): Observable<string | number> {
    return this.notImplemented();
  }

  private notImplemented(): Observable<never> {
    return throwError(() => new Error('Not implemented'));
  }
}
