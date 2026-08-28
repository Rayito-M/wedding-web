import { TestBed } from '@angular/core/testing';

import { ToastCenterService } from './toast-center.service';

describe('ToastCenterService', () => {
  function createService(): ToastCenterService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ToastCenterService);
  }

  it('show() appends a toast and registers an id the caller never supplied', () => {
    const service = createService();

    const id = service.show({ title: 'Saved' });

    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].id).toBe(id);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('dismiss(id) removes exactly that one toast', () => {
    const service = createService();
    const first = service.show({ title: 'First' });
    const second = service.show({ title: 'Second' });

    service.dismiss(first);

    const ids = service.toasts().map((t) => t.id);
    expect(ids).not.toContain(first);
    expect(ids).toContain(second);
    expect(service.toasts().length).toBe(1);
  });

  it('dismiss() on an id that is not present is a safe no-op', () => {
    const service = createService();
    service.show({ title: 'Only one' });

    expect(() => service.dismiss('does-not-exist')).not.toThrow();
    expect(service.toasts().length).toBe(1);
  });

  it('caps the list at three: a fourth show() drops the oldest and the column never grows past three', () => {
    const service = createService();
    const first = service.show({ title: 'One' });
    service.show({ title: 'Two' });
    service.show({ title: 'Three' });
    const fourth = service.show({ title: 'Four' });

    const ids = service.toasts().map((t) => t.id);
    expect(ids.length).toBe(3);
    expect(ids).not.toContain(first);
    expect(ids).toContain(fourth);
  });

  it('a tone="danger" toast is stored with no delay, regardless of the delay passed in', () => {
    const service = createService();

    service.show({ title: 'Something failed', tone: 'danger', delay: 3000 });

    expect(service.toasts()[0].delay).toBeUndefined();
    expect(service.toasts()[0].dismissible).toBe(true);
  });

  it('a toast carrying actionLabel is stored with no delay, regardless of the delay passed in', () => {
    const service = createService();

    service.show({ title: 'Undo?', actionLabel: 'Undo', delay: 4500 });

    expect(service.toasts()[0].delay).toBeUndefined();
    expect(service.toasts()[0].dismissible).toBe(true);
  });

  it('everything else defaults into the DS 4000-6000ms band when delay is omitted', () => {
    const service = createService();

    service.show({ title: 'Saved' });

    const delay = service.toasts()[0].delay;
    expect(delay).toBeDefined();
    expect(delay as number).toBeGreaterThanOrEqual(4000);
    expect(delay as number).toBeLessThanOrEqual(6000);
  });

  it('honours a caller-supplied delay for a non-danger, non-action toast', () => {
    const service = createService();

    service.show({ title: 'Saved', delay: 4200 });

    expect(service.toasts()[0].delay).toBe(4200);
  });

  it('ordering matches the configured placement (bottom-center: newest last)', () => {
    const service = createService();
    const first = service.show({ title: 'One' });
    const second = service.show({ title: 'Two' });
    const third = service.show({ title: 'Three' });

    expect(service.toasts().map((t) => t.id)).toEqual([first, second, third]);
  });
});
