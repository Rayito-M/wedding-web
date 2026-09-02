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
 * - `final` / `reached` — solid, `--status-final` fill, `--on-accent` text.
 *   Same visual, different call sites: agenda "final" vs. a milestone ticked
 *   off. Kept as separate variant names rather than aliasing one to the
 *   other, so each screen's template reads in its own domain vocabulary.
 * - `provisional` / `not-reached` — the default look: dashed hairline
 *   border, muted text, transparent fill.
 * - `at-risk` — solid `--danger` fill, `--on-danger` text (hub ADR-0029
 *   §4.2's derived state: planned date in the past and not reached).
 *
 * Styling: uses schedule's `3px 9px` + `gap: 6px` padding/gap (T241 inventory
 * resolution); these are the newer DS-aligned values. Schedule variant applies
 * `gap: 6px` for icon+label spacing; invitee variant had no gap and slightly
 * smaller padding (`2px 8px`), but unified to schedule's metrics for consistency.
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
