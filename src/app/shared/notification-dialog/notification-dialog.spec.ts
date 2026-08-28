import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { signal } from '@angular/core';

import { NotificationDto, TranslateLanguageService } from '@app/core';
import { Icon } from '@app/shared/icons/icon';

import { NotificationDialog } from './notification-dialog';

const CREATED_AT = '2027-01-05T10:30:00.000Z';

function notification(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 'n1',
    createdAt: CREATED_AT,
    type: 'rsvp-reminder',
    templateId: 'rsvp-reminder',
    status: NotificationDto.StatusEnum.UNREAD,
    ...overrides,
  };
}

/** Mirrors the component's `date: 'd MMMM, HH:mm' : '' : lang()` pipe — no
 *  timezone override, so this must resolve in the *runtime's own* local
 *  timezone rather than a hardcoded string, or this test would be flaky
 *  across CI/dev machines in different zones. */
function expectedKickerTime(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate();
  const month = new Intl.DateTimeFormat('en', { month: 'long' }).format(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month}, ${hh}:${mm}`;
}

describe('NotificationDialog', () => {
  let fixture: ComponentFixture<NotificationDialog>;
  let closed: number;
  let acted: number;

  async function create(inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(NotificationDialog);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('notification', notification());
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    closed = 0;
    acted = 0;
    fixture.componentInstance.close.subscribe(() => closed++);
    fixture.componentInstance.action.subscribe(() => acted++);
    await fixture.whenStable();
  }

  function query<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  function buttons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.action')) as HTMLButtonElement[];
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationDialog],
      providers: [
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        // Lightweight stand-in — the real service pulls in the
        // `WeddingConfigPublic` @ngrx/data collection this suite has no need
        // to wire up just to read a language code.
        { provide: TranslateLanguageService, useValue: { currentLang: signal('en') } },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).setTranslation(
      'en',
      {
        shared: { close: 'Close' },
        notifications: {
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
      },
      true,
    );
  });

  it('renders nothing when open is false', async () => {
    await create({ open: false });
    expect(query('[role="dialog"]')).toBeNull();
  });

  it('renders nothing when notification is null', async () => {
    await create({ open: true, notification: null });
    expect(query('[role="dialog"]')).toBeNull();
  });

  it('renders the kicker icon, label and full timestamp', async () => {
    await create();
    const iconDe = fixture.debugElement.query(By.directive(Icon));
    expect(iconDe.componentInstance.name()).toBe('mail'); // rsvp-reminder -> mail (TYPE_ICON)
    expect(query('.kicker-label')?.textContent?.trim()).toBe('RSVP reminder');
    expect(query('.kicker-time')?.textContent?.trim()).toBe(expectedKickerTime(CREATED_AT));
  });

  it('renders the title and body from the record when present', async () => {
    await create({
      notification: notification({ title: 'Custom title', body: 'Custom body.' }),
    });
    expect(query('.modal-title')?.textContent?.trim()).toBe('Custom title');
    expect(query('.body')?.textContent?.trim()).toBe('Custom body.');
  });

  it('renders the title and body from the catalogue when the record carries none', async () => {
    await create();
    expect(query('.modal-title')?.textContent?.trim()).toBe('Your RSVP is missing');
    expect(query('.body')?.textContent?.trim()).toBe("We haven't heard from you yet.");
  });

  it('has exactly one button without actionLabel — no "mark as read" control', async () => {
    await create();
    expect(buttons().length).toBe(1);
    expect(buttons()[0].textContent?.trim()).toBe('Close');
  });

  it('has exactly two buttons when actionLabel is set', async () => {
    await create({ actionLabel: 'See seating' });
    const [close, action] = buttons();
    expect(buttons().length).toBe(2);
    expect(close.textContent?.trim()).toBe('Close');
    expect(action.textContent?.trim()).toBe('See seating');
  });

  it('omits the action button when actionLabel is unset', async () => {
    await create();
    const [, action] = buttons();
    expect(action).toBeUndefined();
  });

  it('emits action (and not close) when the action button is clicked', async () => {
    await create({ actionLabel: 'See seating' });
    const [, action] = buttons();
    action.click();
    expect(acted).toBe(1);
    expect(closed).toBe(0);
  });

  it('emits close when the Close button is clicked', async () => {
    await create();
    buttons()[0].click();
    expect(closed).toBe(1);
  });

  it('emits close on Escape', async () => {
    await create();
    fixture.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(closed).toBe(1);
  });

  it('emits close on a backdrop click', async () => {
    await create();
    query<HTMLElement>('.modal-backdrop')!.click();
    expect(closed).toBe(1);
  });

  it('renders no .modal-close element', async () => {
    await create();
    expect(query('.modal-close')).toBeNull();
  });

  it('focuses the Close button on open', async () => {
    await create();
    expect(document.activeElement).toBe(buttons()[0]);
  });

  it('renders the info glyph and the fallback label for an unknown type without throwing', async () => {
    await expect(
      create({ notification: notification({ type: 'something-new', templateId: 'something-new' }) }),
    ).resolves.not.toThrow();
    const iconDe = fixture.debugElement.query(By.directive(Icon));
    expect(iconDe.componentInstance.name()).toBe('info');
    expect(query('.kicker-label')?.textContent?.trim()).toBe('Wedding');
    expect(query('.modal-title')?.textContent?.trim()).toBe('You have a notification');
    expect(query('.body')?.textContent?.trim()).toBe('Open the app to see the details.');
  });
});
