import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let fixture: ComponentFixture<ConfirmDialog>;
  let confirmed: number;
  let cancelled: number;

  async function create(inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(ConfirmDialog);
    fixture.componentRef.setInput('title', 'Remove the partner?');
    fixture.componentRef.setInput('confirmLabel', 'Remove');
    fixture.componentRef.setInput('cancelLabel', 'Cancel');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    confirmed = 0;
    cancelled = 0;
    fixture.componentInstance.confirm.subscribe(() => confirmed++);
    fixture.componentInstance.cancel.subscribe(() => cancelled++);
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
      imports: [ConfirmDialog],
    }).compileComponents();
  });

  it('renders nothing when closed', async () => {
    await create({ open: false });
    expect(query('[role="dialog"]')).toBeNull();
  });

  it('renders title, message and both labels when open', async () => {
    await create({ open: true, message: 'They will be taken off the RSVP.' });
    expect(query('.modal-title')?.textContent?.trim()).toBe('Remove the partner?');
    expect(query('.message')?.textContent?.trim()).toBe('They will be taken off the RSVP.');
    const [cancel, confirm] = buttons();
    expect(cancel.textContent?.trim()).toBe('Cancel');
    expect(confirm.textContent?.trim()).toBe('Remove');
  });

  it('omits the message paragraph when message is empty', async () => {
    await create({ open: true });
    expect(query('.message')).toBeNull();
  });

  it('clicking confirm emits confirm exactly once and never cancel', async () => {
    await create({ open: true });
    const [, confirm] = buttons();
    confirm.click();
    expect(confirmed).toBe(1);
    expect(cancelled).toBe(0);
  });

  it('clicking cancel emits cancel', async () => {
    await create({ open: true });
    const [cancel] = buttons();
    cancel.click();
    expect(cancelled).toBe(1);
    expect(confirmed).toBe(0);
  });

  it('Escape emits cancel', async () => {
    await create({ open: true });
    fixture.nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cancelled).toBe(1);
  });

  it('a backdrop click emits cancel', async () => {
    await create({ open: true });
    query<HTMLElement>('.modal-backdrop')!.click();
    expect(cancelled).toBe(1);
  });

  it('renders no .modal-close element', async () => {
    await create({ open: true });
    expect(query('.modal-close')).toBeNull();
  });

  it('focuses the confirm button on open', async () => {
    await create({ open: true });
    const [, confirm] = buttons();
    expect(document.activeElement).toBe(confirm);
  });

  it('Tab from confirm wraps to cancel', async () => {
    await create({ open: true });
    const [cancel, confirm] = buttons();
    confirm.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    confirm.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancel);
  });

  it('never disables the cancel button, in either tone', async () => {
    await create({ open: true, tone: 'danger' });
    const [cancel] = buttons();
    expect(cancel.disabled).toBe(false);

    await create({ open: true, tone: 'accent' });
    expect(buttons()[0].disabled).toBe(false);
  });

  it('carries the danger class on confirm only when tone="danger"', async () => {
    await create({ open: true, tone: 'danger' });
    const [cancel, confirm] = buttons();
    expect(confirm.classList.contains('danger')).toBe(true);
    expect(cancel.classList.contains('danger')).toBe(false);

    await create({ open: true, tone: 'accent' });
    expect(buttons()[1].classList.contains('danger')).toBe(false);
  });

  it('wires both buttons to aria-describedby resolving to the message id', async () => {
    await create({ open: true, message: 'Consequence line.' });
    const [cancel, confirm] = buttons();
    const messageId = query('.message')!.id;
    expect(messageId).toBeTruthy();
    expect(cancel.getAttribute('aria-describedby')).toBe(messageId);
    expect(confirm.getAttribute('aria-describedby')).toBe(messageId);
  });

  it('does not confirm from the keystroke that opened it', async () => {
    await create({ open: true });
    const [, confirm] = buttons();
    expect(document.activeElement).toBe(confirm);

    // Simulate the auto-repeat keydown a real browser fires while the Enter
    // key that opened the dialog is still held down, now landing on the
    // freshly-focused confirm button.
    const repeatKeydown = new KeyboardEvent('keydown', {
      key: 'Enter',
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    confirm.dispatchEvent(repeatKeydown);
    expect(repeatKeydown.defaultPrevented).toBe(true);

    // Even if a browser still synthesized the click from that same
    // keystroke, the guard must swallow it.
    confirm.click();
    expect(confirmed).toBe(0);

    // Releasing the key clears the guard; a fresh Enter press afterwards
    // confirms normally.
    confirm.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    confirm.click();
    expect(confirmed).toBe(1);
  });
});
