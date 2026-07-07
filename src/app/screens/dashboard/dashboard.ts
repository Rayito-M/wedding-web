import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DashboardService } from '../../core/dashboard.service';
import { DecorFish } from '../../shared/decor/fish';
import { DecorSun } from '../../shared/decor/sun';
import { DecorWave } from '../../shared/decor/wave';
import { Monogram } from '../../shared/monogram/monogram';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Monogram, DecorFish, DecorSun, DecorWave],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  protected readonly dash = inject(DashboardService);
}
