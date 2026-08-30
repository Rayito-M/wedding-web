import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Segmented-pill option button (DS `ScreenGuestManager.jsx` local `GuestSeg`
 * helper, added in commit d670a1d together with the guest-manager profile
 * overlay's Side/Group/Preferred-language fields). Not a promoted DS
 * component — no `.prompt.md`/`.d.ts` under `../wedding-ui-design/components/`
 * — so it has no reference `.prompt.md` of its own, but it moved to `shared/`
 * (T309) once `app-relation-fields` (also `shared/`, DS commit
 * `b5c718d8dc214bafe7f67ee296c53f371ae31080`'s `RelationFields.jsx`) needed it
 * alongside its original two importers (`guest-create-modal`,
 * `guest-profile-modal`) — it no longer lives next to just those two.
 *
 * Visually and structurally distinct from `app-choice-card` (serif label,
 * individually-bordered card): this is a small sans-serif label inside a
 * single joined pill container (`.seg-row`, still owned locally by each of
 * this component's callers — see `_shared-modal-form.scss` /
 * `relation-fields.scss`) with no border/gap of its own — usage:
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
