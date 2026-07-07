import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { mediaSignal } from '../../core/media-signal';
import { Btn } from '../../shared/button/button';
import { DecorAlhambra } from '../../shared/decor/alhambra';
import { DecorFishPair } from '../../shared/decor/fish-pair';
import { DecorSun } from '../../shared/decor/sun';
import { Pill } from '../../shared/pill/pill';

@Component({
  selector: 'app-welcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Pill, Btn, DecorSun, DecorFishPair, DecorAlhambra],
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome {
  private readonly router = inject(Router);
  protected readonly desktop = mediaSignal('(min-width: 1024px)');

  open(): void {
    this.router.navigateByUrl('/schedule');
  }
}
