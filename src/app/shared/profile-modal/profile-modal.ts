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

import {
  UpdateUserProfileDto,
  UserProfileDto,
  RelationLinkPipe,
  TranslateLanguageService,
} from '@app/core';
import { Avatar } from '@app/shared/avatar/avatar';
import { Btn } from '@app/shared/button/button';
import { DelegateChip, DelegateChips } from '@app/shared/delegate-chips/delegate-chips';
import { Modal } from '@app/shared/modal/modal';
import { Pill } from '@app/shared/pill/pill';
import { ProfileFields, ProfileFieldsValue } from '@app/shared/profile-fields/profile-fields';

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
 *
 * **Field list (T312):** the hand-rolled firstName/lastName/nickname/email/
 * phone/language fields are `<app-profile-fields>` (T310) with `lockContact`
 * on — email/phone render as read-only rows even while editing, carrying
 * forward T303's "visually present but never part of `save`'s payload"
 * behavior, now owned by the shared component — and **`showRelation` off**:
 * this call site keeps its existing "link out to `/people`, read-only there"
 * behavior verbatim (Phase U intro's explicit decision — self-service
 * relation editing here is a separate, explicitly-scoped follow-up, not a
 * side effect of this dedup). The identity block above the field list
 * (avatar/name/nickname/role/relation pills) is not part of `ProfileFields`
 * in the DS either, so it stays hand-rolled here.
 *
 * **"Who answers your RSVP" (hub ADR-0039 §6, T336):** `<app-delegate-chips>`
 * over the host-resolved `delegateChips()`, **read-only in every mode,
 * including edit** — the guest-side grant picker `ProfileModal.jsx` draws
 * here, and its "The couple can also set this up on your behalf" line, are
 * both cut (hard rule 18(a)); the only editable surface for a delegation is
 * the couple's guest profile editor. Rendered only while `isOwnProfile()`
 * **and** `canHaveDelegates()` are true — never for a linked partner's
 * profile, never for a couple member's own (ADR-0039 §1: only guests can
 * have delegates). Both gates are explicit inputs, never "whether
 * `delegateChips()` happens to be non-empty".
 */
@Component({
  selector: 'app-profile-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Modal,
    Btn,
    Avatar,
    Pill,
    ProfileFields,
    DelegateChips,
    RouterLink,
    TranslatePipe,
    RelationLinkPipe,
  ],
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
  /** `true` (default) means this modal shows the signed-in user's own
   *  profile — every existing call site keeps calling this unbound.
   *  `false` (T317) means it shows a linked partner's profile instead,
   *  which `resolvedTitle` below must not label as "My profile". */
  readonly isOwnProfile = input(true);
  /**
   * Resolved chips for "who answers your RSVP for you" (hub ADR-0039 §6,
   * T336) — the host (`private-layout.ts`) resolves names and hands them
   * over fully formed, the same "host resolves it, this component only
   * renders it" split `profile` itself already uses (this component has no
   * `HttpClient`/`EntityCollectionService`, see the class doc). **Read-only
   * in every mode, including edit** — hard rule 18(a): the guest-side grant
   * picker the DS draws here is cut, there is no remove control, no search,
   * ever, on this call site. Rendered only while `isOwnProfile()` is true
   * (never for a linked partner's profile) — gated by the host on that same
   * explicit signal, not on whether this array happens to be non-empty.
   */
  readonly delegateChips = input<DelegateChip[]>([]);
  /**
   * Whether the profile on show is one that can have delegates at all —
   * `false` for the couple and for providers, whose documents omit
   * `delegateTo` entirely (hub ADR-0039 §1: "the couple and providers cannot
   * *have* delegates"). Gates the whole "who answers your RSVP" section, so
   * a couple member opening their own profile sees no delegation surface —
   * not even the "Nobody answers for you" empty state, which would describe
   * an arrangement they can never have. Defaults to `true`: the guest case
   * is the common one and every existing call site is a guest's.
   */
  readonly canHaveDelegates = input(true);
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

  /** Read reactively so the resolved header title re-translates on a language
   *  switch while the modal happens to stay open — same hazard/fix as
   *  `NotificationDialog.resolvedTitle`. */
  protected readonly lang = this.langService.currentLang;

  /** Plain, already-resolved string — `Modal`'s `[title]` renders it raw
   *  (no `translate` pipe inside `Modal`'s own template). Branches on
   *  `isOwnProfile` (ADR W-0006 Decision 5) so a partner's profile, opened
   *  through this same component (T317), is never mislabeled as the
   *  signed-in guest's own. */
  protected readonly resolvedTitle = computed(() => {
    this.lang();
    return this.translateService.instant(
      this.isOwnProfile() ? 'shared.myProfile' : 'profileModal.partnerTitle',
    );
  });

  /** Pre-translated, forwarded to `app-profile-fields`' `contactHint` input —
   *  shown under the locked email/phone rows while editing (DS
   *  `ProfileModal.jsx`'s own `contactHint` string). */
  protected readonly contactHint = computed(() => {
    this.lang();
    return this.translateService.instant('profileModal.contactHint');
  });

  /** Pre-translated, forwarded to `app-delegate-chips`' `emptyText` input
   *  (T336) — "Nobody answers for you — only you can reply.", the guest's
   *  own second-person voice, distinct from `guest_manager.profile
   *  .delegatedTo`'s couple-facing copy for the same empty case. */
  protected readonly delegationEmptyText = computed(() => {
    this.lang();
    return this.translateService.instant('delegation.field.emptyGuest');
  });

  protected readonly editing = signal(false);
  protected readonly saved = signal(false);
  private readonly draft = signal<ProfileFieldsValue | null>(null);

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

  /** The value handed to `<app-profile-fields>`: the in-progress `draft` while
   *  editing, otherwise the loaded `profile` mapped onto the same shape (T312
   *  — `ProfileFieldsValue` replaces the old local `ProfileDraft`, per this
   *  task's acceptance). `relation` is never set here — `showRelation` is off
   *  for this call site (see the class doc comment), so `app-profile-fields`
   *  never reads it. */
  protected readonly fieldsValue = computed<ProfileFieldsValue>(() => {
    const d = this.draft();
    if (d) return d;
    const p = this.profile();
    return {
      firstName: p?.firstName ?? '',
      lastName: p?.lastName ?? '',
      nickname: p?.nickname ?? '',
      email: p?.email ?? '',
      phoneNumber: p?.phoneNumber ?? '',
      preferredLang: p?.preferredLang ?? UpdateUserProfileDto.PreferredLangEnum.EN,
    };
  });

  /** Read by the identity block only — the field list itself is rendered by
   *  `<app-profile-fields>`, which reads `fieldsValue()` directly. */
  protected readonly firstName = computed(() => this.fieldsValue().firstName);
  protected readonly lastName = computed(() => this.fieldsValue().lastName);
  protected readonly nickname = computed(() => this.fieldsValue().nickname);

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

  /** `app-profile-fields`' `(valueChange)` handler — it always emits the full
   *  next value ("patch" semantics, same as `rsvp-editor`'s `draftChange`),
   *  including the already-clamped-at-30 nickname (T310 owns that clamp now,
   *  T307's corrected cap — this component no longer slices it itself). */
  protected onFieldsChange(value: ProfileFieldsValue): void {
    this.draft.set(value);
    this.saved.set(false);
  }

  /**
   * Emits only the fields this form can actually change — `email`/
   * `phoneNumber`/`relation` are deliberately excluded: `UpdateUserProfileDto`
   * has no fields for the former two, and `showRelation` is off for this call
   * site (see the class doc comment), so the latter is never wired into
   * `save` as a side effect of this migration (T312's explicit acceptance).
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
}
