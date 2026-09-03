import { Directive, DestroyRef, TemplateRef, inject } from '@angular/core';

import { ScreenChromeService } from '../service/screen-chrome.service';

/**
 * Hub ADR-0042 §2, `wedding-web` T341. Structural directive a screen applies
 * to whichever element (or `<ng-template>`) should render in `private-layout`
 * 's pinned head slot instead of at its own position in the screen's
 * template — e.g. `<header class="header" *appScreenHead>` (`guest-manager`,
 * gated on that route's `headPinned: true`).
 *
 * **Registration and teardown are co-located here**, never split across two
 * files (ADR-0042 §2's substantive claim): the constructor registers this
 * `TemplateRef` with {@link ScreenChromeService}, and `DestroyRef.onDestroy`
 * clears it on the same object. The clear the service performs is itself
 * guarded against the incoming screen having already registered its own head
 * before this directive tears down — Angular constructs the incoming route's
 * component tree before destroying the outgoing one, so that ordering is the
 * normal case, not an edge case. See `ScreenChromeService.clearHead` for the
 * guard itself.
 *
 * Deliberately does **not** call `viewContainerRef.createEmbeddedView()` —
 * unlike a normal structural directive (`*ngIf`, `*ngFor`), this one never
 * renders its template in place. It only hands the `TemplateRef` to the
 * service; `private-layout` is the sole place that instantiates it, via
 * `NgTemplateOutlet`. The embedded view therefore executes in *this*
 * directive's screen's injector while living in the layout's own
 * change-detection tree — the CDK Portal shape the T341 prototype gate
 * proved holds zoneless (ADR-0042 §Gate outcome).
 *
 * See `AppScreenFoot` (`screen-foot.directive.ts`) for the identical
 * mechanism on the pinned foot slot, and `ScreenChromeHarness`
 * (`screen-chrome-harness.ts`) for how a screen's own spec asserts on
 * projected content it cannot render standalone.
 */
@Directive({
  selector: '[appScreenHead]',
})
export class AppScreenHead {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly chrome = inject(ScreenChromeService);

  constructor() {
    this.chrome.registerHead(this.template);
    inject(DestroyRef).onDestroy(() => this.chrome.clearHead(this.template));
  }
}
