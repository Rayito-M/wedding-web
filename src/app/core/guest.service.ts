import { Injectable, computed, signal } from '@angular/core';
import { WEDDING_DATE, daysUntilWedding } from './wedding-date';

export interface PersonalScheduleItem {
  t: string;
  title: string;
  sub: string;
}

export interface Guest {
  name: string;
  initial: string;
  seat: string;
  stay: string;
  partySize: number;
  partyLabel: string;
  dietLabel: string;
  schedule: PersonalScheduleItem[];
}

/** Invitee identity, seat assignment and personal schedule (mock data). */
@Injectable({ providedIn: 'root' })
export class GuestService {
  readonly guest = signal<Guest>({
    name: 'Laura',
    initial: 'L',
    seat: 'Mesa de los olivos · 7',
    stay: 'Hotel Casa 1800',
    partySize: 2,
    partyLabel: 'You + Marco',
    dietLabel: 'Vegetarian, gluten-free',
    schedule: [
      { t: '15:30', title: 'Welcome drinks', sub: 'Under the olive trees' },
      { t: '16:30', title: 'Ceremony', sub: 'Patio principal' },
      { t: '19:00', title: 'Dinner', sub: 'Mesa de los olivos · seat 7' },
    ],
  });

  readonly weddingDate = WEDDING_DATE;
  readonly daysToGo = computed(() => daysUntilWedding());
}
