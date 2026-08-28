import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import {
  NOTIFICATIONS_LOAD_ERROR_KEY,
  NotificationCenterService,
  NotificationDto,
  TranslateLanguageService,
  bodyKeyFor,
  iconFor,
  titleKeyFor,
} from '@app/core';
import { Icon, type IconName } from '@app/shared/icons/icon';
import { NotificationDialog } from '@app/shared/notification-dialog/notification-dialog';

/**
 * Relative-time bucket for one dropdown row (`NotificationBell.jsx:10-20`,
 * retargeted onto `notifications.ago.*`). Past seven days there is no i18n
 * key — the row falls back to a locale-formatted date instead
 * (`| date: 'd MMM' : '' : lang()`), so `key`/`params` are unused and the
 * template branches on `pastWeek`.
 */
interface AgoBucket {
  pastWeek: boolean;
  key: string;
  params?: { count: number };
}

function agoBucket(iso: string, nowMs: number): AgoBucket {
  const elapsedMs = nowMs - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(elapsedMs / 60000));
  if (minutes < 1) return { pastWeek: false, key: 'notifications.ago.now' };
  if (minutes < 60) {
    return { pastWeek: false, key: 'notifications.ago.minutes', params: { count: minutes } };
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return { pastWeek: false, key: 'notifications.ago.hours', params: { count: hours } };
  }
  const days = Math.round(hours / 24);
  if (days < 7) {
    return { pastWeek: false, key: 'notifications.ago.days', params: { count: days } };
  }
  return { pastWeek: true, key: '' };
}

/** One dropdown row, pre-computed from a `NotificationDto` — the pure inputs
 *  `notification-bell.html` needs, per ADR W-0005's rendering helpers
 *  (T286). */
interface NotificationRow {
  notification: NotificationDto;
  unread: boolean;
  icon: IconName;
  titleKey: string;
  bodyKey: string;
  ago: AgoBucket;
}

/**
 * Header bell (DS `navigation/NotificationBell`, commit `7db5d1c`). Owns no
 * data of its own: it injects {@link NotificationCenterService} (T286) for
 * state and writes, and renders {@link NotificationDialog} (T287) for the
 * detail view. Every input here is purely presentational (`size`).
 *
 * Dismissal mirrors `ScreenHeader`'s existing account menu exactly:
 * `@HostListener('document:click')` closes the dropdown, and the toggle's
 * own click handler calls `stopPropagation()` so the click that opens it
 * doesn't immediately re-close it via that same document listener. Escape
 * gets the same document-scoped shape. This intentionally does not collide
 * with `NotificationDialog`'s own `(keydown.escape)` host listener: that
 * binding lives on the dialog's own host and calls `stopPropagation()`, so
 * pressing Escape while the dialog is open never reaches this component's
 * document listener at all — only the dialog closes, per the task's "Escape
 * while the dialog is open must close the dialog, not the (already closed)
 * dropdown" rule.
 */
@Component({
  selector: 'app-notification-bell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
  imports: [Icon, NotificationDialog, TranslatePipe, DatePipe],
  host: {
    // Button diameter (`NotificationBell.d.ts` `size`, default 30) — the one
    // dynamic numeric dimension this component owns. Same technique as
    // `Monogram`'s `[style.font-size.px]`: a `[style.*]` host binding driven
    // by the component's own input, not a hardcoded inline style.
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
})
export class NotificationBell {
  protected readonly center = inject(NotificationCenterService);
  private readonly langService = inject(TranslateLanguageService);

  /** Button diameter in px. Default 30 (`NotificationBell.d.ts`). */
  readonly size = input(30);
  /** How many recent rows the dropdown shows. Default 5 (`NotificationBell.d.ts`). */
  readonly limit = input(5);

  protected readonly iconSize = computed(() => Math.round(this.size() * 0.62));

  /** Reactive `LangCode` — both the dropdown's relative-date fallback
   *  (`DatePipe`'s locale param) and `NotificationDialog`'s own timestamp
   *  need the *app's* current language, never the browser's. */
  protected readonly lang = this.langService.currentLang;

  protected readonly open = signal(false);
  protected readonly selected = signal<NotificationDto | null>(null);

  protected readonly hasUnread = computed(() => this.center.unreadCount() > 0);

  /**
   * The list-fetch failure only, rendered inline below the header (T289) —
   * `center.error()` also carries `markRead`/`markAllRead` failures, which
   * get a toast instead (`NotificationCenterService`'s doc comment) and must
   * not double up as a second, in-dropdown copy of the same failure.
   */
  protected readonly loadError = computed(
    () => this.center.error() === NOTIFICATIONS_LOAD_ERROR_KEY,
  );

  protected readonly badgeLabel = computed(() => {
    const count = this.center.unreadCount();
    return count > 9 ? '9+' : String(count);
  });

  protected readonly ariaLabelKey = computed(() =>
    this.hasUnread() ? 'notifications.ariaLabelUnread' : 'notifications.ariaLabel',
  );
  protected readonly ariaLabelParams = computed(() => ({ count: this.center.unreadCount() }));

  /** The five (or `limit()`) most recent rows, sliced from the service's
   *  already newest-first list (ADR W-0005 decision 4 / T286). `Date.now()`
   *  is read once per recompute, same as `NotificationBell.jsx:26`'s `now`
   *  — no ticking timer (out of scope; see `NotificationCenterService`'s
   *  doc comment on polling). */
  protected readonly rows = computed<NotificationRow[]>(() => {
    const now = Date.now();
    return this.center
      .notifications()
      .slice(0, this.limit())
      .map((n) => ({
        notification: n,
        unread: n.status === NotificationDto.StatusEnum.UNREAD,
        icon: iconFor(n),
        titleKey: titleKeyFor(n),
        bodyKey: bodyKeyFor(n),
        ago: agoBucket(n.createdAt, now),
      }));
  });

  constructor() {
    // Refresh policy owned by `NotificationCenterService` (T286): the
    // unread count is fetched once per session, on the bell's mount.
    void this.center.ensureUnreadCount();
  }

  /** Bell button click — mirrors `ScreenHeader.toggleMenu`: `stopPropagation`
   *  so the same click that opens the dropdown doesn't immediately trigger
   *  {@link closeDropdown} via the document listener below. Opening always
   *  re-fetches the list (T286 refresh policy — no caching across opens). */
  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    const next = !this.open();
    this.open.set(next);
    if (next) {
      void this.center.refreshList();
    }
  }

  /** "Mark all read" — stays visible only while {@link hasUnread}. */
  protected markAllRead(event: MouseEvent): void {
    event.stopPropagation();
    void this.center.markAllRead();
  }

  /**
   * A row's whole click surface. Closes the dropdown, opens the detail
   * dialog, and — the read receipt (decision 8) — calls `markRead` exactly
   * once, only when the record is not already read. Never on hover, never
   * when the dropdown opens, never from inside the dialog.
   */
  protected selectRow(notification: NotificationDto, event: MouseEvent): void {
    event.stopPropagation();
    this.open.set(false);
    this.selected.set(notification);
    if (notification.status === NotificationDto.StatusEnum.UNREAD) {
      void this.center.markRead(notification.id);
    }
  }

  protected closeDialog(): void {
    this.selected.set(null);
  }

  /** Mirrors `ScreenHeader.closeMenu` — any click outside the toggle (which
   *  stops its own propagation) closes the dropdown. */
  @HostListener('document:click')
  protected closeDropdown(): void {
    this.open.set(false);
  }

  /** Same document-scoped shape as {@link closeDropdown}. A harmless no-op
   *  while already closed — e.g. while the dialog (a separate,
   *  stopped-propagation Escape listener on its own host) is open. */
  @HostListener('document:keydown.escape')
  protected closeDropdownOnEscape(): void {
    this.open.set(false);
  }
}
