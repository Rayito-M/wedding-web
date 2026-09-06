import type { Params } from '@angular/router';

/**
 * Home's three umbrella sections (hub ADR-0045 §4) and the query param that
 * selects one: `/dashboard?section=travel`, `/me?section=travel`. A query
 * param rather than a child route or a separate screen — the same reasoning
 * `travel-link.ts`'s `place` param already uses: the selection is view state
 * on Home's one route, not a fresh nav destination, so both role Home routes
 * keep their single route entry and their existing `id`/nav chrome
 * (`app.routes.ts`).
 *
 * Lives in `shared/` beside `nav-tabs.ts` and `travel-link.ts` — the other
 * holders of route knowledge — so `core/guard`'s redirect (old `/travel`
 * deep links, hub ADR-0045 §4) and both Home screens agree on one id set and
 * one param name without importing each other's lazily-loaded component.
 */
export const HOME_SECTION_PARAM = 'section';

export type HomeSection = 'today' | 'travel' | 'info';

export const DEFAULT_HOME_SECTION: HomeSection = 'today';

export function homeSectionQueryParams(section: HomeSection): Params {
  return { [HOME_SECTION_PARAM]: section };
}

export function isHomeSection(value: string | null): value is HomeSection {
  return value === 'today' || value === 'travel' || value === 'info';
}
