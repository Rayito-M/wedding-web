import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/** Stat tile (DS data-display/StatTile) — uppercase label, serif value,
 *  optional muted sub line. */
@Component({
  selector: 'app-stat-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './stat-tile.html',
  styleUrl: './stat-tile.scss',
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly sub = input('');
  readonly loading = input(true);
  readonly loadingLLabel = input('shared.loading');
}
