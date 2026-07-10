import { ChangeDetectionStrategy, Component, input } from '@angular/core';

interface Ray {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const RAYS: Ray[] = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI * 2) / 12;
  return {
    x1: 40 + Math.cos(a) * 22,
    y1: 40 + Math.sin(a) * 22,
    x2: 40 + Math.cos(a) * 32,
    y2: 40 + Math.sin(a) * 32,
  };
});

/** 12-ray sun (DS illustrations/SunIllustration). */
@Component({
  selector: 'app-decor-sun',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sun.html',
  styleUrl: './decor.scss',
})
export class DecorSun {
  readonly color = input('var(--accent-2)');
  readonly size = input(80);
  protected readonly rays = RAYS;
}
