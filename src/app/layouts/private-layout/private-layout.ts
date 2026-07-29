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

import { ScreenHeader } from '../../shared/screen-header/screen-header';
import { TabBar } from '../../shared/tab-bar/tab-bar';

/** Chrome flags read from the active child route's `data`. */
interface RouteChrome {
  tab?: string;
  tabBar?: boolean;
  topNav?: boolean;
}

/**
 * Shell for the authenticated ("private") zone: renders the shared screen
 * header (which carries the desktop nav ≥900px) and the mobile tab-bar around a
 * `<router-outlet>`. Which chrome shows is driven by the active child route's
 * `data` (`tab`, `tabBar`, `topNav`).
 */
@Component({
  selector: 'app-private-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ScreenHeader, TabBar],
  templateUrl: './private-layout.html',
  styleUrl: './private-layout.scss',
})
export class PrivateLayout {
  private readonly router = inject(Router);

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
