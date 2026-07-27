import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { Observable, map, throwError } from 'rxjs';

import {
  WeddingConfigurationService,
  WeddingConfigResponseDto,
  UpdateWeddingConfigDto,
} from '../api';

/**
 * Custom @ngrx/data data service for the `WeddingConfigPublic` entity
 * (ADR W-0001 decision 3): delegates every read to the generated API client —
 * the single source of endpoint URLs and typing — instead of @ngrx/data's
 * default URL-guessing data service.
 *
 * `GET /v1/config/public` is a public, read-only singleton: reads resolve to a
 * one-element collection and mutations are rejected. Auth headers are the
 * interceptor's job (Hard Rule #6) — and this endpoint needs none.
 */
@Injectable({ providedIn: 'root' })
export class WeddingConfigDataService implements EntityCollectionDataService<WeddingConfigResponseDto> {
  readonly name = 'WeddingConfig';

  private readonly configApi = inject(WeddingConfigurationService);

  getAll(): Observable<WeddingConfigResponseDto[]> {
    return this.getById().pipe(map((config) => [config]));
  }

  getById(): Observable<WeddingConfigResponseDto> {
    // Singleton: the id is irrelevant, the endpoint always returns the one document.
    return this.configApi.weddingConfigControllerGetV1();
  }

  getWithQuery(): Observable<WeddingConfigResponseDto[]> {
    return this.getAll();
  }

  add(config: WeddingConfigResponseDto): Observable<WeddingConfigResponseDto> {
    return this.configApi.weddingConfigControllerCreateV1({ createWeddingConfigDto: config });
  }

  update(update: {
    id: string;
    changes: Partial<WeddingConfigResponseDto>;
  }): Observable<WeddingConfigResponseDto> {
    const updateWeddingConfigDto: UpdateWeddingConfigDto = {
      ...update.changes,
      id: update.id,
      version: update.changes.version ?? 0, // Default to 0 if version is not provided
    };
    return this.configApi.weddingConfigControllerUpdateV1({
      updateWeddingConfigDto,
    });
  }

  upsert(): Observable<WeddingConfigResponseDto> {
    return this.readOnly();
  }

  delete(): Observable<string | number> {
    return this.readOnly();
  }

  private readOnly(): Observable<never> {
    return throwError(
      () => new Error('WeddingConfigPublic is read-only; admin edits go through /v1/config (T213)'),
    );
  }
}
