import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HeaderService } from '../../core';
import { DashboardService } from '../../core/dashboard.service';
import { DecorFish } from '../../shared/decor/fish';
import { DecorSun } from '../../shared/decor/sun';
import { DecorWave } from '../../shared/decor/wave';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { StatTile } from '../../shared/stat-tile/stat-tile';
import { TaskRow } from '../../shared/task-row/task-row';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecorFish, DecorSun, DecorWave, ProgressBar, StatTile, TaskRow, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly dash = inject(DashboardService);
  protected readonly translate = inject(TranslateService);

  constructor() {
    inject(HeaderService).set(inject(TranslateService).instant('shared.couple'));
  }

  daysTranslationKey() {
    return this.dash.daysToGo() === 1 ? 'dashboard.daysToGo_singular' : 'dashboard.daysToGo_plural';
  }
}
