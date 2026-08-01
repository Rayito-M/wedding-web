import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ConsentService } from '@app/core/service/consent.service';
import { Btn } from '@app/shared/button/button';

/**
 * Fixed bottom bar asking once for GA4 analytics consent (hub ADR-0027).
 * Mirrors DS `components/core/ConsentBanner.jsx`: never a center modal,
 * never blocks the page behind it, equal-weight accept/decline pills.
 */
@Component({
  selector: 'app-consent-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Btn, RouterLink, TranslatePipe],
  templateUrl: './consent-banner.html',
  styleUrl: './consent-banner.scss',
})
export class ConsentBanner {
  private readonly consentService = inject(ConsentService);

  /** Shown only until a decision is persisted; never reappears afterward. */
  protected readonly visible = computed(() => this.consentService.decision() === null);

  protected accept(): void {
    this.consentService.writeConsent('accepted');
  }

  protected decline(): void {
    this.consentService.writeConsent('declined');
  }
}
