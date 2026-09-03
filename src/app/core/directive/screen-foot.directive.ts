import { Directive, DestroyRef, TemplateRef, inject } from '@angular/core';

import { ScreenChromeService } from '../service/screen-chrome.service';

/**
 * Hub ADR-0042 §2, `wedding-web` T341. Structural directive a screen applies
 * to whichever element (or `<ng-template>`) should render in `private-layout`
 * 's pinned foot slot instead of at its own position in the screen's
 * template — e.g. `<div class="list-footer" *appScreenFoot>` (`guest-manager`
 * , gated on that route's `footPinned: true`).
 *
 * Identical mechanism to `AppScreenHead` (`screen-head.directive.ts`) on the
 * independent foot slot — same class doc applies verbatim, substituting
 * `registerFoot`/`clearFoot` for `registerHead`/`clearHead`. Kept as a
 * separate directive/class rather than one directive taking a `slot` input
 * so registration and teardown stay two narrow, un-parameterised calls per
 * slot (ADR-0042 §2's "co-located, never split" claim applies to the slot
 * choice too — a wrong input value would silently register in the other
 * slot instead of failing to compile).
 */
@Directive({
  selector: '[appScreenFoot]',
})
export class AppScreenFoot {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly chrome = inject(ScreenChromeService);

  constructor() {
    this.chrome.registerFoot(this.template);
    inject(DestroyRef).onDestroy(() => this.chrome.clearFoot(this.template));
  }
}
