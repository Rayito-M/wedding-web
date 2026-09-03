import { Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { ScreenChromeService } from '../service/screen-chrome.service';

/**
 * Test-only harness for a screen that projects chrome via `*appScreenHead` /
 * `*appScreenFoot` (hub ADR-0042 §2, `wedding-web` T341). `AppScreenHead` /
 * `AppScreenFoot` never call `createEmbeddedView()` themselves — they only
 * hand the registered `TemplateRef` to `ScreenChromeService`; `PrivateLayout`
 * is the sole place that instantiates it, via `NgTemplateOutlet`. A screen
 * mounted standalone in its own spec therefore never renders its projected
 * head/foot content at all: a DOM assertion about it fails not because the
 * content is wrong but because nothing in that fixture ever asked
 * `ScreenChromeService` what to render. `guest-manager.spec.ts:1137` was
 * exactly this — asserting the layout's pinning contract from inside the
 * screen's own fixture — and every screen T343 migrates meets the same gap,
 * so the fix is decided once here rather than per screen.
 *
 * `ScreenChromeHarness` reproduces just enough of `PrivateLayout`'s own
 * rendering — the `@if (chrome.head(); as h) { <ng-container
 * [ngTemplateOutlet]="h" /> }` shape, for both slots — around an
 * `<ng-content>` the caller fills with the screen under test, so a spec can
 * assert on the projected chrome the same way it asserts on the rest of the
 * screen's DOM: one fixture, one `nativeElement`. It does **not** reproduce
 * `PrivateLayout`'s pinning CSS (`.screen-scroll`, the `main`
 * `hidden`→`clip` yield) — that is `PrivateLayout`'s own contract, covered by
 * `layouts/private-layout/screen-chrome.spec.ts`, not this harness.
 *
 * Usage:
 * ```ts
 * @Component({
 *   imports: [ScreenChromeHarness, GuestManager],
 *   template: `<app-screen-chrome-harness><app-guest-manager /></app-screen-chrome-harness>`,
 * })
 * class Host {}
 *
 * const fixture = TestBed.createComponent(Host);
 * fixture.detectChanges();
 * fixture.nativeElement.querySelector('.header'); // the pinned head, rendered
 * ```
 *
 * `ScreenChromeService` is `providedIn: 'root'`, so the harness and the
 * screen it wraps share the same instance without any extra provider — the
 * same DI shape `PrivateLayout` and its routed screens have in production.
 */
@Component({
  selector: 'app-screen-chrome-harness',
  imports: [NgTemplateOutlet],
  template: `
    @if (chrome.head(); as head) {
      <ng-container [ngTemplateOutlet]="head" />
    }
    <ng-content />
    @if (chrome.foot(); as foot) {
      <ng-container [ngTemplateOutlet]="foot" />
    }
  `,
})
export class ScreenChromeHarness {
  protected readonly chrome = inject(ScreenChromeService);
}
