import { type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type EntityCollectionService } from '@ngrx/data';
import { combineLatest, map } from 'rxjs';

/**
 * `true` while an `@ngrx/data` collection is being read for the first time and
 * has nothing to show yet — the one state a screen replaces its content region
 * with `app-content-loading`.
 *
 * Three conditions, each load-bearing:
 * - `loading$`: a read is actually in flight. This is also what ends the wait
 *   on failure — `@ngrx/data` clears `loading` on error but never sets
 *   `loaded`, so a spinner gated on `loaded$` alone would outlive the request
 *   forever on a screen with no error branch.
 * - `!loaded$`: a later page (`getWithQuery` with a cursor) must never blank
 *   rows already on screen. Collections filled with `getByKey`/`getWithQuery`
 *   never flip this flag at all (`ngrx-data` sets it only from `QUERY_ALL`/
 *   `QUERY_LOAD`), which costs nothing here: `loading$` alone already ends
 *   their wait.
 * - no entities cached: the collections are app-wide singletons, so another
 *   screen may have primed this one already. Data in hand beats a spinner —
 *   the screen renders and the refresh merges in underneath it.
 *
 * Must be called from an injection context (a field initializer or
 * constructor), like every other `toSignal`.
 */
export function isFirstLoad<T>(collection: EntityCollectionService<T>): Signal<boolean> {
  return toSignal(
    combineLatest([collection.loading$, collection.loaded$, collection.entities$]).pipe(
      map(([loading, loaded, entities]) => loading && !loaded && entities.length === 0),
    ),
    { initialValue: false },
  );
}

