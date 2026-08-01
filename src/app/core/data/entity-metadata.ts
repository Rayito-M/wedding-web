import { EntityDataModuleConfig, EntityMetadataMap } from '@ngrx/data';

import {
  WeddingConfigResponseDto,
  WeddingConfigPublicResponseDto,
  RsvpDto,
  UserProfileDto,
  UserDto,
} from '../api';

export enum EntityNamesEnum {
  WEDDING_CONFIG = 'WeddingConfig',
  WEDDING_CONFIG_PUBLIC = 'WeddingConfigPublic',
  RSVP = 'Rsvp',
  USER = 'User',
  USER_PROFILE = 'UserProfile',
}

/**
 * Entity metadata for the @ngrx/data collections (ADR W-0001 decision 3).
 *
 * Only true CRUD/read collections get an entity here. RSVP (append-only
 * sub-resource), auth (RPC), and the admin `config` singleton are deliberately
 * excluded — they call the generated client through thin services (T213).
 *
 * Currently wired: `WeddingConfigPublic` only (partial T210/T211 slice,
 * delivered ahead of schedule). `Guest` and the remaining T210 entities are
 * added when T210/T211 land.
 */
export const entityMetadata: EntityMetadataMap = {
  [EntityNamesEnum.WEDDING_CONFIG]: {
    // `GET /v1/config/public` is a singleton resource, but the API document
    // carries its own stable `id`; using it keeps the collection honest (at
    // most one entry, keyed by the server-issued id).
    selectId: (config: WeddingConfigResponseDto) => config.id,
  },
  [EntityNamesEnum.WEDDING_CONFIG_PUBLIC]: {
    // `GET /v1/config/public` is a singleton resource, but the API document
    // carries its own stable `id`; using it keeps the collection honest (at
    // most one entry, keyed by the server-issued id).
    selectId: (config: WeddingConfigPublicResponseDto) => config.id,
  },
  [EntityNamesEnum.RSVP]: {
    selectId: (rsvp: RsvpDto) => rsvp.id,
  },
  [EntityNamesEnum.USER]: {
    selectId: (user: UserDto) => user.id,
  },
  [EntityNamesEnum.USER_PROFILE]: {
    selectId: (profile: UserProfileDto) => profile.id,
  },
};

/**
 * Pluralization is only consumed by @ngrx/data's default URL generator, which
 * this app never uses (every entity delegates to the generated API client via
 * a custom data service). The invariant plural documents the singleton nature.
 */
export const pluralNames: Record<EntityNamesEnum, string> = {
  [EntityNamesEnum.WEDDING_CONFIG]: 'WeddingConfig',
  [EntityNamesEnum.WEDDING_CONFIG_PUBLIC]: 'WeddingConfigPublic',
  [EntityNamesEnum.RSVP]: 'Rsvp',
  [EntityNamesEnum.USER]: 'User',
  [EntityNamesEnum.USER_PROFILE]: 'UserProfile',
};

export const entityConfig: EntityDataModuleConfig = {
  entityMetadata,
  pluralNames,
};
