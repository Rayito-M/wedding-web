import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Status pill (DS inline pattern, shared across screens): a dashed-border
 * muted pill by default, or a solid-filled pill for a "done"-shaped state.
 * Originally agenda-only (`final`/`provisional`); extended (T279) for the
 * couple's preparation timeline, which needs a third, alarm-toned state
 * `at-risk` that neither existing variant covers — reuses this component
 * rather than a second `.status-pill` declaration (the exact drift the
 * `schedule`/`invitee` consolidation, T242, was fixing).
 *
 * - `final` / `provisional` — the agenda pill (`schedule` + `invitee`'s own
 *   itinerary): kit `ScreenSchedule.jsx`/`ScreenHome.jsx`'s own inline
 *   `statusPill` is SOLID in both states (never dashed) — `2px 8px`,
 *   `1px solid transparent`, `--status-final`/`--status-provisional` fill,
 *   `--on-accent` text. T242's consolidation had grouped `provisional` with
 *   milestone's `not-reached` under one dashed rule, never checked against
 *   this pill's own kit source until the T369 parity rescan found the
 *   divergence (`design-parity-schedule.spec.ts`) — split out at T370 so
 *   fixing it does not touch milestone's own (unrelated) dashed default.
 * - `reached` / `not-reached` / `at-risk` — the couple's milestone timeline
 *   (T279, kit `ScreenMilestones(Mobile).jsx`'s own `StatusPill`, a
 *   different component with its own `3px 9px` padding): `reached` solid
 *   `--status-final` fill; `not-reached` the dashed hairline default;
 *   `at-risk` solid `--danger` fill, `--on-danger` text (hub ADR-0029 §4.2's
 *   derived state: planned date in the past and not reached).
 *
 * Base `:host` padding/gap (`3px 9px` / `gap: 6px`, T241 inventory
 * resolution) is the milestone pill's own metrics; `final`/`provisional`
 * override to the agenda pill's narrower `2px 8px`, no gap.
 */
@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './status-pill.html',
  styleUrl: './status-pill.scss',
  host: {
    '[class.final]': "variant() === 'final'",
    '[class.provisional]': "variant() === 'provisional'",
    '[class.reached]': "variant() === 'reached'",
    '[class.not-reached]': "variant() === 'not-reached'",
    '[class.at-risk]': "variant() === 'at-risk'",
    '[class.is-loading]': 'loading()',
  },
})
export class StatusPill {
  /** Agenda: 'final' | 'provisional'. Milestone (T279): 'reached' |
   *  'not-reached' | 'at-risk'. */
  readonly variant = input<'final' | 'provisional' | 'reached' | 'not-reached' | 'at-risk'>(
    'provisional',
  );

  /** Render as a skeleton of the pill's own box — same height and border, no
   *  variant colour, so a header row does not resize when the real state
   *  lands. The pill's metrics stay here rather than being restated by each
   *  screen that has a loading state. */
  readonly loading = input(false);
}
