import type { Params } from '@angular/router';

/** Where the Travel screen lives, and the query param that preselects one of
 *  its places: `/travel?place=<venue or hotel id>`.
 *
 *  A query param rather than a path segment — the preselection is view state on
 *  the one Travel route, so `/travel` keeps its single route entry and its
 *  `id: 'travel'` nav chrome (app.routes.ts).
 *
 *  Lives in `shared/` beside `nav-tabs.ts` — the other holder of route
 *  knowledge — so `shared/timeline-item` can link to Travel without importing
 *  the lazily-loaded screen component itself. */
export const TRAVEL_ROUTE = '/travel';
export const TRAVEL_PLACE_PARAM = 'place';

export function travelPlaceQueryParams(placeId: string): Params {
  return { [TRAVEL_PLACE_PARAM]: placeId };
}
