import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { HeaderService } from '../../core';
import { TimelineItem } from '../../shared/timeline-item/timeline-item';

@Component({
  selector: 'app-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimelineItem, TranslatePipe],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
})
export class Schedule {
  private readonly translateService = inject(TranslateService);

  constructor() {
    inject(HeaderService).set(this.translateService.instant('schedule.header'));
  }

  protected readonly items = computed(() => {
    const schedule = this.translateService.instant('schedule.timeline') as {
      time: string;
      title: string;
      subtitle: string;
      tag: string;
    }[];
    return schedule.map((item) => ({
      t: item.time,
      title: item.title,
      sub: item.subtitle,
      tag: item.tag,
    }));
  });
}
