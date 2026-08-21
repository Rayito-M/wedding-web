import { Injectable, computed, signal } from '@angular/core';
import { daysUntilWedding } from './helper';

export interface DashboardTask {
  t: string;
  due: string;
  done: boolean;
}

/**
 * Couple dashboard aggregates: countdown, budget, vendors, task list.
 *
 * RSVP counts are not here — they come from `StatisticService`, which derives
 * them from the real `UserProfile` collection and is shared with the guest
 * manager. Everything below is still mock data.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  readonly budget = signal({ spent: '€18.4k', total: 'of €22k' });
  readonly vendors = signal({ value: '9/11', sub: 'confirmed' });

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
