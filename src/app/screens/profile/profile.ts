import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Pill } from '@app/shared/pill/pill';
import { TextInput } from '@app/shared/input/input';
import { Btn } from '@app/shared/button/button';
import { DecorFish } from '@app/shared/decor/fish';

/**
 * Presentational scaffold only (T238). Per design reference `ScreenProfile.jsx`
 * — the signed-in user's own profile, reached from the account dropdown
 * (never the tab bar): an identity card (avatar + name + role/relation pills
 * + flipped `FishIllustration`), an editable-looking field list (first
 * name/last name/email/phone via `app-input`) and a preferred-language
 * selector, plus a "visible to other guests" side note. One template,
 * switched purely by CSS (`@media (min-width: 900px)`) at `maxWidth: 860`,
 * same approach as `people` (T237) / `seating-plan` (T229).
 *
 * `ME_SEED` below is a small hardcoded fixture mirroring the shape of the
 * reference's `me` (`WEDDING_PEOPLE` entry `u3`) — not a service, not wired
 * to any API. Local signals (`form`, `lang`, `editing`, `saved`) only drive
 * the view/edit/saved visual states already shown in the reference; there is
 * no persistence layer, no `HttpClient`, no real save.
 */

type LangCode = 'es' | 'en' | 'fr';

interface Relation {
  readonly label: string;
  readonly side?: 'bride' | 'groom';
}

interface ProfileForm {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phoneNumber: string;
}

// The signed-in user's static identity — mirrors the reference's `me`
// (WEDDING_PEOPLE entry `u3`, a guest with a full relation+side). Role and
// relation are not part of the editable form.
const ME_SEED = {
  role: 'Guest',
  relation: { label: 'Cousin', side: 'bride' } as Relation,
};

const FORM_SEED: ProfileForm = {
  firstName: 'Laura',
  lastName: 'Ortega',
  email: 'laura.ortega@example.com',
  phoneNumber: '+34 655 908 771',
};

const LANGS: readonly { readonly code: LangCode; readonly label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Pill, TextInput, Btn, DecorFish, RouterLink],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
})
export class Profile {
  protected readonly me = ME_SEED;
  protected readonly langs = LANGS;

  protected readonly form = signal<ProfileForm>(FORM_SEED);
  protected readonly lang = signal<LangCode>('es');
  protected readonly editing = signal(false);
  protected readonly saved = signal(false);

  protected readonly initials = computed(() => {
    const { firstName, lastName } = this.form();
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '·';
  });

  protected readonly relationText = computed(() => {
    const relation = this.me.relation;
    return relation.side ? `${relation.label} · ${relation.side}` : relation.label;
  });

  protected setField(key: keyof ProfileForm, value: string): void {
    this.form.update((form) => ({ ...form, [key]: value }));
    this.saved.set(false);
  }

  protected setLang(code: LangCode): void {
    if (!this.editing()) return;
    this.lang.set(code);
  }

  protected startEdit(): void {
    this.editing.set(true);
    this.saved.set(false);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
  }

  protected save(): void {
    this.editing.set(false);
    this.saved.set(true);
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
