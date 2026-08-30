import { KeyValuePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfigurationService, UserProfileDto, TranslateLanguageService } from '@app/core';
import { Avatar } from '@app/shared/avatar/avatar';
import { Btn } from '@app/shared/button/button';
import { TextInput } from '@app/shared/input/input';
import { Modal } from '@app/shared/modal/modal';
import { Pill } from '@app/shared/pill/pill';

/** Local editable draft — a subset of {@link UserProfileDto}'s writable-looking
 *  fields, plus `email`/`phoneNumber`, which stay visually editable but are
 *  never part of the payload {@link ProfileModal.save} emits (T303: preserved
 *  verbatim from `profile.ts`'s `ProfileForm`/`UpdateUserProfileDto` gap —
 *  the API has no fields for them). Not a redeclaration of any generated API
 *  model: this only ever holds a draft of plain strings for in-progress edits. */
interface ProfileDraft {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  phoneNumber: string;
  preferredLang: UserProfileDto.PreferredLangEnum;
}

/**
 * "My profile" modal (DS `76aa9fa` → `ProfileModal.jsx`), the account-dropdown
 * overlay that replaces the old `/profile` route (Phase T). Composes
 * `app-modal` the same way `NotificationDialog`/`ConfirmDialog` do — this
 * component never re-authors backdrop/panel/Escape chrome.
 *
 * **`size="lg"`** — `Modal`'s existing 520px dialog is the closest built-in
 * size to the DS's 540px; a new size variant for a 20px difference is
 * explicitly out of scope (T303/TASKS.md).
 *
 * **Identity block placement** — the DS renders "My profile" then, still
 * inside the fixed non-scrolling header, a large identity block (avatar/
 * name/nickname/role/relation), with only the field list below it
 * scrolling. `Modal` has exactly two content slots — `[modal-eyebrow]`
 * (small, above the title, inside the fixed header) and the scrollable
 * default-projected body — and neither cleanly fits "a large block, fixed,
 * below the title". This component puts the identity block at the top of
 * the scrollable body instead (reuses `Modal`'s existing slots, no
 * shared-component change) and uses `[title]` for the fixed "My profile"
 * header text alone, matching the DS's small eyebrow-style label in that
 * same fixed position.
 *
 * No `HttpClient`, no `EntityCollectionService` — `profile` is owned by the
 * host and `save`/`close` are both plain outputs; this component wires no
 * call site of its own (T304/T305's job).
 *
 * **Save outcome (T305):** the host performs the actual
 * `EntityCollectionService.update()` call and reports back through the
 * `saving`/`saveError` inputs — the only two pieces of async state this
 * component cannot own itself. The constructor `effect()` below watches for
 * a `saving` `true → false` edge to decide what happened: no error → the
 * save succeeded, so it exits edit mode and shows the "Saved." confirmation
 * (mirrors `profile.ts`'s old scaffold); an error → it does nothing, leaving
 * `editing`/`draft` untouched so the form stays exactly as the guest left
 * it, with `saveError()` driving an inline message in the template — the
 * same "stay in edit mode + visible message" shape as `rsvp-edit.ts`'s
 * `saveFailed`, just split across host/child since this modal never calls
 * the API itself.
 */
@Component({
  selector: 'app-profile-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, Btn, Avatar, Pill, TextInput, RouterLink, TranslatePipe, KeyValuePipe],
  templateUrl: './profile-modal.html',
  styleUrl: './profile-modal.scss',
  host: {
    // Scoped to this component's own host, not `window` — same reasoning as
    // `ConfirmDialog`/`NotificationDialog` (Phase M decision 5).
    '(keydown.escape)': 'onEscape($event)',
  },
})
export class ProfileModal {
  readonly open = input(false);
  readonly profile = input<UserProfileDto | null>(null);
  /** True while the host's `save`-triggered update is in flight. */
  readonly saving = input(false);
  /** True if the host's last update attempt failed. The host resets this to
   *  `false` at the start of every new attempt (mirrors `rsvp-edit.ts`'s
   *  `saveFailed`, cleared "whenever … a fresh save starts"). */
  readonly saveError = input(false);

  readonly save = output<{
    firstName: string;
    lastName: string;
    nickname?: string;
    preferredLang: UserProfileDto.PreferredLangEnum;
  }>();
  // reason: named `close` to match `Modal`'s own `(close)` contract and this
  // repo's `NotificationDialog`/`ConfirmDialog` precedent for a custom
  // element with no native `close` event to shadow.
  // eslint-disable-next-line @angular-eslint/no-output-native
  readonly close = output<void>();

  private readonly translateService = inject(TranslateService);
  private readonly langService = inject(TranslateLanguageService);
  private readonly config = inject(ConfigurationService);

  /** Read reactively so the resolved header title re-translates on a language
   *  switch while the modal happens to stay open — same hazard/fix as
   *  `NotificationDialog.resolvedTitle`. */
  protected readonly lang = this.langService.currentLang;

  /** Plain, already-resolved string — `Modal`'s `[title]` renders it raw
   *  (no `translate` pipe inside `Modal`'s own template). */
  protected readonly resolvedTitle = computed(() => {
    this.lang();
    return this.translateService.instant('shared.myProfile');
  });

  /** Languages enabled for this wedding (code → native display name), or
   *  undefined until config loads — same source `screen-header.ts`'s own
   *  language switcher reads, avoiding a hardcoded "Español/English/
   *  Français" literal set here. */
  protected readonly languages = computed(() => this.config.weddingConfigPublic()?.language);

  protected readonly editing = signal(false);
  protected readonly saved = signal(false);
  private readonly draft = signal<ProfileDraft | null>(null);

  /** Not a signal on purpose — plain instance state used only to detect the
   *  `saving` `true → false` edge inside the effect below; re-running the
   *  effect merely because `saving()` is read is fine, this just tells it
   *  when a save attempt has *just* finished. */
  private wasSaving = false;

  constructor() {
    effect(() => {
      const saving = this.saving();
      const failed = this.saveError();
      if (this.wasSaving && !saving && !failed) {
        this.editing.set(false);
        this.draft.set(null);
        this.saved.set(true);
      }
      this.wasSaving = saving;
    });
  }

  protected readonly initials = computed(() => {
    const p = this.profile();
    if (!p) return '·';
    return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase() || '·';
  });

  protected readonly firstName = computed(() => this.draft()?.firstName ?? this.profile()?.firstName ?? '');
  protected readonly lastName = computed(() => this.draft()?.lastName ?? this.profile()?.lastName ?? '');
  protected readonly nickname = computed(() => this.draft()?.nickname ?? this.profile()?.nickname ?? '');
  protected readonly email = computed(() => this.draft()?.email ?? this.profile()?.email ?? '');
  protected readonly phoneNumber = computed(
    () => this.draft()?.phoneNumber ?? this.profile()?.phoneNumber ?? '',
  );
  protected readonly preferredLang = computed(
    () => this.draft()?.preferredLang ?? this.profile()?.preferredLang,
  );

  protected onEscape(event: Event): void {
    if (!this.open()) return;
    event.stopPropagation();
    this.close.emit();
  }

  protected onClose(): void {
    this.close.emit();
  }

  /** Enter edit mode, seeded from the currently-loaded profile — mirrors
   *  `guest-profile-modal.ts`'s `startEdit()`. */
  protected startEdit(): void {
    const p = this.profile();
    if (!p) return;
    this.draft.set({
      firstName: p.firstName,
      lastName: p.lastName,
      nickname: p.nickname ?? '',
      email: p.email ?? '',
      phoneNumber: p.phoneNumber ?? '',
      preferredLang: p.preferredLang,
    });
    this.editing.set(true);
    this.saved.set(false);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.draft.set(null);
  }

  protected setField(key: keyof ProfileDraft, value: string): void {
    this.draft.update((d) => (d ? { ...d, [key]: value } : d));
    this.saved.set(false);
  }

  /** Same 8-character clamp as `profile.ts`'s `setNickname` / `rsvp-editor`'s
   *  `.slice(0, 8)` (Phase S, T298-T300). */
  protected setNickname(value: string): void {
    this.setField('nickname', value.slice(0, 8));
  }

  /** `code` is a config-supplied language key (`screen-header.ts`'s own
   *  `selectLanguage(code: string)` takes the same shape) — cast to the DTO's
   *  narrower enum, which the wedding config's language codes always satisfy. */
  protected setLang(code: string): void {
    if (!this.editing()) return;
    this.draft.update((d) =>
      d ? { ...d, preferredLang: code as UserProfileDto.PreferredLangEnum } : d,
    );
    this.saved.set(false);
  }

  /**
   * Emits only the fields this form can actually change — `email`/
   * `phoneNumber` are deliberately excluded (see {@link ProfileDraft}'s doc
   * comment): `UpdateUserProfileDto` has no fields for them.
   *
   * Does not itself leave edit mode or show "Saved." — the host owns the
   * actual write and reports its outcome back through `saving`/`saveError`;
   * the constructor `effect()` above reacts to that (T305).
   */
  protected onSave(): void {
    const d = this.draft();
    if (!d || this.saving()) return;
    this.save.emit({
      firstName: d.firstName,
      lastName: d.lastName,
      nickname: d.nickname || undefined,
      preferredLang: d.preferredLang,
    });
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
