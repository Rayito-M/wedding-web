import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HeaderService, PluralTranslatePipe, StatisticService } from '../../core';
import { DashboardService } from '../../core/dashboard.service';
import { DecorFish } from '../../shared/decor/fish';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { StatTile } from '../../shared/stat-tile/stat-tile';
// import { TaskRow } from '../../shared/task-row/task-row';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecorFish,
    ProgressBar,
    TranslatePipe,
    PluralTranslatePipe,
    RouterLink,
    StatTile,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly dash = inject(DashboardService);
  protected readonly translate = inject(TranslateService);

  /** Same RSVP aggregates the guest manager header shows. */
  protected readonly statistics = inject(StatisticService);

  /** The four RSVP captions, in the order the settled card renders them — the
   *  skeleton state shows the real labels and only hides the counts. */
  protected readonly pendingRsvpLabels = [
    'dashboard.rsvp.total',
    'dashboard.rsvp.attending',
    'dashboard.rsvp.pending',
    'dashboard.rsvp.declined',
  ];

  constructor() {
    inject(HeaderService).set(inject(TranslateService).instant('shared.couple'));
    this.statistics.load();
  }

  daysTranslationKey() {
    return this.dash.daysToGo() === 1 ? 'dashboard.daysToGo_singular' : 'dashboard.daysToGo_plural';
  }
}
