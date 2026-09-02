import { EnvironmentProviders, inject, provideEnvironmentInitializer } from '@angular/core';
import { EntityDataService } from '@ngrx/data';

import { MilestoneDataService } from './milestone-data.service';
import { RsvpDataService } from './rsvp-data.service';
import { UserDataService } from './user-data.service';
import { UserProfileDataService } from './user-profile-data.service';
import { WeddingConfigDataService } from './wedding-config-data.service';
import { WeddingConfigPublicDataService } from './wedding-config-public-data.service';

import { EntityNamesEnum } from './entity-metadata';
import { GuestDataService } from '@app/core/data/guest-data.service';

export * from './entity-metadata';
export * from './first-load';
export * from './guest-data.service';
export * from './milestone-data.service';
export * from './rsvp-data.service';
export * from './user-profile-data.service';

/**
 * Registers the custom entity data services with @ngrx/data so each entity's
 * HTTP goes through the generated API client (ADR W-0001 decision 3). Wired
 * into `app.config.ts` next to `provideEntityData(...)`.
 */
export function provideEntityDataServices(): EnvironmentProviders {
  return provideEnvironmentInitializer(() => {
    inject(EntityDataService).registerService(EntityNamesEnum.GUEST, inject(GuestDataService));
    inject(EntityDataService).registerService(
      EntityNamesEnum.MILESTONE,
      inject(MilestoneDataService),
    );
    inject(EntityDataService).registerService(EntityNamesEnum.RSVP, inject(RsvpDataService));
    inject(EntityDataService).registerService(EntityNamesEnum.USER, inject(UserDataService));
    inject(EntityDataService).registerService(
      EntityNamesEnum.USER_PROFILE,
      inject(UserProfileDataService),
    );
    inject(EntityDataService).registerService(
      EntityNamesEnum.WEDDING_CONFIG_PUBLIC,
      inject(WeddingConfigPublicDataService),
    );
    inject(EntityDataService).registerService(
      EntityNamesEnum.WEDDING_CONFIG,
      inject(WeddingConfigDataService),
    );
  });
}
