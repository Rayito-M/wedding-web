import { Injectable, inject, signal } from '@angular/core';
import { EntityCollectionDataService, QueryParams } from '@ngrx/data';
import { map, Observable, tap, throwError } from 'rxjs';

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

  /**
   * The cursor the API handed back on the last list read: a string while
   * profiles remain unfetched, `null` once the collection is exhausted, and
   * `undefined` before anything has been read at all.
   *
   * This is the **only** answer to "would showing more rows cost another API
   * call?" — a screen must read it rather than compare a rendered count
   * against a batch size it made up. `GET /v1/profile` with no `limit`
   * returns the whole collection and therefore always reports `null`: nothing
   * is left to fetch, so no screen should offer to fetch it.
   */
  private readonly cursor = signal<string | null | undefined>(undefined);
  readonly nextCursor = this.cursor.asReadonly();

  /**
   * The whole collection in one response — no `limit`, so the API answers with
   * every profile and `nextCursor: null`. The guest-manager header counts and
   * the people directory both aggregate over the full set, so this stays the
   * default read.
   */
  getAll(): Observable<UserProfileDto[]> {
    return this.readPage();
  }

  getById(id: string): Observable<UserProfileDto> {
    return this.serviceApi.profileControllerGetV1({ id });
  }

  /**
   * One page. `@ngrx/data` merges the result into the existing collection
   * rather than replacing it, so successive cursors accumulate rows.
   * Callers pass `{ cursor, limit }`; omitting `limit` is the same read
   * {@link getAll} performs.
   */
  getWithQuery(params: QueryParams | string): Observable<UserProfileDto[]> {
    if (typeof params === 'string') return this.readPage();
    const cursor = this.firstValue(params['cursor']);
    const limit = this.firstValue(params['limit']);
    return this.readPage(cursor, limit === undefined ? undefined : Number(limit));
  }

  /** A `QueryParams` value may arrive as an array; the API takes one value. */
  private firstValue(value: QueryParams[string] | undefined): string | undefined {
    const single = Array.isArray(value) ? value[0] : value;
    return single === undefined ? undefined : String(single);
  }

  /**
   * Reads `items`, not `profiles`. Both carry the same array today — the API
   * serves the deprecated `profiles` alias alongside it so bundles predating
   * this change keep working (hub ADR-0037 §7) — and `profiles` disappears in
   * a later API release.
   */
  private readPage(cursor?: string, limit?: number): Observable<UserProfileDto[]> {
    return this.serviceApi
      .profileControllerGetAllV1({
        ...(cursor ? { cursor } : {}),
        ...(limit === undefined ? {} : { limit }),
      })
      .pipe(
        tap((response) => this.cursor.set(response.nextCursor)),
        map((response) => response.items),
      );
  }

  add(): Observable<UserProfileDto> {
    return this.notImplemented();
  }

  /**
   * `PATCH /v1/profile/{id}` — `firstName`, `lastName`, `nickname` and
   * `preferredLang` are merged for any role when present; `relation` is
   * merged only for a guest target. `role` is no longer accepted by the DTO
   * at all. (`email` / `phoneNumber` are read-only server-side; the profile
   * edit view keeps them display-only for that reason.) The wire requires
   * `nickname` to be `minLength: 1` whenever present, so a cleared/empty
   * nickname is sent as `undefined`, never `''`.
   */
  update(update: { id: string; changes: Partial<UserProfileDto> }): Observable<UserProfileDto> {
    const changes = update.changes;
    const updateUserProfileDto: UpdateUserProfileDto = {
      id: update.id,
      firstName: changes.firstName,
      lastName: changes.lastName,
      nickname: changes.nickname || undefined,
      preferredLang: changes.preferredLang,
      relation: changes.guestInfo?.relation,
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
