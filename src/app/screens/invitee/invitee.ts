import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GuestService } from '../../core/guest.service';
import { DecorFish } from '../../shared/decor/fish';
import { Monogram } from '../../shared/monogram/monogram';

@Component({
  selector: 'app-invitee',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Monogram, DecorFish],
  templateUrl: './invitee.html',
  styleUrl: './invitee.scss',
})
export class Invitee {
  protected readonly guests = inject(GuestService);
}
