import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  NotificationDto,
  TranslateLanguageService,
  bodyKeyFor,
  iconFor,
  titleKeyFor,
  typeLabelKeyFor,
} from '@app/core';
import { Btn } from '@app/shared/button/button';
import { Icon } from '@app/shared/icons/icon';
import { Modal } from '@app/shared/modal/modal';

/**
 * Detail view for a single notification (DS `overlays/NotificationDialog`,
 * commit `7db5d1c`), opened from `NotificationBell` (T288, not this task).
 * Same modal grammar as `ConfirmDialog` — this thinly composes `app-modal`
 * rather than re-authoring a scrim/panel (Phase O decision 2). `open()` and
 * `notification()` are both owned by the host; this component wires no call
 * site of its own.
 *
 * **The open is the read receipt and only that** (`NotificationDialog.prompt.md`,
 * Phase O decision 8): this component performs no API call of any kind and
 * never grows a "mark as read" control. `iconFor`/`typeLabelKeyFor`/
 * `titleKeyFor`/`bodyKeyFor` are plain, dependency-free functions exported
 * alongside `NotificationCenterService` (not methods on it) — imported
 * directly rather than injecting the service for functions that need no
 * instance state, which keeps this component's only two Angular
 * dependencies (`TranslateService`/`TranslateLanguageService`) exactly the
 * ones the resolved title and the localized timestamp need.
 */
@Component({
  selector: 'app-notification-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-dialog.html',
  styleUrl: './notification-dialog.scss',
  imports: [Modal, Btn, Icon, DatePipe, TranslatePipe],
  host: {
    // Scoped to this component's own host, not `window` — the same reasoning
    // as `ConfirmDialog` (Phase M decision 5): this dialog opens from inside
    // the private shell's header (T288), and a `window` listener would close
    // whatever else is also listening for Escape at that level.
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class NotificationDialog {
  readonly open = input(false);
  readonly notification = input<NotificationDto | null>(null);
  /** No label = no action button (`NotificationDialog.d.ts`). */
  readonly actionLabel = input<string>();

  readonly action = output<void>();
  // reason: named `close` to match the DS contract (`NotificationDialog.d.ts`'s
  // `onClose`) and this repo's own `Modal`/`Toast` precedent for a custom
  // element with no native `close` event to shadow.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();

  private readonly translateService = inject(TranslateService);
  private readonly langService = inject(TranslateLanguageService);

  /** `LangCode`, read reactively so the resolved title/body re-translate on a
   *  language switch while the dialog happens to stay open (same hazard
   *  `people.ts`'s `filteredPeople` comment documents for `.instant()`), and
   *  also the locale `DatePipe` needs for the kicker timestamp per the task
   *  (not the browser's own locale). */
  protected readonly lang = this.langService.currentLang;

  protected readonly icon = computed(() => {
    const n = this.notification();
    return n ? iconFor(n) : undefined;
  });

  protected readonly typeLabelKey = computed(() => {
    const n = this.notification();
    return n ? typeLabelKeyFor(n) : '';
  });

  /**
   * Plain, already-resolved string — `app-modal`'s `[title]` input renders it
   * raw (no `translate` pipe inside `Modal`'s own template), so this
   * component resolves it here via `TranslateService.instant`. Safe for a
   * literal record title too: `titleKeyFor`'s doc comment notes this app
   * registers no `missingTranslationHandler`, so `instant()` on an unmatched
   * literal echoes it back unchanged.
   */
  protected readonly resolvedTitle = computed(() => {
    this.lang();
    const n = this.notification();
    return n ? this.translateService.instant(titleKeyFor(n)) : '';
  });

  /** Same rule as {@link resolvedTitle}, for the body — kept as a translate
   *  key/literal rather than pre-resolved since the body is projected content
   *  and the `translate` pipe already handles it reactively in the template. */
  protected readonly bodyKey = computed(() => {
    const n = this.notification();
    return n ? bodyKeyFor(n) : '';
  });

  private readonly closeBtnRef = viewChild<unknown, ElementRef<HTMLButtonElement>>('closeBtn', {
    read: ElementRef,
  });
  private readonly actionBtnRef = viewChild<unknown, ElementRef<HTMLButtonElement>>('actionBtn', {
    read: ElementRef,
  });

  /** Captured on open, restored on close — the trigger (T288's bell row) is
   *  never destroyed by opening this dialog, unlike `ConfirmDialog`'s confirm
   *  path, so this always runs. */
  private restoreFocusTo: HTMLElement | null = null;

  constructor() {
    // Focus Close on mount — the opposite of `ConfirmDialog`'s confirm-first
    // rule and deliberately so (`NotificationDialog.jsx:22`,
    // `querySelector('button[data-close]').focus()`): nothing here is
    // destructive, so none of `ConfirmDialog`'s held-Enter auto-repeat guard
    // (Phase M decision 8) applies or is wanted. `afterRenderEffect` (not a
    // plain `effect()`) for the same reason as `ConfirmDialog`: Close is
    // projected into `app-modal`'s own `@if`-gated template, so a plain
    // `effect()` can run before that child has attached it.
    afterRenderEffect(() => {
      if (this.open() && this.notification()) {
        this.restoreFocusTo = document.activeElement as HTMLElement | null;
        this.closeBtnRef()?.nativeElement.focus();
      }
    });
  }

  protected onEscape(event: Event): void {
    if (!this.open() || !this.notification()) return;
    event.stopPropagation();
    this.emitClose();
  }

  /** Focus trap, forward direction. With `actionLabel()` set, Close (first in
   *  DOM order) tabbing forward naturally reaches the action button — nothing
   *  to intercept. Without it, Close is the only focusable element, so a
   *  plain Tab would otherwise leave the dialog for whatever is behind it. */
  protected onCloseKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    if (event.shiftKey) {
      event.preventDefault();
      (this.actionLabel() ? this.actionBtnRef() : this.closeBtnRef())?.nativeElement.focus();
    } else if (!this.actionLabel()) {
      event.preventDefault();
      this.closeBtnRef()?.nativeElement.focus();
    }
  }

  /** Focus trap, other half: Tab from the action button (last in DOM order)
   *  wraps back to Close, closing the loop. Shift+Tab from it is the natural
   *  default (back to Close) and needs no handling. */
  protected onActionKeydown(event: KeyboardEvent): void {
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      this.closeBtnRef()?.nativeElement.focus();
    }
  }

  protected onClose(): void {
    this.emitClose();
  }

  protected onAction(): void {
    this.action.emit();
  }

  private emitClose(): void {
    this.restoreFocusTo?.focus();
    this.close.emit();
  }
}
