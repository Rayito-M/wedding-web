import { DestroyRef, Signal, inject, signal } from '@angular/core';

/** Reactive matchMedia — used where SVG pixel sizes change per breakpoint. */
export function mediaSignal(query: string): Signal<boolean> {
  const mql = window.matchMedia(query);
  const state = signal(mql.matches);
  const listener = (e: MediaQueryListEvent) => state.set(e.matches);
  mql.addEventListener('change', listener);
  inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', listener));
  return state.asReadonly();
}
