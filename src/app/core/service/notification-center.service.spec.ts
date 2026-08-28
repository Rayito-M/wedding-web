import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { Observable, of, throwError } from 'rxjs';

import { NotificationDto, WeddingNotificationsService } from '../api';

import {
  NotificationCenterService,
  bodyKeyFor,
  iconFor,
  titleKeyFor,
  typeLabelKeyFor,
} from './notification-center.service';
import { ToastCenterService } from './toast-center.service';

function notification(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 'n1',
    createdAt: '2027-01-01T10:00:00.000Z',
    type: 'rsvp-reminder',
    templateId: 'rsvp-reminder',
    status: NotificationDto.StatusEnum.UNREAD,
    ...overrides,
  };
}

describe('NotificationCenterService', () => {
  let listSpy: ReturnType<typeof vi.fn<() => Observable<unknown>>>;
  let markReadSpy: ReturnType<typeof vi.fn<(params: { id: string }) => Observable<NotificationDto>>>;
  let readAllSpy: ReturnType<typeof vi.fn<() => Observable<{ updated: number }>>>;
  let unreadCountSpy: ReturnType<typeof vi.fn<() => Observable<{ count: number }>>>;

  let currentItems: NotificationDto[];
  let currentCount: number;
  let markReadFailure: Observable<never> | null;
  let readAllFailure: Observable<never> | null;
  let unreadCountFailure: Observable<never> | null;
  let listFailure: Observable<never> | null;

  beforeEach(() => {
    currentItems = [];
    currentCount = 0;
    markReadFailure = null;
    readAllFailure = null;
    unreadCountFailure = null;
    listFailure = null;
  });

  function createService(): NotificationCenterService {
    listSpy = vi.fn(() => {
      if (listFailure) return listFailure;
      return of({ items: currentItems, nextCursor: null, count: currentItems.length });
    });
    markReadSpy = vi.fn((params: { id: string }) => {
      if (markReadFailure) return markReadFailure;
      const found = currentItems.find((n) => n.id === params.id);
      const updated: NotificationDto = {
        ...(found ?? notification({ id: params.id })),
        status: NotificationDto.StatusEnum.READ,
        readAt: '2027-01-02T00:00:00.000Z',
      };
      return of(updated);
    });
    readAllSpy = vi.fn(() => {
      if (readAllFailure) return readAllFailure;
      return of({ updated: currentItems.filter((n) => n.status === NotificationDto.StatusEnum.UNREAD).length });
    });
    unreadCountSpy = vi.fn(() => {
      if (unreadCountFailure) return unreadCountFailure;
      return of({ count: currentCount });
    });

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        {
          provide: WeddingNotificationsService,
          useValue: {
            notificationsControllerListV1: () => listSpy(),
            notificationsControllerMarkReadV1: (params: { id: string }) => markReadSpy(params),
            notificationsControllerReadAllV1: () => readAllSpy(),
            notificationsControllerUnreadCountV1: () => unreadCountSpy(),
          },
        },
      ],
    });

    return TestBed.inject(NotificationCenterService);
  }

  /** {@link ToastCenterService} is `providedIn: 'root'` with no constructor
   *  dependencies of its own (its own spec confirms this — a bare
   *  `TestBed.configureTestingModule({})` is enough), so it needs no
   *  provider override here: this is exactly the "stays unit-testable
   *  without a real toast stack mounted" guarantee T289's acceptance
   *  criteria asks for. */
  function toastCenter(): ToastCenterService {
    return TestBed.inject(ToastCenterService);
  }

  it('reads unreadCount from the count endpoint, not from notifications().length', async () => {
    currentCount = 7;
    currentItems = [notification({ id: 'a' }), notification({ id: 'b' })];
    const service = createService();

    await service.ensureUnreadCount();

    expect(service.unreadCount()).toBe(7);
    expect(service.notifications().length).toBe(0);
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('does not fetch the list until refreshList is called', async () => {
    const service = createService();

    await service.ensureUnreadCount();
    expect(listSpy).not.toHaveBeenCalled();

    await service.refreshList();
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('ensureUnreadCount only fetches once across repeated calls', async () => {
    const service = createService();

    await service.ensureUnreadCount();
    await service.ensureUnreadCount();
    await service.ensureUnreadCount();

    expect(unreadCountSpy).toHaveBeenCalledTimes(1);
  });

  it('refreshList re-fetches on every call (no caching)', async () => {
    const service = createService();

    await service.refreshList();
    await service.refreshList();

    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('sorts the list newest-first defensively, even if the server did not', async () => {
    currentItems = [
      notification({ id: 'old', createdAt: '2027-01-01T00:00:00.000Z' }),
      notification({ id: 'new', createdAt: '2027-01-03T00:00:00.000Z' }),
      notification({ id: 'mid', createdAt: '2027-01-02T00:00:00.000Z' }),
    ];
    const service = createService();

    await service.refreshList();

    expect(service.notifications().map((n) => n.id)).toEqual(['new', 'mid', 'old']);
  });

  it('markRead flips optimistically, calls the client once, and reconciles + re-fetches count on success', async () => {
    currentItems = [notification({ id: 'a', status: NotificationDto.StatusEnum.UNREAD })];
    currentCount = 1;
    const service = createService();
    await service.refreshList();
    await service.ensureUnreadCount();

    // Simulate the count dropping server-side once the write lands.
    currentCount = 0;
    const pending = service.markRead('a');

    // Before the (mocked, async) HTTP call settles, the optimistic flip has
    // already happened synchronously.
    expect(service.notifications()[0].status).toBe(NotificationDto.StatusEnum.READ);
    expect(service.unreadCount()).toBe(0);

    await pending;

    expect(markReadSpy).toHaveBeenCalledTimes(1);
    expect(service.notifications()[0].status).toBe(NotificationDto.StatusEnum.READ);
    expect(service.unreadCount()).toBe(0);
    expect(service.error()).toBeUndefined();
    // T289: a successful write is not a toast — the badge dropping is the
    // feedback.
    expect(toastCenter().toasts()).toEqual([]);
  });

  it('markRead reverts both the record and the count on failure, surfaces an error, and shows exactly one danger toast with no delay (T289)', async () => {
    currentItems = [notification({ id: 'a', status: NotificationDto.StatusEnum.UNREAD })];
    currentCount = 1;
    const service = createService();
    await service.refreshList();
    await service.ensureUnreadCount();

    markReadFailure = throwError(() => new Error('boom'));
    await service.markRead('a');

    expect(service.notifications()[0].status).toBe(NotificationDto.StatusEnum.UNREAD);
    expect(service.unreadCount()).toBe(1);
    expect(service.error()).toBe('notifications.errors.markRead');

    const toasts = toastCenter().toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].tone).toBe('danger');
    expect(toasts[0].icon).toBe('warning');
    expect(toasts[0].delay).toBeUndefined();
    expect(toasts[0].dismissible).toBe(true);
    expect(toasts[0].title).toBe('notifications.errors.markRead');
  });

  it('markRead on an already-read record is a safe no-op (no HTTP call)', async () => {
    currentItems = [notification({ id: 'a', status: NotificationDto.StatusEnum.READ })];
    const service = createService();
    await service.refreshList();

    await service.markRead('a');

    expect(markReadSpy).not.toHaveBeenCalled();
  });

  it('markRead on a record not in the loaded list is a safe no-op (no HTTP call)', async () => {
    const service = createService();

    await service.markRead('missing');

    expect(markReadSpy).not.toHaveBeenCalled();
  });

  it('markAllRead zeroes the count optimistically and treats "0 updated" as success', async () => {
    currentItems = [];
    currentCount = 0;
    const service = createService();
    await service.refreshList();
    await service.ensureUnreadCount();

    await service.markAllRead();

    expect(readAllSpy).toHaveBeenCalledTimes(1);
    expect(service.unreadCount()).toBe(0);
    expect(service.error()).toBeUndefined();
    expect(toastCenter().toasts()).toEqual([]);
  });

  it('markAllRead flips every loaded record to read on success', async () => {
    currentItems = [
      notification({ id: 'a', status: NotificationDto.StatusEnum.UNREAD }),
      notification({ id: 'b', status: NotificationDto.StatusEnum.UNREAD }),
    ];
    currentCount = 2;
    const service = createService();
    await service.refreshList();

    await service.markAllRead();

    expect(service.notifications().every((n) => n.status === NotificationDto.StatusEnum.READ)).toBe(
      true,
    );
  });

  it('markAllRead re-reads list and count from the server on failure, rather than reverting from memory, and shows exactly one danger toast with no delay (T289)', async () => {
    currentItems = [notification({ id: 'a', status: NotificationDto.StatusEnum.UNREAD })];
    currentCount = 1;
    const service = createService();
    await service.refreshList();
    await service.ensureUnreadCount();

    readAllFailure = throwError(() => new Error('boom'));
    // Simulate the server's real, unrelated-to-our-optimism truth.
    currentItems = [notification({ id: 'a', status: NotificationDto.StatusEnum.UNREAD })];
    currentCount = 1;

    await service.markAllRead();

    expect(listSpy).toHaveBeenCalled();
    expect(unreadCountSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(service.unreadCount()).toBe(1);
    expect(service.notifications()[0].status).toBe(NotificationDto.StatusEnum.UNREAD);
    expect(service.error()).toBe('notifications.errors.markAllRead');

    const toasts = toastCenter().toasts();
    expect(toasts.length).toBe(1);
    expect(toasts[0].tone).toBe('danger');
    expect(toasts[0].icon).toBe('warning');
    expect(toasts[0].delay).toBeUndefined();
    expect(toasts[0].dismissible).toBe(true);
    expect(toasts[0].title).toBe('notifications.errors.markAllRead');
  });

  it('a failing list fetch surfaces the load error but shows no toast (T289 — in-dropdown only)', async () => {
    listFailure = throwError(() => new Error('boom'));
    const service = createService();

    await service.refreshList();

    expect(service.error()).toBe('notifications.errors.load');
    expect(toastCenter().toasts()).toEqual([]);
  });

  it('iconFor falls back to the info icon for an unknown type', () => {
    expect(iconFor(notification({ type: 'save-the-date' }))).toBe('calendar');
    expect(iconFor(notification({ type: 'some-future-type' }))).toBe('info');
  });

  it('typeLabelKeyFor falls back for an unknown type', () => {
    expect(typeLabelKeyFor(notification({ type: 'invitation' }))).toBe('notifications.typeLabel.invitation');
    expect(typeLabelKeyFor(notification({ type: 'unknown' }))).toBe('notifications.typeLabel.fallback');
  });

  it('titleKeyFor/bodyKeyFor fall back to the fallback catalogue entry for an unknown templateId', () => {
    const n = notification({ templateId: 'unknown-template' });
    expect(titleKeyFor(n)).toBe('notifications.template.fallback.title');
    expect(bodyKeyFor(n)).toBe('notifications.template.fallback.body');
  });

  it('titleKeyFor/bodyKeyFor use the templateId catalogue key when the record carries no title/body', () => {
    const n = notification({ templateId: 'menu-selection-reminder' });
    expect(titleKeyFor(n)).toBe('notifications.template.menu-selection-reminder.title');
    expect(bodyKeyFor(n)).toBe('notifications.template.menu-selection-reminder.body');
  });

  it("titleKeyFor/bodyKeyFor prefer the record's own title/body over the catalogue", () => {
    const n = notification({
      templateId: 'menu-selection-reminder',
      title: 'Custom title',
      body: 'Custom body',
    });
    expect(titleKeyFor(n)).toBe('Custom title');
    expect(bodyKeyFor(n)).toBe('Custom body');
  });
});
