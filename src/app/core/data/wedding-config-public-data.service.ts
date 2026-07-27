import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { Observable, map, throwError } from 'rxjs';

import { WeddingConfigurationService, WeddingConfigPublicResponseDto } from '../api';

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
export class WeddingConfigPublicDataService implements EntityCollectionDataService<WeddingConfigPublicResponseDto> {
  readonly name = 'WeddingConfigPublic';

  private readonly configApi = inject(WeddingConfigurationService);

  getAll(): Observable<WeddingConfigPublicResponseDto[]> {
    return this.configApi.weddingConfigControllerGetPublicV1().pipe(map((config) => [config]));
  }

  getById(): Observable<WeddingConfigPublicResponseDto> {
    // Singleton: the id is irrelevant, the endpoint always returns the one document.
    return this.configApi.weddingConfigControllerGetPublicV1();
  }

  getWithQuery(): Observable<WeddingConfigPublicResponseDto[]> {
    return this.getAll();
  }

  add(): Observable<WeddingConfigPublicResponseDto> {
    return this.readOnly();
  }

  update(): Observable<WeddingConfigPublicResponseDto> {
    return this.readOnly();
  }

  upsert(): Observable<WeddingConfigPublicResponseDto> {
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
