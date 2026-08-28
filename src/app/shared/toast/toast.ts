import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { Icon, type IconName } from '@app/shared/icons/icon';

/**
 * Transient, non-blocking notification (DS `overlays/Toast`, commit `7db5d1c`).
 * Presentational only — the host owns the list and reacts to `(close)`/`(action)`.
 * Always rendered inside an `app-toast-stack` (`Toast.prompt.md`: "Always render
 * toasts inside a ToastStack, never loose"). No call site yet — T285 mounts the
 * stack, T289 is the first producer (Phase O).
 */
@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './toast.html',
  styleUrl: './toast.scss',
  imports: [Icon, TranslatePipe],
  host: {
    '[class.tone-neutral]': "tone() === 'neutral'",
    '[class.tone-accent]': "tone() === 'accent'",
    '[class.tone-provisional]': "tone() === 'provisional'",
    '[class.tone-danger]': "tone() === 'danger'",
    '[class.filled]': "variant() === 'filled'",
    '[class.translucent]': 'translucent()',
    // `danger` is the only tone that must interrupt a screen reader mid-speech
    // (Toast.jsx:30-31) — every other tone is a polite, queued announcement.
    '[attr.role]': "tone() === 'danger' ? 'alert' : 'status'",
    '[attr.aria-live]': "tone() === 'danger' ? 'assertive' : 'polite'",
  },
})
export class Toast {
  readonly title = input<string>();
  readonly meta = input<string>();
  readonly icon = input<IconName>();
  readonly tone = input<'neutral' | 'accent' | 'provisional' | 'danger'>('neutral');
  readonly variant = input<'surface' | 'filled'>('surface');
  /** Softens the fill with `color-mix` and adds the system's one blur — Album
   *  screen over guest photography only (`Toast.prompt.md` §Translucent). */
  readonly translucent = input(false);
  /** Auto-hide after N ms. Omit to keep the toast until dismissed. The
   *  component honours whatever it is given — it never inspects `actionLabel`
   *  or `tone` to veto a delay; the "never auto-hide a failure or an action
   *  toast" rule (`Toast.prompt.md` §Timing) is enforced by the caller
   *  (T285's service, T289's producer), same division of labour as the DS
   *  reference (`Toast.jsx`). */
  readonly delay = input<number>();
  /** Verb-first, short action label ("View agenda"). No label, no button —
   *  same gate as the `.d.ts`'s `action` object, but split into an
   *  input/output pair per hard rule 5 (an object input carrying a callback
   *  is not the Angular idiom for an event). */
  readonly actionLabel = input<string>();
  /** Default true. Set false only when `delay` is set
   *  (`Toast.d.ts`: "Default true. Set false only when delay is set"). */
  readonly dismissible = input(true);

  /** Fired by the ✕ and by the auto-hide timer — remove the toast from the
   *  host's list. */
  // reason: named `close` to match the DS contract (`Toast.d.ts`'s
  // `onClose`) name for name, same precedent as `app-modal`'s own `close`
  // output and `app-confirm-dialog`'s `cancel` — `app-toast` is a custom
  // element with no native `close` event to shadow.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();
  readonly action = output<void>();

  constructor() {
    // Mirrors `Toast.jsx`'s `useEffect(() => {...}, [delay])`: only `delay()`
    // is read, so the timer arms once and never restarts for an unrelated
    // input change (title, meta, tone, …). Angular calls the `onCleanup`
    // callback both when the effect re-runs (a genuine `delay` change) and on
    // component destroy, so no timer can outlive this instance.
    effect((onCleanup) => {
      const ms = this.delay();
      if (ms === undefined) return;
      const id = setTimeout(() => this.close.emit(), ms);
      onCleanup(() => clearTimeout(id));
    });
  }

  protected onDismiss(): void {
    this.close.emit();
  }

  protected onAction(): void {
    this.action.emit();
  }
}
