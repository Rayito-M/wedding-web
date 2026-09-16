import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Modal } from './modal';

/**
 * Host with projected focusable content, mirroring the shape of the five
 * consumers that inherit `app-modal`'s keyboard behaviour rather than rolling
 * their own (`login`, `profile-modal`, the three guest-manager modals): body
 * controls plus `[modal-actions]` buttons, and a trigger button outside the
 * dialog for the focus-restore contract. `toast.spec.ts` precedent for the
 * inline-template projection host.
 */
@Component({
  selector: 'app-modal-trap-host',
  imports: [Modal],
  template: `
    <button type="button" class="trigger" (click)="open.set(true)">Open</button>
    <app-modal
      [open]="open()"
      [dismissable]="dismissable()"
      title="Trap harness"
      (close)="closed = closed + 1"
    >
      <input class="first-field" type="text" />
      <button modal-actions type="button" class="last-action">OK</button>
    </app-modal>
  `,
})
class ModalTrapHost {
  readonly open = signal(false);
  readonly dismissable = signal(true);
  closed = 0;
}

describe('Modal (T359 — the aria-modal contract)', () => {
  let fixture: ComponentFixture<ModalTrapHost>;
  let host: ModalTrapHost;

  function query<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  function card(): HTMLElement {
    const el = query<HTMLElement>('.modal-card');
    if (!el) throw new Error('modal-card not rendered');
    return el;
  }

  /** Every tabbable inside the card in trap order: field, ×, OK is not the
   *  order — DOM order is header (×), body (field), actions (OK). */
  function tabbables(): HTMLElement[] {
    return [
      query<HTMLElement>('.modal-close'),
      query<HTMLElement>('.first-field'),
      query<HTMLElement>('.last-action'),
    ].filter((el): el is HTMLElement => el !== null);
  }

  async function open(): Promise<void> {
    host.open.set(true);
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ModalTrapHost] }).compileComponents();
    fixture = TestBed.createComponent(ModalTrapHost);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('moves focus onto the dialog card when it opens', async () => {
    await open();
    expect(document.activeElement).toBe(card());
  });

  it('does not steal focus that something else already placed inside the card', async () => {
    // Simulates ConfirmDialog/NotificationDialog, whose own afterRenderEffect
    // (registered first, parent before child) focuses a preferred button.
    host.open.set(true);
    fixture.changeDetectorRef.detectChanges();
    query<HTMLElement>('.first-field')?.focus();
    await fixture.whenStable();
    // Whichever ran first, the card must not end up focused over a
    // deliberately-placed inner element on subsequent renders.
    query<HTMLElement>('.last-action')?.focus();
    host.dismissable.set(false);
    await fixture.whenStable();
    expect(document.activeElement).toBe(query('.last-action'));
  });

  it('Escape pressed inside the card emits close exactly once', async () => {
    await open();
    card().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.closed).toBe(1);
  });

  it('Escape does nothing when dismissable is false', async () => {
    host.dismissable.set(false);
    await open();
    card().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.closed).toBe(0);
  });

  it('Escape stops propagating past the dialog', async () => {
    await open();
    let reachedDocument = 0;
    const listener = (): void => {
      reachedDocument++;
    };
    document.addEventListener('keydown', listener);
    try {
      card().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    } finally {
      document.removeEventListener('keydown', listener);
    }
    expect(host.closed).toBe(1);
    expect(reachedDocument).toBe(0);
  });

  it('Tab on the last tabbable wraps to the first', async () => {
    await open();
    const all = tabbables();
    const last = all[all.length - 1];
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(all[0]);
  });

  it('Shift+Tab on the first tabbable wraps to the last', async () => {
    await open();
    const all = tabbables();
    const first = all[0];
    first.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    first.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(all[all.length - 1]);
  });

  it('Shift+Tab while the card itself holds focus wraps to the last tabbable', async () => {
    await open();
    expect(document.activeElement).toBe(card());
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    card().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const all = tabbables();
    expect(document.activeElement).toBe(all[all.length - 1]);
  });

  it('leaves a mid-card Tab to the browser', async () => {
    await open();
    const all = tabbables();
    all[0].focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    all[0].dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('respects a Tab keydown a projected handler already prevented', async () => {
    // ConfirmDialog's own two-button wrap preventDefaults and moves focus
    // itself; the card-level trap must not fight it.
    await open();
    const all = tabbables();
    const last = all[all.length - 1];
    last.focus();
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    event.preventDefault();
    last.dispatchEvent(event);
    expect(document.activeElement).toBe(last);
  });

  it('restores focus to the trigger on close when teardown dropped it to body', async () => {
    const trigger = query<HTMLElement>('.trigger');
    if (!trigger) throw new Error('trigger not rendered');
    trigger.focus();
    await open();
    expect(document.activeElement).toBe(card());
    host.open.set(false);
    await fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
  });

  it('does not fight a host that already moved focus during close', async () => {
    const trigger = query<HTMLElement>('.trigger');
    if (!trigger) throw new Error('trigger not rendered');
    trigger.focus();
    await open();
    host.open.set(false);
    fixture.changeDetectorRef.detectChanges();
    // The host places focus deliberately before the effect settles — the
    // ConfirmDialog confirm path, where the host owns post-close focus.
    const elsewhere = document.createElement('button');
    document.body.appendChild(elsewhere);
    elsewhere.focus();
    await fixture.whenStable();
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it('a backdrop click still closes, a card click still does not', async () => {
    await open();
    card().click();
    expect(host.closed).toBe(0);
    query<HTMLElement>('.modal-backdrop')?.click();
    expect(host.closed).toBe(1);
  });
});
