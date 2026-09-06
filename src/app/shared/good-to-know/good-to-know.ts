import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Home's "Good to know" section (hub ADR-0045 §4's umbrella pill row).
 *
 * Unlike "Getting there" — the former `/travel` screen, embedded unchanged —
 * this section has no predecessor to re-arrange. Neither `SPEC.md` nor
 * `WeddingConfigResponseDto` (the wedding document `travel.ts`/`invitee.ts`
 * already read) carries any dress-code/FAQ/registry concept, and the
 * feature's own scope note (hub `docs/features/navigation-five-cap-manage.md`
 * §6) is explicit that this phase is "a re-arrangement of existing, shipped
 * screens" — not a new capability. Inventing dress-code or registry copy
 * here would be fabricating product content the couple never entered, so
 * this renders an honest empty state instead of a guess. See T364's report
 * `decisions_needed` for the real-content follow-up this implies.
 */
@Component({
  selector: 'app-good-to-know',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './good-to-know.html',
  styleUrl: './good-to-know.scss',
})
export class GoodToKnow {}
