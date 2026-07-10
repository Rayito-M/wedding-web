import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Photo placeholder (DS data-display/PhotoPlaceholder) — chip tile with
 *  subtle diagonal stripes + optional mono caption. Size/radius set by parent. */
@Component({
  selector: 'app-photo-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './photo-placeholder.html',
  styleUrl: './photo-placeholder.scss',
})
export class PhotoPlaceholder {
  readonly label = input('');
  readonly ratio = input(1);

  protected readonly viewBox = computed(() => `0 0 100 ${100 * this.ratio()}`);
  protected readonly stripes = computed(() => {
    const h = 100 * this.ratio();
    return Array.from({ length: 18 }, (_, i) => ({
      x1: -10 + i * 8,
      y1: h + 10,
      x2: 20 + i * 8,
      y2: -10,
    }));
  });
}
