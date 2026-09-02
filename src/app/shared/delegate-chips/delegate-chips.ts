import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { UserListResponseDtoItemsInnerDelegateToInner } from '@app/core';

/**
 * One resolved delegate row: the generated `{id, kind}` pair (hub ADR-0039
 * §1/§4 — `UserListResponseDtoItemsInnerDelegateToInner`, never a hand-copied
 * union, CLAUDE.md hard rule 15) plus the delegate's display name, which the
 * wire item does not itself carry — the host resolves it (against whichever
 * guest/profile list it already has loaded) before handing rows here.
 */
export interface DelegateChip {
  readonly id: string;
  /** `''` when the host could not resolve a name for this id (T336: the
   *  targeted fallback lookup hasn't landed yet, or failed) — the template
   *  degrades to the kind alone rather than rendering a blank name or a
   *  dangling separator. */
  readonly name: string;
  readonly kind: UserListResponseDtoItemsInnerDelegateToInner.KindEnum;
}

/**
 * Read-only chip list for "who may answer this RSVP" — the display half of
 * the DS `components/core/DelegationField.jsx` chip row (hub ADR-0039 §12),
 * factored out on its own so it can be shared, unchanged, by every surface
 * that only ever *reads* a delegation list:
 *
 * - the couple's guest profile view (`guest-profile-modal`, T335) — the
 *   read-only "RSVP answered by" field;
 * - the couple's guest profile **edit** form (T335) — the current chips
 *   above the search-and-pick control, `removable` on;
 * - the guest's own profile (`shared/profile-modal`, T336) — read-only in
 *   **every** mode, including edit (hard rule 18(a)); `private-layout.ts`
 *   resolves the names (this component itself never calls `HttpClient`) and
 *   gates the whole list on `ProfileModal.isOwnProfile()`, never on whether
 *   the wire's `delegateTo` happens to be present — the API populates it for
 *   *any* profile a couple viewer reads, so presence alone is not a safe
 *   gate (CLAUDE.md hard rule 16's `lastSeen` reasoning, applied here).
 *
 * The kind is always rendered **subject-side** (hard rule 18(c)) — this
 * component never receives or renders a relation line for the opposite
 * direction; the caller decides whose list this is, this component only
 * ever prints "{name} · {kind}" for each entry it is handed.
 */
@Component({
  selector: 'app-delegate-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './delegate-chips.html',
  styleUrl: './delegate-chips.scss',
})
export class DelegateChips {
  readonly delegates = input<DelegateChip[]>([]);
  /** Render a "×" on each chip and emit `remove` — the couple's edit form
   *  only (T335). Never `true` for a guest's own read-only view (T336, hard
   *  rule 18(a)). */
  readonly removable = input(false);
  /** Pre-translated — the voice differs by caller ("Nobody answers for
   *  this RSVP yet." vs "Nobody answers for you — only you can reply."),
   *  same split as `RelationFields`' `hint`/`sideLabel` inputs. */
  readonly emptyText = input.required<string>();

  readonly remove = output<string>();
}
