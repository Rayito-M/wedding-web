import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { EntityDataService } from '@ngrx/data';

import { WeddingConfigPublicDataService } from './wedding-config-public-data.service';

export * from './entity-metadata';
export * from './wedding-config-public-data.service';

/**
 * Registers the custom entity data services with @ngrx/data so each entity's
 * HTTP goes through the generated API client (ADR W-0001 decision 3). Wired
 * into `app.config.ts` next to `provideEntityData(...)`.
 */
export function provideEntityDataServices(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    inject(EntityDataService).registerService(
      'WeddingConfigPublic',
      inject(WeddingConfigPublicDataService),
    );
  });
}
