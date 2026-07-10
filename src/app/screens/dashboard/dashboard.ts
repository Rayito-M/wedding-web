import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardService } from '../../core/dashboard.service';
import { DecorFish } from '../../shared/decor/fish';
import { DecorSun } from '../../shared/decor/sun';
import { DecorWave } from '../../shared/decor/wave';
import { Monogram } from '../../shared/monogram/monogram';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { StatTile } from '../../shared/stat-tile/stat-tile';
import { TaskRow } from '../../shared/task-row/task-row';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Monogram,
    DecorFish,
    DecorSun,
    DecorWave,
    ProgressBar,
    StatTile,
    TaskRow,
    TranslatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly dash = inject(DashboardService);
}
