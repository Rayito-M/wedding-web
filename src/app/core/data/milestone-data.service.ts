import { Injectable, inject } from '@angular/core';
import { EntityCollectionDataService } from '@ngrx/data';
import { Observable, map, throwError } from 'rxjs';

import {
  AnnouncementDto,
  CreateMilestoneDto,
  MilestoneDto,
  MilestoneListResponseDto,
  SeededMilestoneResponseDto,
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
 * (`WeddingMilestonesService.milestonesControllerUpdateV1`) — `add()` sends
 * it (T280: the couple's own choice, internal or guest-facing), `update()`
 * never carries it — `UpdateMilestoneDto` has no `kind` field at all.
 *
 * `announcementType`/`audience` (hub ADR-0030 §11c) are PATCH-only: a new
 * guest-facing milestone starts unconfigured (`add()` never sends them) and
 * is configured afterwards via `update()`. `send()`/`clearAnnouncement()`
 * (§11d) are the create-once announcement sub-resource — outside the
 * `EntityCollectionDataService` interface (they are neither a CRUD verb nor
 * cacheable the way `add`/`update`/`delete` are), so the call site
 * (`screens/milestones`) re-reads the collection via `getAll()` afterwards
 * rather than this service reaching into the @ngrx/data cache itself.
 * `seed()` (T281, `POST /v1/milestones/seed`) follows the same precedent —
 * a one-shot action outside the CRUD interface, with the same
 * re-read-afterwards call-site pattern.
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
   * `entity.kind` is sent (T280: the couple's explicit create-time choice —
   * defaults to `internal` server-side if omitted, but this app always
   * supplies it, never leaving it implicit). `announcementType`/`audience`
   * are never accepted on create (hub ADR-0030 §11c) — a guest-facing
   * milestone always starts unconfigured; that is `update()`'s job.
   */
  add(entity: MilestoneDto): Observable<MilestoneDto> {
    const createMilestoneDto: CreateMilestoneDto = {
      title: entity.title,
      plannedDate: entity.plannedDate,
      reached: entity.reached,
      kind: entity.kind,
    };
    return this.milestonesApi.milestonesControllerCreateV1({ createMilestoneDto });
  }

  /**
   * `PATCH /v1/milestones/:id`. `update.changes` carries only the fields
   * being changed (title rename, re-date, tick/untick reached,
   * announcement-type/audience configuration) plus the envelope `version`
   * for the optimistic-lock guard — always the currently-loaded entity's
   * `version`, never a default. `announcementType`/`audience` are valid only
   * on a `guest-facing` milestone (422 otherwise, hub ADR-0030 §11c) —
   * `undefined` for an `internal` one drops the key entirely over real HTTP
   * JSON, same as every other untouched field here.
   */
  update(update: { id: string; changes: Partial<MilestoneDto> }): Observable<MilestoneDto> {
    const updateMilestoneDto: UpdateMilestoneDto = {
      version: update.changes.version ?? 0,
      title: update.changes.title,
      plannedDate: update.changes.plannedDate,
      reached: update.changes.reached,
      announcementType: update.changes.announcementType,
      audience: update.changes.audience,
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

  /**
   * `POST /v1/milestones/:id/announcement` — the create-once send
   * sub-resource (hub ADR-0030 §11d). Sends **immediately**; the caller must
   * have already shown the blast-radius confirmation (§6). `version` guards
   * the second idempotency lock (§7) — `409` if stale or if already sent.
   * The response carries the send fact and counts, not the updated
   * `MilestoneDto` (no new `version` in it) — the caller re-reads the
   * collection afterwards rather than patching the cache from this shape.
   */
  send(id: string, version: number): Observable<AnnouncementDto> {
    return this.milestonesApi.milestonesControllerSendV1({
      id,
      sendAnnouncementDto: { version },
    });
  }

  /**
   * `DELETE /v1/milestones/:id/announcement` — clears the send record so
   * another send is possible. **Unsends nothing** (hub ADR-0030 §7/§11d):
   * no message is recalled, and `reached` is untouched. `404` if not sent.
   */
  clearAnnouncement(id: string): Observable<void> {
    return this.milestonesApi
      .milestonesControllerClearAnnouncementV1({ id })
      .pipe(map(() => undefined));
  }

  /**
   * `POST /v1/milestones/seed` (T281) — populates the collection from the
   * wedding date; idempotent and runs at most once (`409` if the collection
   * document already exists, `400` with no wedding date — the caller gates
   * the button on `hasWeddingDate()` so `400` is unreachable via this UI).
   * The response is a seed count, not a list of `MilestoneDto` — the caller
   * re-reads the collection afterwards rather than fabricating rows from it.
   */
  seed(): Observable<SeededMilestoneResponseDto> {
    return this.milestonesApi.milestonesControllerSeedV1();
  }

  private notSupported(): Observable<never> {
    return throwError(
      () => new Error('Milestone upsert is not supported by this app (add/update only)'),
    );
  }
}
