/**
 * `config-manager`'s eight Settings sections — lifted out of that screen's
 * own file so Manage's desktop rail (`PlanRail`, `private-layout.ts`, hub
 * ADR-0045 §3) can nest them under the "Settings" rail-foot item without
 * importing the screen component itself. `config-manager` (lazily loaded)
 * and `private-layout` (eager, mounted for every signed-in route) must not
 * share a module boundary the other way around — that would pull the whole
 * config-manager screen into the layout's bundle just to read a label list.
 * Lives in `shared/` beside `nav-tabs.ts`/`home-section.ts` — the other
 * holders of this kind of cross-screen route knowledge.
 */
export type SectionId =
  | 'basics'
  | 'couple'
  | 'venues'
  | 'agenda'
  | 'hotels'
  | 'dietary'
  | 'appearance'
  // Not "info" — that word belongs to *Public wedding info*, the
  // unauthenticated teaser (hub ADR-0046 §10). The pre-existing `HomeSection`
  // id `'info'` stays; a *new* identifier may not reuse it.
  | 'good-to-know';

export interface SectionDef {
  readonly id: SectionId;
  readonly number: string;
  readonly labelKey: string;
}

export const SECTIONS: readonly SectionDef[] = [
  { id: 'basics', number: '01', labelKey: 'configManager.section.basics' },
  { id: 'couple', number: '02', labelKey: 'configManager.section.couple' },
  { id: 'venues', number: '03', labelKey: 'configManager.section.venues' },
  { id: 'agenda', number: '04', labelKey: 'configManager.section.agenda' },
  { id: 'hotels', number: '05', labelKey: 'configManager.section.hotels' },
  { id: 'dietary', number: '06', labelKey: 'configManager.section.dietary' },
  { id: 'appearance', number: '07', labelKey: 'configManager.section.appearance' },
  // The eighth section (hub ADR-0046 §8, T376): appended after the existing
  // seven — Appearance keeps '07' and shipped `?section=` deep links keep
  // their meaning. The DS mock renumbers (info 07, appearance 08); the ADR's
  // "alongside the seven" wording and this task's acceptance ('08') win.
  { id: 'good-to-know', number: '08', labelKey: 'configManager.section.good-to-know' },
];

/** Query param Manage's `PlanRail` uses to select a Settings section from
 *  outside `ConfigManager` (T364's section-controlled mode): `/config?section=couple`. */
export const CONFIG_SECTION_PARAM = 'section';

export function isSectionId(value: string | null): value is SectionId {
  return SECTIONS.some((section) => section.id === value);
}
