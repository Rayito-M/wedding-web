import { Injectable, computed, signal } from '@angular/core';
import { daysUntilWedding } from './wedding-date';

export interface DashboardTask {
  t: string;
  due: string;
  done: boolean;
}

/** Couple dashboard aggregates: RSVP stats, budget, vendors, task list. */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  readonly rsvp = signal({ yes: 142, pending: 18, no: 12, total: 172 });
  readonly budget = signal({ spent: '€18.4k', total: 'of €22k' });
  readonly vendors = signal({ value: '9/11', sub: 'confirmed' });

  readonly repliedPct = computed(() => {
    const { yes, no, total } = this.rsvp();
    return Math.round(((yes + no) / total) * 100);
  });

  readonly daysToGo = computed(() => daysUntilWedding());

  readonly tasks = signal<DashboardTask[]>([
    { t: 'Confirm dinner menu with Marta', due: 'Today', done: false },
    { t: 'Finalize seating plan', due: 'Apr 22', done: false },
    { t: 'Send playlist link to DJ', due: 'Apr 28', done: true },
    { t: 'Pick up rings', due: 'May 30', done: false },
  ]);

  toggleTask(index: number): void {
    this.tasks.update((tasks) =>
      tasks.map((task, i) => (i === index ? { ...task, done: !task.done } : task)),
    );
  }
}
