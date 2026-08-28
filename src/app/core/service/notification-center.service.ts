import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import type { IconName } from '@app/shared/icons/icon';

import { MilestoneDto, NotificationDto, WeddingNotificationsService } from '../api';

import { ToastCenterService } from './toast-center.service';

/**
 * The four `templateId`/`type` values in circulation today (ADR W-0005
 * decision 2/3) — the milestone announcement fan-out is the only producer
 * and sets `type = templateId = announcementType`
 * (`wedding-api/…/announcement.service.ts:286-289`). Read off the generated
 * `MilestoneDto.AnnouncementTypeEnum` rather than hand-copied into a new
 * union — hard rule 15 forbids the latter even though this is a lookup
 * table, not a type declaration.
 */
const TYPE_ICON: Record<string, IconName> = {
  [MilestoneDto.AnnouncementTypeEnum.SAVE_THE_DATE]: 'calendar',
  [MilestoneDto.AnnouncementTypeEnum.INVITATION]: 'mail',
  [MilestoneDto.AnnouncementTypeEnum.RSVP_REMINDER]: 'mail',
  [MilestoneDto.AnnouncementTypeEnum.MENU_SELECTION_REMINDER]: 'edit',
};

const KNOWN_TEMPLATE_IDS = new Set<string>(Object.values(MilestoneDto.AnnouncementTypeEnum));

/**
 * The i18n key {@link NotificationCenterService.error} is set to on a list
 * or count fetch failure — exported so `notification-bell.ts` (T289) can
 * tell that case apart from a `markRead`/`markAllRead` failure (which gets a
 * toast, not this inline copy) without hand-copying the string literal.
 */
export const NOTIFICATIONS_LOAD_ERROR_KEY = 'notifications.errors.load';

/**
 * `type` is a deliberately open string on the contract (ADR W-0005 decision
 * 2), never an enum — `TYPE_ICON[n.type] ?? 'info'` is the whole rule.
 * Unrecognised values (including anything outside today's four) render with
 * the generic `info` glyph, never blank and never a thrown lookup.
 */
export function iconFor(n: NotificationDto): IconName {
  return TYPE_ICON[n.type] ?? 'info';
}

/**
 * The dialog kicker's i18n key, `notifications.typeLabel.<type>`, or
 * `.fallback` for anything outside the known four (ADR W-0005 decision 3,
 * one level up from the title/body catalogue).
 */
export function typeLabelKeyFor(n: NotificationDto): string {
  return KNOWN_TEMPLATE_IDS.has(n.type)
    ? `notifications.typeLabel.${n.type}`
    : 'notifications.typeLabel.fallback';
}

/**
 * ADR W-0005 decision 3: the record's own `title` wins when it is a
 * non-empty string (a frozen snapshot always wins); otherwise the
 * `templateId`-keyed catalogue in `public/i18n/{en,es,fr}.json` fills in,
 * falling back to `notifications.template.fallback.title` for an unknown
 * `templateId`. The literal case and the key case are both returned as a
 * plain string on purpose: this app registers no `missingTranslationHandler`
 * (`app.config.ts`), so ngx-translate's default handler echoes back an
 * unmatched key unchanged — piping *either* return value through
 * `| translate` in the template is safe, because a literal title/body will
 * never coincidentally match a real catalogue key.
 */
export function titleKeyFor(n: NotificationDto): string {
  if (n.title && n.title.trim().length > 0) return n.title;
  return KNOWN_TEMPLATE_IDS.has(n.templateId)
    ? `notifications.template.${n.templateId}.title`
    : 'notifications.template.fallback.title';
}

/** Same rule as {@link titleKeyFor}, for `body`. */
export function bodyKeyFor(n: NotificationDto): string {
  if (n.body && n.body.trim().length > 0) return n.body;
  return KNOWN_TEMPLATE_IDS.has(n.templateId)
    ? `notifications.template.${n.templateId}.body`
    : 'notifications.template.fallback.body';
}

/** Defensive sort, newest first — the API documents this ordering already
 *  but a client-side re-sort costs five lines and removes the dependency. */
function sortByCreatedAtDesc(items: NotificationDto[]): NotificationDto[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * The signals read/write model over `WeddingNotificationsService` (generated) —
 * the one place in this app that talks to `/v1/notifications*`.
 *
 * **Not `@ngrx/data`.** Two of the four endpoints (`unread-count`,
 * `read-all`) are aggregates, not entity CRUD; the write this service
 * exposes is a server-driven state flip (`status: unread -> read`), not a
 * client-authored patch; there is no create or delete; and the read model is
 * a single unpaginated page (ADR W-0005 decision 4 — the generated
 * `notificationsControllerListV1()` takes no cursor/limit). None of that
 * matches the entity-collection shape `@ngrx/data` is for. A plain signals
 * service is the honest fit here — precedent: `StatisticService` (signals
 * service over a cache), `MilestoneDataService.send()`/`.clearAnnouncement()`
 * (non-CRUD sub-action goes straight at the generated client).
 *
 * **Refresh policy — this and nothing more:**
 * - `unreadCount` is fetched once on first use ({@link ensureUnreadCount}, the
 *   bell's mount) and re-fetched after every successful write.
 * - `notifications` (the list) is fetched lazily, on demand
 *   ({@link refreshList}) — the bell calls it on first dropdown open and
 *   again on every subsequent open. This service does not remember whether
 *   it has been asked before; the caller decides when "open" happens.
 * - **No polling, no `setInterval`, no websocket, no visibility/focus
 *   listener.** Explicitly out of scope for this phase: a battery-and-cost
 *   decision with no requirement behind it, so adding one silently here
 *   would be scope creep.
 *
 * **Never fires for an anonymous user.** Everything above is pull-only and
 * driven entirely by the bell inside `PrivateLayout`'s `app-screen-header`.
 * Nothing in this service self-initiates — no `APP_INITIALIZER`, no call
 * from `App` or a public route. Injecting this service does nothing on its
 * own; the first fetch only happens when a caller invokes
 * {@link ensureUnreadCount} or {@link refreshList}.
 *
 * **Write failure surfacing (T289):** every failure — list fetch, count
 * fetch, `markRead`, `markAllRead` — sets {@link error}, a
 * `signal<string | undefined>` holding an i18n key (or `undefined`), the
 * same shape `LoginService.error` already uses; the bell reads it to render
 * the list-fetch failure inline in the dropdown (a failure the user is
 * already looking at needs no second surface, per the DS's "one idea per
 * toast" rule).
 *
 * `markRead`/`markAllRead` failures get a **second** surface: this service
 * injects {@link ToastCenterService} directly and calls `show()` itself
 * (`tone: 'danger'`, `icon: 'warning'`), rather than leaving it to the bell.
 * Chosen over "bell raises the toast" because a write failure here always
 * means the same thing regardless of caller — today that is only the bell,
 * but a future caller (a notifications settings screen, say) would
 * otherwise have to remember to re-implement the same danger-toast call
 * `NotificationCenterService` already knows how to make. `ToastCenterService`
 * has no constructor dependencies of its own (`toast-center.service.ts`), so
 * this does not cost `NotificationCenterService`'s unit-testability: nothing
 * beyond `provideTranslateService(...)` — needed anyway to resolve the toast
 * copy via `TranslateService.instant()`, since `app-toast` renders `title`
 * verbatim, not through a pipe — has to be added to this spec's `TestBed`;
 * no toast stack or DOM needs to be mounted.
 */
@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly api = inject(WeddingNotificationsService);
  private readonly toastCenter = inject(ToastCenterService);
  private readonly translate = inject(TranslateService);

  private readonly _notifications = signal<NotificationDto[]>([]);
  /** The most recent page (one unpaginated page — decision 4), newest first. */
  readonly notifications = this._notifications.asReadonly();

  private readonly _unreadCount = signal(0);
  /**
   * Sourced from `notificationsControllerUnreadCountV1()` — **never**
   * derived by counting {@link notifications}. The count endpoint is
   * documented as cheap and meant to drive a badge without fetching the
   * list, and the list is a single page, so counting it would under-report
   * whenever there are more unread notifications than fit on that page.
   */
  readonly unreadCount = this._unreadCount.asReadonly();

  private readonly _loading = signal(false);
  /** True only while {@link refreshList} is in flight — the dropdown's
   *  primary blocking fetch. Count refreshes and the optimistic writes below
   *  do not toggle this; they are not something the UI need block on. */
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | undefined>(undefined);
  /** Last error's i18n key, or `undefined` once the next action starts or
   *  succeeds. See the class doc comment for why this is a signal and not a
   *  toast call. */
  readonly error = this._error.asReadonly();

  private countRequested = false;

  /** Raises the one danger toast this service ever produces (T289) — a
   *  write failure the optimistic-flip recovery above has already reverted
   *  or re-read. Passing no `delay` is what keeps it on screen until
   *  dismissed: `tone: 'danger'` is enough to make
   *  {@link ToastCenterService.show} default to no auto-hide and force
   *  `dismissible: true` (its own doc comment). Do not add a `delay` here —
   *  an explicit one would override that default. */
  private showWriteFailureToast(errorKey: string): void {
    this.toastCenter.show({
      tone: 'danger',
      icon: 'warning',
      title: this.translate.instant(errorKey),
      dismissible: true,
    });
  }

  /** Fetch {@link unreadCount} once. Safe to call on every bell mount — a
   *  no-op after the first successful or failed attempt in this session. */
  async ensureUnreadCount(): Promise<void> {
    if (this.countRequested) return;
    this.countRequested = true;
    await this.refreshUnreadCount();
  }

  private async refreshUnreadCount(): Promise<void> {
    try {
      const res = await firstValueFrom(this.api.notificationsControllerUnreadCountV1());
      this._unreadCount.set(res.count);
    } catch {
      this._error.set(NOTIFICATIONS_LOAD_ERROR_KEY);
    }
  }

  /** Fetch (or re-fetch) {@link notifications}. Call every time the dropdown
   *  opens — this service does not cache across calls. */
  async refreshList(): Promise<void> {
    this._loading.set(true);
    this._error.set(undefined);
    try {
      const res = await firstValueFrom(this.api.notificationsControllerListV1());
      this._notifications.set(sortByCreatedAtDesc(res.items));
    } catch {
      this._error.set(NOTIFICATIONS_LOAD_ERROR_KEY);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * `PATCH /v1/notifications/{id}` (decision 8 — *not* the `POST …/read`
   * the DS prompt names; the generated client is authoritative). Optimistic:
   * flips the record's `status` to `read` and decrements {@link unreadCount}
   * immediately, then reconciles with the server response and re-fetches
   * the count (refresh policy: every successful write re-fetches it). On
   * failure, reverts both to their pre-call snapshot and surfaces
   * `notifications.errors.markRead` via {@link error}.
   *
   * A no-op — no HTTP call — when `id` is not in the currently loaded list,
   * or is already `read`. The generated endpoint is idempotent server-side
   * (decision 8's doc comment), so this guard is a safety net rather than a
   * correctness requirement: every caller in this system fires `markRead`
   * from a record it just rendered in the loaded list (decision 8), so
   * "not found" should not happen in practice, and "already read" is the
   * one case the acceptance criteria call out explicitly. The caller's own
   * unread guard (T288) is the primary gate — this one just makes the
   * service safe to call defensively.
   */
  async markRead(id: string): Promise<void> {
    const previousList = this._notifications();
    const idx = previousList.findIndex((n) => n.id === id);
    if (idx === -1 || previousList[idx].status === NotificationDto.StatusEnum.READ) {
      return;
    }

    const previousCount = this._unreadCount();

    const optimistic = [...previousList];
    optimistic[idx] = { ...previousList[idx], status: NotificationDto.StatusEnum.READ };
    this._notifications.set(optimistic);
    this._unreadCount.set(Math.max(0, previousCount - 1));
    this._error.set(undefined);

    try {
      const updated = await firstValueFrom(this.api.notificationsControllerMarkReadV1({ id }));
      this._notifications.set(
        sortByCreatedAtDesc(this._notifications().map((n) => (n.id === id ? updated : n))),
      );
      await this.refreshUnreadCount();
    } catch {
      this._notifications.set(previousList);
      this._unreadCount.set(previousCount);
      this._error.set('notifications.errors.markRead');
      this.showWriteFailureToast('notifications.errors.markRead');
    }
  }

  /**
   * `POST /v1/notifications/read-all`. Optimistic: flips every loaded
   * record to `read` and zeroes {@link unreadCount}, then re-fetches the
   * count (refresh policy). `updated: 0` is a normal, successful answer —
   * the contract says so explicitly — so it is never treated as an error;
   * the optimistic flip already reflects the true state either way.
   *
   * On failure, this does **not** revert from the in-memory snapshot — it
   * re-reads the truth from the server ({@link refreshList} +
   * {@link refreshUnreadCount}) and then surfaces
   * `notifications.errors.markAllRead`, set last so it is not clobbered by
   * whatever `refreshList` sets while recovering.
   */
  async markAllRead(): Promise<void> {
    const previousList = this._notifications();

    this._notifications.set(
      previousList.map((n) =>
        n.status === NotificationDto.StatusEnum.READ
          ? n
          : { ...n, status: NotificationDto.StatusEnum.READ },
      ),
    );
    this._unreadCount.set(0);
    this._error.set(undefined);

    try {
      await firstValueFrom(this.api.notificationsControllerReadAllV1());
      await this.refreshUnreadCount();
    } catch {
      await Promise.allSettled([this.refreshList(), this.refreshUnreadCount()]);
      this._error.set('notifications.errors.markAllRead');
      this.showWriteFailureToast('notifications.errors.markAllRead');
    }
  }
}
