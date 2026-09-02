import { EntityDataModuleConfig, EntityMetadataMap } from '@ngrx/data';

import {
  WeddingConfigResponseDto,
  WeddingConfigPublicResponseDto,
  RsvpDto,
  UserProfileDto,
  UserDto,
  MilestoneDto,
  GuestDto,
} from '../api';

export enum EntityNamesEnum {
  GUEST = 'Guest',
  MILESTONE = 'Milestone',
  RSVP = 'Rsvp',
  USER = 'User',
  USER_PROFILE = 'UserProfile',
  WEDDING_CONFIG = 'WeddingConfig',
  WEDDING_CONFIG_PUBLIC = 'WeddingConfigPublic',
}

/**
 * Entity metadata for the @ngrx/data collections (ADR W-0001 decision 3).
 *
 * Only true CRUD/read collections get an entity here. RSVP (append-only
 * sub-resource), auth (RPC), and the admin `config` singleton are deliberately
 * excluded — they call the generated client through thin services (T213).
 *
 * Currently wired: `WeddingConfigPublic`, `WeddingConfig`, `Rsvp`, `User`,
 * `UserProfile` (T210/T211 slices) and `Milestone` (T279 — full CRUD/read,
 * fits this file's own rule above). `Guest` and any remaining T210 entities
 * are added as their tasks land.
 */
export const entityMetadata: EntityMetadataMap = {
  [EntityNamesEnum.GUEST]: {
    selectId: (guest: GuestDto) => guest.id,
  },
  [EntityNamesEnum.MILESTONE]: {
    selectId: (milestone: MilestoneDto) => milestone.id,
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
};

/**
 * Pluralization is only consumed by @ngrx/data's default URL generator, which
 * this app never uses (every entity delegates to the generated API client via
 * a custom data service). The invariant plural documents the singleton nature.
 */
export const pluralNames: Record<EntityNamesEnum, string> = {
  [EntityNamesEnum.GUEST]: 'Guest',
  [EntityNamesEnum.MILESTONE]: 'Milestone',
  [EntityNamesEnum.RSVP]: 'Rsvp',
  [EntityNamesEnum.USER]: 'User',
  [EntityNamesEnum.USER_PROFILE]: 'UserProfile',
  [EntityNamesEnum.WEDDING_CONFIG]: 'WeddingConfig',
  [EntityNamesEnum.WEDDING_CONFIG_PUBLIC]: 'WeddingConfigPublic',
};

export const entityConfig: EntityDataModuleConfig = {
  entityMetadata,
  pluralNames,
};
