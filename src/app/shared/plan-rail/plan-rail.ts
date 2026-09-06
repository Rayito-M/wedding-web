import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { DecorFish } from '@app/shared/decor/fish';

/** One nested destination under a `PlanRailItem`, shown only while its parent
 *  is active (DS `PlanRailItem`'s 4th tuple slot — one level deep, no more). */
export interface PlanRailSection {
  readonly id: string;
  readonly labelKey: string;
}

/**
 * One rail destination. Ported from the DS's `PlanRailItem` tuple
 * (`[id, label, count?, sections?]`, `PlanRail.d.ts`) as an object with a
 * `labelKey` rather than a literal `label` — the reference hands the rail a
 * display string, but CLAUDE.md hard rule 8 forbids hardcoded UI text, so
 * this port carries a translation key instead and the caller supplies
 * already-resolved keys (T362+ wires those from route data).
 */
export interface PlanRailItem {
  readonly id: string;
  readonly labelKey: string;
  /** Short live figure, already formatted by the caller (e.g. "142 / 172"). */
  readonly count?: string;
  /** Nested destinations, rendered only while this item is active. */
  readonly sections?: readonly PlanRailSection[];
}

/**
 * Desktop workspace rail (DS `components/navigation/PlanRail.jsx`) — for the
 * inside of a role's own tool area (the couple's "Manage"), never the app's
 * primary navigation. Same active-dot vocabulary as `TabBar`, laid out
 * vertically, plus what a header can't carry: a live count per destination
 * and one level of nested sections under whichever item is active.
 *
 * This is a pure presentational port (`wedding-web` T361) — it takes no
 * dependency on routing, `RouteChromeData` or any screen. Wiring it into the
 * Manage area (deciding *when* it renders, and what `items`/`active` are for
 * the real couple workspace) is T362 (route data) and T364 (the Manage area
 * itself); until then nothing mounts this component.
 */
@Component({
  selector: 'app-plan-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, DecimalPipe, NgTemplateOutlet, DecorFish],
  templateUrl: './plan-rail.html',
  styleUrl: './plan-rail.scss',
})
export class PlanRail {
  /** Eyebrow translation key above the list — the workspace's name (e.g.
   *  `nav.manage`). Omitted entirely when not supplied, rather than falling
   *  back to a hardcoded "Manage" (hard rule 8). */
  readonly label = input<string | undefined>(undefined);
  readonly items = input<readonly PlanRailItem[]>([]);
  /** Items pinned below a hairline at the rail foot — where Settings lives. */
  readonly footer = input<readonly PlanRailItem[]>([]);
  /** Currently open destination id (matches an `items`/`footer` entry). */
  readonly active = input<string | undefined>(undefined);
  /** Currently open section id, when the active item declares `sections`. */
  readonly activeSection = input<string | undefined>(undefined);
  /** Decorative fish illustration above the rail foot (DS default in
   *  `AppShell.jsx`'s Manage rail — `<FishIllustration color="var(--accent)" width={64} />`). */
  readonly showIllustration = input(true);
  /** Rail width in px (DS default 208, matching `config-manager`'s own
   *  desktop section rail). Bound as an inline style, not a stylesheet rule
   *  — see `plan-rail.scss`'s note on why `width` never appears there. */
  readonly width = input(208);

  readonly navSelect = output<string>();
  readonly sectionSelect = output<string>();
}
