import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * In-place loading state for a screen region — the content area below a
 * screen's own header, while an `EntityCollectionService` read is in flight.
 *
 * The sibling `app-loading` is a **fixed, full-viewport** overlay: it covers
 * the chrome (top nav, tab bar) as well as the screen, which is right for a
 * whole-app boot but wrong for a screen that has already drawn its header and
 * is only waiting on its list. This one occupies whatever box its parent gives
 * it — `flex: 1` inside a flex column, `height: 100%` otherwise — so the
 * header stays on screen and only the region that has nothing to show yet is
 * replaced.
 *
 * `role="status"` (an implicit `aria-live="polite"`) announces the wait once
 * without stealing focus, and the label is real text rather than a
 * colour/motion-only cue.
 */
@Component({
  selector: 'app-content-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './content-loading.html',
  styleUrl: './content-loading.scss',
})
export class ContentLoading {
  /**
   * Translation key for the line under the spinner. Defaults to the shared
   * "Loading…" copy; pass a screen-specific key ("guest_manager.list.loading")
   * when the wait is worth naming.
   */
  readonly label = input<string>('shared.loading');
}
