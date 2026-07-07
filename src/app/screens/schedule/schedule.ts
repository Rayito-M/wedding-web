import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Monogram } from '../../shared/monogram/monogram';

interface ScheduleItem {
  t: string;
  title: string;
  sub: string;
  tag: string;
}

@Component({
  selector: 'app-schedule',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Monogram],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
})
export class Schedule {
  protected readonly items: ScheduleItem[] = [
    { t: '15:30', title: 'Welcome', sub: 'Drinks under the olive trees', tag: 'Arrival' },
    { t: '16:30', title: 'Ceremony', sub: 'In the courtyard', tag: 'Main' },
    { t: '17:30', title: 'Aperitivo', sub: 'Vermouth & jamón', tag: 'Bites' },
    { t: '19:00', title: 'Dinner', sub: 'Long table, candlelit', tag: 'Seated' },
    { t: '22:00', title: 'Dancing', sub: 'Until the morning', tag: 'Open' },
    { t: '03:00', title: 'Late bites', sub: 'Tortilla & coffee', tag: 'Snack' },
  ];
}
