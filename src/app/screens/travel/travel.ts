import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Monogram } from '../../shared/monogram/monogram';
import { StayCard } from '../../shared/stay-card/stay-card';

interface Stay {
  name: string;
  km: string;
  tag: string;
  price: string;
}

@Component({
  selector: 'app-travel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Monogram, StayCard],
  templateUrl: './travel.html',
  styleUrl: './travel.scss',
})
export class Travel {
  protected readonly stays: Stay[] = [
    { name: 'Palacio de los Córdova', km: '0 km · the venue', tag: 'Venue', price: '—' },
    { name: 'Hotel Casa 1800', km: '0.6 km · 16th-c. carmen', tag: 'Recommended', price: '€190' },
    { name: 'Carmen de la Victoria', km: '0.3 km · Alhambra view', tag: 'Boutique', price: '€150' },
    { name: 'Hostal Verde Albaicín', km: '0.5 km · whitewashed', tag: 'Budget', price: '€70' },
  ];
}
