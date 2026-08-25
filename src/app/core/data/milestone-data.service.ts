import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { Observable, map, throwError } from 'rxjs';

import {
  CreateMilestoneDto,
  MilestoneDto,
  MilestoneListResponseDto,
  UpdateMilestoneDto,
  WeddingMilestonesService,
} from '../api';

import { EntityNamesEnum } from './entity-metadata';

/**
 * Custom @ngrx/data data service for the `Milestone` entity
 * (ADR W-0001 decision 3): delegates every read to the generated API client —
 * the single source of endpoint URLs and typing — instead of @ngrx/data's
 * default URL-guessing data service.
 *
 * `/v1/milestones` is admin-only full CRUD (hub ADR-0029 §4.9): the couple's
 * own preparation timeline, never guest-reachable. `atRisk` is a derived, read-only
 * field on `MilestoneDto` (hub ADR-0029 §4.2) — it is never read from form
 * state and never written back, on either `add()` or `update()` below.
 * `kind` is create-only and not patchable per the contract's own doc comment
 * (`WeddingMilestonesService.milestonesControllerUpdateV1`); this app never
 * sends anything but the default (`internal`) on create (T280 owns
 * `guest-facing`), so `update()` never carries it — `UpdateMilestoneDto` has
 * no `kind` field at all.
 */
@Injectable({ providedIn: 'root' })
export class MilestoneDataService implements EntityCollectionDataService<MilestoneDto> {
  readonly name = EntityNamesEnum.MILESTONE;

  private readonly milestonesApi = inject(WeddingMilestonesService);

  getAll(): Observable<MilestoneDto[]> {
    return this.milestonesApi
      .milestonesControllerListV1()
      .pipe(map((response: MilestoneListResponseDto) => response.items));
  }

  getById(id: string): Observable<MilestoneDto> {
    // No single-milestone GET on the contract (list-only reads, ~20 rows) —
    // satisfied via the cached collection by @ngrx/data; nothing in this app
    // calls `getByKey()` for a milestone.
    return this.getAll().pipe(
      map((items) => {
        const found = items.find((item) => item.id === id);
        if (!found) throw new Error(`Milestone ${id} not found`);
        return found;
      }),
    );
  }

  getWithQuery(): Observable<MilestoneDto[]> {
    return this.getAll();
  }

  /**
   * `POST /v1/milestones`. `entity.id`/`entity.version`/`entity.atRisk` are
   * ignored — the server assigns the id and version, and derives `atRisk`.
   * `entity.kind` is never sent: this app only ever creates `internal`
   * milestones (the contract default), matching this task's bound.
   */
  add(entity: MilestoneDto): Observable<MilestoneDto> {
    const createMilestoneDto: CreateMilestoneDto = {
      title: entity.title,
      plannedDate: entity.plannedDate,
      reached: entity.reached,
    };
    return this.milestonesApi.milestonesControllerCreateV1({ createMilestoneDto });
  }

  /**
   * `PATCH /v1/milestones/:id`. `update.changes` carries only the fields
   * being changed (title rename, re-date, tick/untick reached) plus the
   * envelope `version` for the optimistic-lock guard — always the
   * currently-loaded entity's `version`, never a default.
   */
  update(update: { id: string; changes: Partial<MilestoneDto> }): Observable<MilestoneDto> {
    const updateMilestoneDto: UpdateMilestoneDto = {
      version: update.changes.version ?? 0,
      title: update.changes.title,
      plannedDate: update.changes.plannedDate,
      reached: update.changes.reached,
    };
    return this.milestonesApi.milestonesControllerUpdateV1({
      id: update.id,
      updateMilestoneDto,
    });
  }

  upsert(): Observable<MilestoneDto> {
    return this.notSupported();
  }

  /** `DELETE /v1/milestones/:id` — permanent (hub ADR-0029 §4.8). */
  delete(id: string | number): Observable<string | number> {
    return this.milestonesApi
      .milestonesControllerRemoveV1({ id: String(id) })
      .pipe(map(() => id));
  }

  private notSupported(): Observable<never> {
    return throwError(
      () => new Error('Milestone upsert is not supported by this app (add/update only)'),
    );
  }
}
