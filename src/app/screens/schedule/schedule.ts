import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Monogram } from '../../shared/monogram/monogram';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

interface ScheduleItem {
  t: string;
  title: string;
  sub: string;
  tag: string;
}

@Component({
  selector: 'app-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Monogram, TranslatePipe],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
})
export class Schedule {
  private readonly translateService = inject(TranslateService);

  protected readonly items = computed(() => {
    const schedule = this.translateService.instant('schedule.timeline') as Array<{
      time: string;
      title: string;
      subtitle: string;
      tag: string;
    }>;
    return schedule.map((item) => ({
      t: item.time,
      title: item.title,
      sub: item.subtitle,
      tag: item.tag,
    }));
  });
}
