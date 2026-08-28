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

  it('caps a column at three: a fourth show() drops the oldest and the column never grows past three', () => {
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

  it('a tone="danger" toast defaults to no delay when the caller passes none', () => {
    const service = createService();

    service.show({ title: 'Something failed', tone: 'danger' });

    expect(service.toasts()[0].delay).toBeUndefined();
    expect(service.toasts()[0].dismissible).toBe(true);
  });

  it('a toast carrying actionLabel defaults to no delay when the caller passes none', () => {
    const service = createService();

    service.show({ title: 'Undo?', actionLabel: 'Undo' });

    expect(service.toasts()[0].delay).toBeUndefined();
    expect(service.toasts()[0].dismissible).toBe(true);
  });

  it('an explicit delay wins on a danger toast — the rule is a default, not a veto', () => {
    const service = createService();

    service.show({ title: 'Something failed', tone: 'danger', delay: 5000 });

    expect(service.toasts()[0].delay).toBe(5000);
  });

  it('an explicit delay wins on an action toast too', () => {
    const service = createService();

    service.show({ title: 'Undo?', actionLabel: 'Undo', delay: 4500 });

    expect(service.toasts()[0].delay).toBe(4500);
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

  it('ordering matches the default placement (bottom-center: newest last)', () => {
    const service = createService();
    const first = service.show({ title: 'One' });
    const second = service.show({ title: 'Two' });
    const third = service.show({ title: 'Three' });

    expect(service.toasts().map((t) => t.id)).toEqual([first, second, third]);
    expect(service.stacks()).toEqual([{ placement: 'bottom-center', toasts: service.toasts() }]);
  });

  it('a toast with no placement lands at bottom-center', () => {
    const service = createService();

    service.show({ title: 'Saved' });

    expect(service.toasts()[0].placement).toBe('bottom-center');
    expect(service.stacks().map((s) => s.placement)).toEqual(['bottom-center']);
  });

  it('honours a caller-supplied placement', () => {
    const service = createService();

    service.show({ title: 'The agenda changed', placement: 'top-center' });

    expect(service.toasts()[0].placement).toBe('top-center');
    expect(service.stacks().map((s) => s.placement)).toEqual(['top-center']);
  });

  it('groups toasts into one stack per occupied placement, in a stable order', () => {
    const service = createService();
    service.show({ title: 'Confirmation', placement: 'bottom-end' });
    service.show({ title: 'Arriving news', placement: 'top-center' });

    expect(service.stacks().map((s) => s.placement)).toEqual(['top-center', 'bottom-end']);
    expect(service.stacks().map((s) => s.toasts.length)).toEqual([1, 1]);
  });

  it('orders a top-* column newest first and a bottom-* column newest last', () => {
    const service = createService();
    const topFirst = service.show({ title: 'One', placement: 'top-center' });
    const topSecond = service.show({ title: 'Two', placement: 'top-center' });
    const bottomFirst = service.show({ title: 'Three', placement: 'bottom-center' });
    const bottomSecond = service.show({ title: 'Four', placement: 'bottom-center' });

    const byPlacement = new Map(
      service.stacks().map((s) => [s.placement, s.toasts.map((t) => t.id)]),
    );
    expect(byPlacement.get('top-center')).toEqual([topSecond, topFirst]);
    expect(byPlacement.get('bottom-center')).toEqual([bottomFirst, bottomSecond]);
  });

  it('caps each placement independently — a fourth toast never evicts another column', () => {
    const service = createService();
    const other = service.show({ title: 'Elsewhere', placement: 'top-end' });
    const first = service.show({ title: 'One' });
    service.show({ title: 'Two' });
    service.show({ title: 'Three' });
    const fourth = service.show({ title: 'Four' });

    const ids = service.toasts().map((t) => t.id);
    expect(ids).toContain(other);
    expect(ids).not.toContain(first);
    expect(ids).toContain(fourth);
    expect(service.toasts().filter((t) => t.placement === 'bottom-center').length).toBe(3);
  });

  it('drops a placement from stacks() once its last toast is dismissed', () => {
    const service = createService();
    const id = service.show({ title: 'Arriving news', placement: 'top-center' });
    service.show({ title: 'Saved' });

    service.dismiss(id);

    expect(service.stacks().map((s) => s.placement)).toEqual(['bottom-center']);
  });
});
