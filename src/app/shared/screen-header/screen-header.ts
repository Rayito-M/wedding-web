import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ConfigurationService, LoginService, TranslateLanguageService } from '../../core';
import { GuestService } from '../../core/guest.service';
import { LangCode } from '../../model';
import { Monogram } from '../monogram/monogram';
import { NAV_TABS } from '../nav-tabs';

/**
 * Per-screen header row: monogram left, an uppercase meta label right, and the
 * account avatar. On large screens (≥900px) it also carries the primary nav
 * (same role-filtered entries as the bottom TabBar); the TabBar covers
 * navigation on small screens. The avatar is always present (every screen and
 * size) and opens a menu to switch language or sign out. Rendered once by
 * {@link PrivateLayout}; the meta label comes from {@link HeaderService}.
 */
@Component({
  selector: 'app-screen-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, KeyValuePipe, Monogram],
  templateUrl: './screen-header.html',
  styleUrl: './screen-header.scss',
})
export class ScreenHeader {
  private readonly login = inject(LoginService);
  private readonly guests = inject(GuestService);
  private readonly config = inject(ConfigurationService);
  private readonly lang = inject(TranslateLanguageService);
  private readonly router = inject(Router);

  readonly meta = input('');
  /** Active nav entry id (matches a NAV_TABS `id`), for the desktop nav accent. */
  readonly active = input('');
  /** Whether to show the desktop nav (route `data.topNav`); still gated to ≥900px. */
  readonly showNav = input(true);

  protected readonly tabs = computed(() =>
    NAV_TABS.filter((tab) => !tab.roles || tab.roles.includes(this.login.role())),
  );

  /** Account avatar glyph — the signed-in user's initial. */
  protected readonly initial = computed(() => this.guests.guest().initial);

  /** Languages enabled for this wedding (code → display name), or undefined until config loads. */
  protected readonly languages = computed(() => this.config.weddingConfigPublic()?.language);

  protected readonly menuOpen = signal(false);

  protected get currentLang(): LangCode {
    return this.lang.currentLang;
  }

  protected toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  protected selectLanguage(code: string): void {
    this.lang.setLanguage(code as LangCode);
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.menuOpen.set(false);
    this.login.logout();
    void this.router.navigate(['/']);
  }

  /** Any click outside the menu (the toggle stops propagation) closes it. */
  @HostListener('document:click')
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
