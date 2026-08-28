import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { Toast } from './toast';

@Component({
  selector: 'app-toast-projection-host',
  imports: [Toast],
  template: `<app-toast title="You have been seated at Table 4" meta="Just now"
    >With the Léon family, by the courtyard doors.</app-toast
  >`,
})
class ToastProjectionHost {}

describe('Toast', () => {
  let fixture: ComponentFixture<Toast>;
  let closed: number;
  let acted: number;

  async function create(inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(Toast);
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Toast, ToastProjectionHost],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();
    TestBed.inject(TranslateService).setTranslation('en', { toast: { dismiss: 'Dismiss' } }, true);
  });

  it('renders the title, meta and projected body', async () => {
    const projectionFixture = TestBed.createComponent(ToastProjectionHost);
    await projectionFixture.whenStable();
    const el = projectionFixture.nativeElement as HTMLElement;
    expect(el.querySelector('.title')?.textContent?.trim()).toBe('You have been seated at Table 4');
    expect(el.querySelector('.meta')?.textContent?.trim()).toBe('Just now');
    expect(el.querySelector('.body')?.textContent?.trim()).toBe(
      'With the Léon family, by the courtyard doors.',
    );
  });

  it('renders no icon element when icon is unset', async () => {
    await create({ title: 'Hello' });
    expect(query('.icon')).toBeNull();
  });

  it('renders the icon element when icon is set', async () => {
    await create({ title: 'Hello', icon: 'seat' });
    expect(query('.icon app-icon')).not.toBeNull();
  });

  it('renders no action button when actionLabel is unset', async () => {
    await create({ title: 'Hello' });
    expect(query('.action')).toBeNull();
  });

  it('renders the action button and fires the action output when clicked', async () => {
    await create({ title: 'Hello', actionLabel: 'See the plan' });
    const action = query<HTMLButtonElement>('.action')!;
    expect(action.textContent?.trim()).toBe('See the plan');
    action.click();
    expect(acted).toBe(1);
  });

  it('emits close when the dismiss button is clicked', async () => {
    await create({ title: 'Hello' });
    query<HTMLButtonElement>('.dismiss')!.click();
    expect(closed).toBe(1);
  });

  it('omits the dismiss button when dismissible is false', async () => {
    await create({ title: 'Hello', dismissible: false });
    expect(query('.dismiss')).toBeNull();
  });

  it("the dismiss button's aria-label comes from the translation, not a literal", async () => {
    await create({ title: 'Hello' });
    expect(query('.dismiss')!.getAttribute('aria-label')).toBe('Dismiss');
  });

  // `fixture.whenStable()` awaits the zoneless scheduler, which itself relies
  // on real timers internally — hanging forever once `vi.useFakeTimers()` is
  // active (same hazard `milestones.spec.ts`'s `settle()` documents). So
  // these two tests build the fixture directly and flush the constructor
  // `effect()`'s initial (microtask-scheduled) run with a bare
  // `Promise.resolve()` instead of `whenStable()`.
  it('emits close once after the delay elapses (fake timers)', async () => {
    vi.useFakeTimers();
    try {
      fixture = TestBed.createComponent(Toast);
      fixture.componentRef.setInput('title', 'Hello');
      fixture.componentRef.setInput('delay', 4000);
      closed = 0;
      fixture.componentInstance.close.subscribe(() => closed++);
      fixture.detectChanges();
      await Promise.resolve();

      expect(closed).toBe(0);
      vi.advanceTimersByTime(4000);
      expect(closed).toBe(1);
      vi.advanceTimersByTime(10000);
      expect(closed).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the auto-hide timer on destroy so it never fires afterwards', async () => {
    vi.useFakeTimers();
    try {
      fixture = TestBed.createComponent(Toast);
      fixture.componentRef.setInput('title', 'Hello');
      fixture.componentRef.setInput('delay', 4000);
      closed = 0;
      fixture.componentInstance.close.subscribe(() => closed++);
      fixture.detectChanges();
      await Promise.resolve();

      fixture.destroy();
      vi.advanceTimersByTime(4000);
      expect(closed).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders role="alert"/aria-live="assertive" and the tone-danger class for tone="danger"', async () => {
    await create({ title: 'Hello', tone: 'danger' });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
    expect(el.classList.contains('tone-danger')).toBe(true);
  });

  const nonDangerTones: ['neutral' | 'accent' | 'provisional', string][] = [
    ['neutral', 'tone-neutral'],
    ['accent', 'tone-accent'],
    ['provisional', 'tone-provisional'],
  ];
  for (const [tone, cls] of nonDangerTones) {
    it(`renders role="status"/aria-live="polite" and the ${cls} class for tone="${tone}"`, async () => {
      await create({ title: 'Hello', tone });
      const el = fixture.nativeElement as HTMLElement;
      expect(el.getAttribute('role')).toBe('status');
      expect(el.getAttribute('aria-live')).toBe('polite');
      expect(el.classList.contains(cls)).toBe(true);
    });
  }

  it('carries the filled class on the host only when variant="filled"', async () => {
    await create({ title: 'Hello' });
    expect((fixture.nativeElement as HTMLElement).classList.contains('filled')).toBe(false);

    await create({ title: 'Hello', variant: 'filled' });
    expect((fixture.nativeElement as HTMLElement).classList.contains('filled')).toBe(true);
  });
});
