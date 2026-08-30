import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Segmented-pill option button (DS `ScreenGuestManager.jsx` local `GuestSeg`
 * helper, added in commit d670a1d together with the guest-manager profile
 * overlay's Side/Group/Preferred-language fields). Not a promoted DS
 * component — no `.prompt.md`/`.d.ts` under `../wedding-ui-design/components/`
 * — so it lives locally next to the two sibling modals that use it
 * (`guest-create-modal`, `guest-profile-modal`), same status as this folder's
 * `.select-native` pattern (see `_shared-modal-form.scss`).
 *
 * Visually and structurally distinct from `app-choice-card` (serif label,
 * individually-bordered card): this is a small sans-serif label inside a
 * single joined pill container (`.seg-row` in `_shared-modal-form.scss`)
 * with no border/gap of its own — usage:
 * `<div class="seg-row"><button app-guest-seg [selected]="…" (click)="…">Bride</button>…</div>`.
 */
@Component({
  selector: 'button[app-guest-seg]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './guest-seg.html',
  styleUrl: './guest-seg.scss',
  host: {
    '[class.on]': 'selected()',
    '[attr.aria-pressed]': 'selected()',
  },
})
export class GuestSeg {
  readonly selected = input(false);
}
