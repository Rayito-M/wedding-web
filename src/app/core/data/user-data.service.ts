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
   * `POST /v1/users` (admin) — creates a plain account (the config manager's
   * bride/groom entries). `entity.id`/`entity.version` are ignored: the server
   * assigns both.
   *
   * Guests do **not** come through here: a guest carries a `relation`, which
   * only `POST /v1/guests` accepts (`WeddingGuestsService`), and their partner
   * link is a separate route again.
   */
  add(entity: UserDto): Observable<UserDto> {
    const createUserDto: CreateUserDto = {
      firstName: entity.firstName,
      lastName: entity.lastName,
      role: entity.role,
      phoneNumber: entity.phoneNumber,
      email: entity.email,
      preferredLang: entity.preferredLang,
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
