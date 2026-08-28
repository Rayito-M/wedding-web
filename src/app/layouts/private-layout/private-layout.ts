import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { ToastCenterService } from '@app/core';

import { DecorMotorcycleRider } from '../../shared/decor/motorcycle-rider/motorcycle-rider';
import { ScreenHeader } from '../../shared/screen-header/screen-header';
import { TabBar } from '../../shared/tab-bar/tab-bar';
import { Toast } from '../../shared/toast/toast';
import { ToastStack } from '../../shared/toast-stack/toast-stack';

/** Chrome flags read from the active child route's `data`. */
interface RouteChrome {
  tab?: string;
  tabBar?: boolean;
  topNav?: boolean;
  /** Show the decorative motorcycle-rider crossing above the mobile tab bar. */
  moto?: boolean;
}

/**
 * Shell for the authenticated ("private") zone: renders the shared screen
 * header (which carries the desktop nav ≥900px) and the mobile tab-bar around a
 * `<router-outlet>`. Which chrome shows is driven by the active child route's
 * `data` (`tab`, `tabBar`, `topNav`).
 *
 * Also mounts the app's toast stacks (T285) — one `app-toast-stack` per
 * placement `ToastCenterService.stacks()` currently holds toasts for, so a
 * toast survives navigation between private screens. Every stack is asked to
 * clear the mobile tab bar; `clearsTabBar` is a no-op on any placement the
 * bar cannot cover (`toast-stack.scss`). Producers pick a placement per
 * toast, defaulting to `bottom-center`. There is no stack on the public/auth
 * shell.
 */
@Component({
  selector: 'app-private-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ScreenHeader, TabBar, ToastStack, Toast, DecorMotorcycleRider],
  templateUrl: './private-layout.html',
  styleUrl: './private-layout.scss',
})
export class PrivateLayout {
  private readonly router = inject(Router);
  protected readonly toastCenter = inject(ToastCenterService);

  @ViewChild('mainContent') private mainContent?: ElementRef<HTMLElement>;
  protected readonly isScrolled = signal(false);

  // Seed from the current route: this layout mounts *after* the NavigationEnd
  // that activated it, so the stream alone would miss the first value.
  protected readonly chrome = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.deepestChrome()),
    ),
    { initialValue: this.deepestChrome() },
  );

  private deepestChrome(): RouteChrome {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return route.data;
  }

  protected onMainScroll(): void {
    if (this.mainContent) {
      this.isScrolled.set((this.mainContent.nativeElement.scrollTop ?? 0) > 0);
    }
  }
}
