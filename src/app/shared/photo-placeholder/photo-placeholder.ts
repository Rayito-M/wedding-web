import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Photo placeholder with subtle diagonal stripes + optional caption.
 *  Size/radius are set by the parent on the host element. */
@Component({
  selector: 'app-photo-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="viewBox()" preserveAspectRatio="none" aria-hidden="true">
      @for (s of stripes(); track $index) {
        <line
          [attr.x1]="s.x1"
          [attr.y1]="s.y1"
          [attr.x2]="s.x2"
          [attr.y2]="s.y2"
          style="stroke: var(--line)"
          stroke-width="0.3"
        />
      }
    </svg>
    @if (label()) {
      <div class="caption">{{ label() }}</div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      background: var(--chip);
      overflow: hidden;
      color: var(--sub);
    }
    svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
    .caption {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: ui-monospace, 'SF Mono', Menlo, monospace;
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.7;
    }
  `,
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
