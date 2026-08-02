import { Injectable, Signal, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { Subject, map, merge } from 'rxjs';

import { Environment, environment } from '../../../environments';
import { WeddingConfigPublicResponseDto } from '../api';

@Injectable({
  providedIn: 'root',
})
export class ConfigurationService {
  private readonly config: Environment = environment;
  /**
   * `WeddingConfigPublic` @ngrx/data collection (ADR W-0001 decisions 3–4):
   * store → custom data service → generated API client. RxJS stays inside
   * this service (Hard Rule #5); consumers only see signals.
   */
  private readonly weddingConfigPublicCollection: EntityCollectionService<WeddingConfigPublicResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigPublicResponseDto>(
      'WeddingConfigPublic',
    );

  /** Singleton resource: the collection holds at most one document. */
  readonly weddingConfigPublic: Signal<WeddingConfigPublicResponseDto | undefined> = toSignal(
    this.weddingConfigPublicCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );

  readonly weddingConfigPublicLoading: Signal<boolean> = toSignal(
    this.weddingConfigPublicCollection.loading$,
    { initialValue: true },
  );

  /** Reset the error flag whenever a fresh load is triggered. */
  private readonly clearError$ = new Subject<void>();

  /**
   * `true` when the last load of the public config failed (e.g. the backend is
   * unreachable). Reset to `false` on every new `loadWeddingConfigPublic()`.
   */
  readonly weddingConfigPublicError: Signal<boolean> = toSignal(
    merge(
      this.weddingConfigPublicCollection.errors$.pipe(map(() => true)),
      this.clearError$.pipe(map(() => false)),
    ),
    { initialValue: false },
  );

  constructor() {
    this.loadWeddingConfigPublic();
  }

  /**
   * Loads the public wedding config from `GET /v1/config/public` into the
   * store. Imperative command per the facade pattern (ADR W-0001 decision 4);
   * consumers migrate off the mock `weddingConfiguration` signal in T214.
   */
  loadWeddingConfigPublic(): void {
    this.clearError$.next();
    this.weddingConfigPublicCollection.load();
  }

  isProduction(): boolean {
    return this.config.stage === 'production';
  }

  isDevelopment(): boolean {
    return this.config.stage === 'local' || this.config.stage === 'dev';
  }

  getApiBaseUrl(): string {
    return this.config.apiBaseUrl;
  }

  getApiTimeout(): number {
    return this.config.apiTimeout;
  }

  isLoggingEnabled(): boolean {
    return this.config.enableLogging;
  }

  isAnalyticsEnabled(): boolean {
    return this.config.enableAnalytics;
  }

  getAppName(): string {
    return this.config.appName;
  }

  getAppVersion(): string {
    return this.config.appVersion;
  }
}
