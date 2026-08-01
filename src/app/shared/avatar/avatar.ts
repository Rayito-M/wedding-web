import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Circular avatar with initials or monogram (DS core/Avatar).
 * Renders centered initials in serif font, with theme-aware background.
 *
 * Size input is in pixels; font-size is calculated as Math.max(10, Math.round(size * 0.46))
 * per the DS formula, matching the visual weight of initials at various scales.
 *
 * Content projection: pass text (initials) or an <img> tag for photo avatars.
 * Use the `accent` input to render in accent color instead of soft (e.g. for the couple,
 * the current user, or emphasized roles).
 */
@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar.html',
  styleUrl: './avatar.scss',
  standalone: true,
  host: {
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'computedFontSize()',
    '[class.accent]': 'accent()',
  },
})
export class Avatar {
  /** Size in pixels (width and height, since it's a circle). Default 26px. */
  readonly size = input(26);

  /** If true, render accent background + foreground color; else soft background. */
  readonly accent = input(false);

  /** Computed font-size based on the DS formula: Math.max(10, Math.round(size * 0.46)). */
  readonly computedFontSize = computed(() => Math.max(10, Math.round(this.size() * 0.46)));
}
