import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GuestService } from '../../core/guest.service';
import { DecorFish } from '../../shared/decor/fish';
import { Monogram } from '../../shared/monogram/monogram';
import { ProgressBar } from '../../shared/progress-bar/progress-bar';
import { StatTile } from '../../shared/stat-tile/stat-tile';

@Component({
  selector: 'app-invitee',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Monogram, DecorFish, ProgressBar, StatTile],
  templateUrl: './invitee.html',
  styleUrl: './invitee.scss',
})
export class Invitee {
  protected readonly guests = inject(GuestService);
}
