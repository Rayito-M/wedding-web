import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { NotificationCenterService, NotificationDto, TranslateLanguageService } from '@app/core';

import { NotificationBell } from './notification-bell';

function notification(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 'n1',
    createdAt: new Date().toISOString(),
    type: 'rsvp-reminder',
    templateId: 'rsvp-reminder',
    status: NotificationDto.StatusEnum.UNREAD,
    ...overrides,
  };
}

/** Stand-in for `NotificationCenterService` (T286) — a plain signals object
 *  with spied writes, not the real HTTP-backed service. `markRead` mutates
 *  its own `notifications` signal the same way the real service's optimistic
 *  flip does, which is what the "re-opening an already-read row calls
 *  markRead zero more times" acceptance criterion needs. */
function createCenterStub(
  initial: NotificationDto[] = [],
  unreadCount = 0,
  initialError: string | undefined = undefined,
) {
  const list = signal<NotificationDto[]>(initial);
  const count = signal(unreadCount);
  const error = signal<string | undefined>(initialError);
  const markRead = vi.fn(async (id: string) => {
    list.update((items) =>
      items.map((n) => (n.id === id ? { ...n, status: NotificationDto.StatusEnum.READ } : n)),
    );
  });
  const markAllRead = vi.fn(async () => {
    list.update((items) => items.map((n) => ({ ...n, status: NotificationDto.StatusEnum.READ })));
    count.set(0);
  });
  return {
    notifications: list.asReadonly(),
    unreadCount: count.asReadonly(),
    loading: signal(false).asReadonly(),
    error: error.asReadonly(),
    ensureUnreadCount: vi.fn().mockResolvedValue(undefined),
    refreshList: vi.fn().mockResolvedValue(undefined),
    markRead,
    markAllRead,
  };
}

const TRANSLATIONS = {
  shared: { close: 'Close' },
  notifications: {
    title: 'Notifications',
    ariaLabel: 'Notifications',
    ariaLabelUnread: 'Notifications, {{count}} unread',
    markAllRead: 'Mark all read',
    empty: "Nothing new — we'll tell you here.",
    errors: {
      load: "Couldn't load notifications. Please try again.",
    },
    ago: {
      now: 'now',
      minutes: '{{count}}m ago',
      hours: '{{count}}h ago',
      days: '{{count}}d ago',
    },
    typeLabel: {
      'rsvp-reminder': 'RSVP reminder',
      fallback: 'Wedding',
    },
    template: {
      'rsvp-reminder': {
        title: 'Your RSVP is missing',
        body: "We haven't heard from you yet.",
      },
      fallback: {
        title: 'You have a notification',
        body: 'Open the app to see the details.',
      },
    },
  },
};

describe('NotificationBell', () => {
  let fixture: ComponentFixture<NotificationBell>;
  let center: ReturnType<typeof createCenterStub>;

  async function create(
    notifications: NotificationDto[] = [],
    unreadCount = 0,
    error: string | undefined = undefined,
  ): Promise<void> {
    center = createCenterStub(notifications, unreadCount, error);
    await TestBed.configureTestingModule({
      imports: [NotificationBell],
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: TranslateLanguageService, useValue: { currentLang: signal('en') } },
        { provide: NotificationCenterService, useValue: center },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).setTranslation('en', TRANSLATIONS, true);

    fixture = TestBed.createComponent(NotificationBell);
    await fixture.whenStable();
  }

  function query<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  function queryAll<T extends HTMLElement>(selector: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
  }

  async function openDropdown(): Promise<void> {
    query<HTMLButtonElement>('.bell-btn')!.click();
    await fixture.whenStable();
  }

  afterEach(() => {
    // The bell listens on `document:click`/`document:keydown.escape` for
    // the lifetime of the component — destroy it so a later suite's
    // `document.dispatchEvent` calls in this file don't leak into it.
    fixture?.destroy();
  });

  it('renders no badge at zero unread', async () => {
    await create([], 0);
    expect(query('.badge')).toBeNull();
  });

  it('shows the unread count on the badge for 1–9', async () => {
    await create([], 4);
    expect(query('.badge')?.textContent?.trim()).toBe('4');
  });

  it('shows "9+" past nine unread', async () => {
    await create([], 10);
    expect(query('.badge')?.textContent?.trim()).toBe('9+');
  });

  it('opening the dropdown does not call markRead', async () => {
    await create([notification({ id: 'a' })], 1);
    await openDropdown();
    expect(center.markRead).not.toHaveBeenCalled();
  });

  it('hovering a row does not call markRead', async () => {
    await create([notification({ id: 'a' })], 1);
    await openDropdown();
    query('.row')!.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    query('.row')!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(center.markRead).not.toHaveBeenCalled();
  });

  it('clicking an unread row calls markRead once with that id and opens the dialog', async () => {
    await create([notification({ id: 'a', status: NotificationDto.StatusEnum.UNREAD })], 1);
    await openDropdown();

    query<HTMLButtonElement>('.row')!.click();
    await fixture.whenStable();

    expect(center.markRead).toHaveBeenCalledTimes(1);
    expect(center.markRead).toHaveBeenCalledWith('a');
    expect(query('[role="dialog"]')).not.toBeNull();
  });

  it('clicking an already-read row opens the dialog and calls markRead zero times', async () => {
    await create([notification({ id: 'a', status: NotificationDto.StatusEnum.READ })], 0);
    await openDropdown();

    query<HTMLButtonElement>('.row')!.click();
    await fixture.whenStable();

    expect(center.markRead).not.toHaveBeenCalled();
    expect(query('[role="dialog"]')).not.toBeNull();
  });

  it('re-opening the same row after a successful read calls markRead zero more times', async () => {
    await create([notification({ id: 'a', status: NotificationDto.StatusEnum.UNREAD })], 1);
    await openDropdown();

    query<HTMLButtonElement>('.row')!.click();
    await fixture.whenStable();
    expect(center.markRead).toHaveBeenCalledTimes(1);

    // Close the dialog and re-open the dropdown — the row's underlying
    // record is now `read`, courtesy of the stub's optimistic flip.
    query<HTMLButtonElement>('.action')!.click();
    await fixture.whenStable();
    await openDropdown();

    query<HTMLButtonElement>('.row')!.click();
    await fixture.whenStable();

    expect(center.markRead).toHaveBeenCalledTimes(1);
  });

  it('hides "Mark all read" at zero unread', async () => {
    await create([notification({ id: 'a', status: NotificationDto.StatusEnum.READ })], 0);
    await openDropdown();
    expect(query('.mark-all')).toBeNull();
  });

  it('shows "Mark all read" while something is unread and wires it to markAllRead', async () => {
    await create([notification({ id: 'a', status: NotificationDto.StatusEnum.UNREAD })], 1);
    await openDropdown();

    const button = query<HTMLButtonElement>('.mark-all');
    expect(button).not.toBeNull();
    button!.click();

    expect(center.markAllRead).toHaveBeenCalledTimes(1);
  });

  it('renders at most 5 rows however many notifications the service holds', async () => {
    const many = Array.from({ length: 7 }, (_, i) => notification({ id: `n${i}` }));
    await create(many, 7);
    await openDropdown();
    expect(queryAll('.row').length).toBe(5);
  });

  it('renders the empty state when there are no notifications', async () => {
    await create([], 0);
    await openDropdown();
    expect(query('.empty')?.textContent?.trim()).toBe("Nothing new — we'll tell you here.");
    expect(query('.row')).toBeNull();
  });

  it('renders the list-fetch error inline instead of rows or the empty state (T289)', async () => {
    await create([notification({ id: 'a' })], 1, 'notifications.errors.load');
    await openDropdown();

    expect(query('.load-error')?.textContent?.trim()).toBe(
      "Couldn't load notifications. Please try again.",
    );
    expect(query('.row')).toBeNull();
    expect(query('.empty')).toBeNull();
  });

  it('does not render the inline error for a markRead/markAllRead failure key', async () => {
    await create([notification({ id: 'a' })], 1, 'notifications.errors.markRead');
    await openDropdown();

    expect(query('.load-error')).toBeNull();
    expect(query('.row')).not.toBeNull();
  });

  it('closes the dropdown on an outside click', async () => {
    await create([notification({ id: 'a' })], 1);
    await openDropdown();
    expect(query('.dropdown')).not.toBeNull();

    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();

    expect(query('.dropdown')).toBeNull();
  });

  it('closes the dropdown on Escape', async () => {
    await create([notification({ id: 'a' })], 1);
    await openDropdown();
    expect(query('.dropdown')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    expect(query('.dropdown')).toBeNull();
  });

  it('has no "All notifications" element anywhere in the DOM', async () => {
    const many = Array.from({ length: 7 }, (_, i) => notification({ id: `n${i}` }));
    await create(many, 7);
    await openDropdown();
    expect(query('.view-all')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('All notifications');
  });

  it('renders catalogue copy, not a blank row, for a record with no title/body', async () => {
    await create(
      [
        notification({
          id: 'a',
          title: undefined,
          body: undefined,
          type: 'rsvp-reminder',
          templateId: 'rsvp-reminder',
        }),
      ],
      1,
    );
    await openDropdown();

    expect(query('.row-title')?.textContent?.trim()).toBe('Your RSVP is missing');
    expect(query('.row-snippet')?.textContent?.trim()).toBe("We haven't heard from you yet.");
  });
});
