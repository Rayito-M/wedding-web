import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Status pill for agenda (final vs provisional).
 * Renders a dashed border pill with muted text by default (provisional),
 * or a solid-filled pill with accent-on-text for final.
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
  },
})
export class StatusPill {
  /** Schedule status variant: 'final' or 'provisional'. */
  readonly variant = input<'final' | 'provisional'>('provisional');
}
