import { ChangeDetectionStrategy, Component, signal, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  EntityNamesEnum,
  RsvpDto,
  RsvpDtoAdultsPartner1Options,
  UserProfileDto,
  UpdateUserProfileDto,
  CreateGuestDtoRelation,
  GuestListResponseDtoItemsInnerRelationOneOf,
  TranslateLanguageService,
  lastSeenLabel as formatLastSeen,
  todayInMadrid,
  partnerHasAccount,
} from '@app/core';
import { Modal } from '@app/shared/modal/modal';
import { Btn } from '@app/shared/button/button';
import { DecorFish } from '@app/shared/decor/fish';
import { ProfileFields, ProfileFieldsValue } from '@app/shared/profile-fields/profile-fields';
import { RelationKind } from '@app/shared/relation-fields/relation-fields';

/** The family variant of `CreateGuestDtoRelation`, whose `link` is the closed
 *  relationship enum (the other variants take free text) — mirrors
 *  `guest-create-modal`'s `FamilyRelation`. */
type FamilyRelation = GuestListResponseDtoItemsInnerRelationOneOf;

const SIDE_ENUM = GuestListResponseDtoItemsInnerRelationOneOf.SideEnum;

/** Seed for `editDraft` before `startEdit()` runs — `preferredLang` is never
 *  shown or edited here (`showLanguage` is off, see the class doc), so its
 *  value is inert; it only exists to satisfy `ProfileFieldsValue`'s shape. */
const EMPTY_DRAFT: ProfileFieldsValue = {
  firstName: '',
  lastName: '',
  nickname: '',
  email: '',
  phoneNumber: '',
  preferredLang: UpdateUserProfileDto.PreferredLangEnum.ES,
  relation: { side: SIDE_ENUM.BRIDE, kind: 'family', link: '' },
};

/**
 * Guest profile overlay — what a row click in the guest-manager table opens
 * (DS `ScreenGuestManager.jsx`, the `selId != null && !draft && !profDraft`
 * branch of the profile overlay).
 *
 * Read-only contact/relation facts plus an RSVP *summary* card. The summary
 * is a button, not a form: editing the reply itself is the sibling
 * `app-manage-rsvp-modal`'s job, reached through `(manageRsvp)` — matching
 * the DS, where the resume card and the footer's "Manage RSVP" both open the
 * RSVP editor. The only thing edited in place here is the guest's own profile
 * (`viewMode === 'edit'`).
 */
@Component({
  selector: 'app-guest-profile-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslatePipe, Modal, Btn, DecorFish, ProfileFields],
  templateUrl: './guest-profile-modal.html',
  styleUrl: './guest-profile-modal.scss',
})
export class GuestProfileModal {
  readonly isOpen = signal(false);
  readonly closeModal = output<void>();
  /** "Manage RSVP" / the summary card — emits the guest's user id. */
  readonly manageRsvp = output<string>();

  /**
   * Shared predicate (ADR W-0002 §Decision.2) exposed to the profile template,
   * which suffixes the partner's name with "own guest account" or "plus-one".
   */
  protected readonly partnerHasAccount = partnerHasAccount;

  /** `'profile'` — read-only guest info + RSVP summary; `'edit'` — profile-edit form. */
  protected readonly viewMode = signal<'profile' | 'edit'>('profile');

  /** Set by `open(userId)` — the RSVP's `id` equals its primary guest's user id. */
  private readonly userId = signal<string | null>(null);
  private readonly translate = inject(TranslateService);

  private readonly translateLanguageService = inject(TranslateLanguageService);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  /**
   * Read-only lookup into the profiles `guest-manager.ts` already bulk-loads
   * — this modal never fetches profiles itself, it only reads the shared cache.
   */
  private readonly userProfiles = toSignal(this.userProfileCollection.entities$, {
    initialValue: [] as UserProfileDto[],
  });

  /**
   * The full RSVP for the guest `open()` was called with. `guest-manager.ts`
   * only ever hands this modal a user id (the table row's list source is the
   * lightweight `UserProfileDto.rsvp` summary, not full RSVPs), so this modal
   * owns fetching the one record it needs by id.
   *
   * Stays `null` for a guest who has never replied — the profile still
   * renders, only the summary card is swapped for an empty line.
   */
  private readonly rsvps = toSignal(this.rsvpCollection.entities$, {
    initialValue: [] as RsvpDto[],
  });

  protected readonly rsvp = computed<RsvpDto | null>(() => {
    const userId = this.userId();
    if (!userId) return null;
    return this.rsvps().find((r) => r.id === userId) ?? null;
  });

  /** Profile of the guest this overlay is about — shares its id with the RSVP. */
  protected readonly guestProfile = computed<UserProfileDto | undefined>(() => {
    const userId = this.userId();
    if (!userId) return undefined;
    return this.userProfiles().find((p) => p.id === userId);
  });

  /**
   * Edit-form state (implementer's call, T311's acceptance criteria):
   * `app-profile-fields` speaks plain input/output "patch" semantics, not
   * `FormGroup`/`formControlName` — bridging it back onto a `FormGroup` would
   * mean keeping two sources of truth in sync (`FormGroup` ⇄ component
   * value/valueChange) for no benefit, so this host now owns a plain draft
   * signal instead, matching `rsvp-editor`'s existing draft-signal precedent.
   * Validation (`firstName`/`lastName`/`relation.link` required) moves into
   * `saveProfile()`; `submitAttempted` stands in for `markAllAsTouched()`,
   * gating `linkErrorHint` below.
   */
  protected readonly editDraft = signal<ProfileFieldsValue>(EMPTY_DRAFT);

  /** Set once a save has been attempted while the form was invalid — mirrors
   *  `FormGroup.markAllAsTouched()`'s role, but as this host's own state
   *  rather than a form-control flag (see `editDraft`'s doc). */
  protected readonly submitAttempted = signal(false);

  /**
   * `app-relation-fields` (composed inside `app-profile-fields`) has no
   * built-in "touched && invalid" error slot of its own — only the plain
   * `hint` it's always handed (phase-U's T309/T310, already built and out of
   * this task's scope). Reusing that same slot for the required-link message,
   * shown only once a save has actually been attempted with no link, is the
   * closest equivalent this component boundary allows to the old
   * `editForm.controls.link.touched && invalid` error line.
   */
  protected readonly linkErrorHint = computed<string | undefined>(() =>
    this.submitAttempted() && !this.editDraft().relation?.link.trim()
      ? this.translate.instant('guest_manager.form.linkHint')
      : undefined,
  );

  protected readonly participantsCount = computed(() => {
    const rsvp = this.rsvp();
    if (!rsvp) return 0;
    return (rsvp.adults.partner2 ? 2 : 1) + (rsvp.children?.length ?? 0);
  });

  protected readonly childrenCount = computed(() => this.rsvp()?.children?.length ?? 0);

  protected readonly dietaryPeopleCount = computed(() => {
    const rsvp = this.rsvp();
    if (!rsvp) return 0;
    return this.collectOptions(rsvp).filter((options) => this.hasDietary(options)).length;
  });

  protected readonly childrenNamesSummary = computed<string | null>(() => {
    const names = (this.rsvp()?.children ?? []).map((c) => `${c.firstName}`);
    return names.length ? names.join(', ') : null;
  });

  protected readonly dietarySummary = computed(() => this.preferenceSummary('dietary'));
  protected readonly allergySummary = computed(() => this.preferenceSummary('allergy'));

  /** Free-text note the guest left with their reply (partner1's comments). */
  protected readonly guestNote = computed<string | null>(
    () => this.rsvp()?.adults.partner1.options?.comments || null,
  );

  protected readonly guestFullName = computed(() => {
    const profile = this.guestProfile();
    return profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  });

  /**
   * `relation.link` is a catalog key for `family` (rendered through
   * `guest_manager.relation.link.*`, as `guest-create-modal` writes it) and
   * free text for every other kind — so only the family case is translated.
   */
  protected readonly relationLinkLabel = computed<string | null>(() => {
    const relation = this.guestProfile()?.guestInfo?.relation;
    if (!relation?.link) return null;
    return relation.kind === 'family'
      ? this.translate.instant(`guest_manager.relation.link.${relation.link}`)
      : relation.link;
  });

  protected readonly modalTitle = computed(() =>
    this.viewMode() === 'edit'
      ? this.translate.instant('guest_manager.modal.editProfile')
      : this.guestFullName() || this.translate.instant('guest_manager.modal.guestPlaceholder'),
  );

  /**
   * The same pre-formatted label the guest-manager row/column render (T290's
   * pure helper), read directly off `UserProfileDto.lastSeen`. Read-only,
   * admin-surface-only — there is no edit control (ADR-0035 §2/§6). `/guests`
   * sits behind `rbacGuard` with `roles: ['groom', 'bride']`, so this modal's
   * caller is always the couple and the API always populates the real value
   * (hub ADR-0036) — no separate role check is needed here.
   */
  protected readonly lastSeenLabel = computed(() => {
    const profile = this.guestProfile();
    if (!profile) return '';
    return formatLastSeen(
      profile.lastSeen,
      todayInMadrid(),
      this.translateLanguageService.currentLang(),
      (key) => this.translate.instant(key),
    );
  });

  /**
   * Open the overlay for this guest and fetch their RSVP fresh — but only if
   * the profile says there is one: `GET /v1/rsvp/{id}` answers 204 for a guest
   * who never replied, which @ngrx/data can only report as a failed query.
   *
   * `opts.edit` skips the read-only view and seeds the edit form straight
   * away, reusing `startEdit()`'s seeding rather than duplicating it — the
   * RSVP editor's "open their profile" jump (T308) uses this; a normal
   * guest-table row click (`guest-manager.ts`'s `openGuestProfile`) does not.
   */
  open(userId: string, opts?: { edit?: boolean }): void {
    this.userId.set(userId);
    if (this.userProfiles().find((p) => p.id === userId)?.guestInfo?.rsvp) {
      this.rsvpCollection.getByKey(userId);
    }
    this.isOpen.set(true);
    if (opts?.edit) {
      this.startEdit();
    } else {
      this.viewMode.set('profile');
    }
  }

  close(): void {
    this.isOpen.set(false);
    this.viewMode.set('profile');
    this.closeModal.emit();
  }

  /** Hand the guest over to `app-manage-rsvp-modal` (the parent swaps them). */
  protected openRsvp(): void {
    const userId = this.userId();
    if (!userId) return;
    this.isOpen.set(false);
    this.manageRsvp.emit(userId);
  }

  /** Enter the profile-edit view, seeded from the currently loaded profile. */
  protected startEdit(): void {
    const profile = this.guestProfile();
    const relation = profile?.guestInfo?.relation;
    this.editDraft.set({
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      nickname: profile?.nickname ?? '',
      email: profile?.email ?? '',
      phoneNumber: profile?.phoneNumber ?? '',
      preferredLang: profile?.preferredLang ?? UpdateUserProfileDto.PreferredLangEnum.ES,
      relation: {
        side: relation?.side ?? SIDE_ENUM.BRIDE,
        kind: (relation?.kind as RelationKind | undefined) ?? 'family',
        link: relation?.link ?? '',
      },
    });
    this.submitAttempted.set(false);
    this.viewMode.set('edit');
  }

  protected cancelEdit(): void {
    this.viewMode.set('profile');
  }

  /**
   * Handles the edit form's native `submit` event (Enter inside a field, hard
   * rule 9's "submit on Enter") — a plain `(submit)` listener, not `(ngSubmit)`:
   * with no `FormGroup`/`NgForm` in this view any more (see `editDraft`'s
   * doc), there is no Angular forms directive left to provide `ngSubmit`, so
   * this host prevents the browser's own default full-page form submission
   * itself and calls `saveProfile()`.
   */
  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.saveProfile();
  }

  /**
   * Saves firstName/lastName/relation via the real profile-update endpoint
   * (`EntityCollectionService.update` → `UserProfileDataService` →
   * `profileControllerUpdateProfileByIdV1`). Email/phone are intentionally
   * not editable here: `UpdateUserProfileDto` (the actual API contract) has
   * no fields for them, so this view shows them read-only instead of wiring
   * up form controls that could never be saved.
   *
   * Required-field validation (`firstName`/`lastName`/`relation.link`) now
   * lives here rather than on a `FormGroup` (see `editDraft`'s doc) —
   * `submitAttempted` stands in for the old `markAllAsTouched()` call, same
   * "required fields block save" behavior as before the migration.
   */
  protected saveProfile(): void {
    const draft = this.editDraft();
    const relation = draft.relation;
    if (!draft.firstName.trim() || !draft.lastName.trim() || !relation || !relation.link.trim()) {
      this.submitAttempted.set(true);
      return;
    }

    const profile = this.guestProfile();
    if (!profile) return;

    const { firstName, lastName, nickname } = draft;
    // `CreateGuestDtoRelation` is a union: the family variant's `link` is the
    // strict `LinkEnum` (the family `<select>`, ported into
    // `app-relation-fields`, only ever assigns one of its members), the other
    // variants take free text — same split as `guest-create-modal`'s
    // `guestDraft()`.
    const relationPayload: CreateGuestDtoRelation =
      relation.kind === 'family'
        ? { side: relation.side, kind: relation.kind, link: relation.link as FamilyRelation['link'] }
        : { side: relation.side, kind: relation.kind, link: relation.link };

    this.userProfileCollection
      .update({
        id: profile.id,
        firstName,
        lastName,
        nickname: nickname || undefined,
        guestInfo: { relation: relationPayload },
      })
      .subscribe({
        next: () => this.viewMode.set('profile'),
        error: (err: unknown) => console.error('Failed to save profile', err),
      });
  }

  private collectOptions(rsvp: RsvpDto): RsvpDtoAdultsPartner1Options[] {
    const people = [rsvp.adults.partner1, rsvp.adults.partner2, ...(rsvp.children ?? [])];
    return people
      .map((person) => person?.options)
      .filter((options): options is RsvpDtoAdultsPartner1Options => !!options);
  }

  private hasDietary(options: RsvpDtoAdultsPartner1Options): boolean {
    return !!(options.dietaryPreferenceIds?.length || options.customDietaryPreferences?.length);
  }

  private preferenceSummary(kind: 'dietary' | 'allergy'): string | null {
    const rsvp = this.rsvp();
    if (!rsvp) return null;
    const options = this.collectOptions(rsvp);
    const customTexts = options.flatMap((o) =>
      kind === 'dietary' ? (o.customDietaryPreferences ?? []) : (o.customAllergies ?? []),
    );
    if (customTexts.length) return customTexts.join(', ');
    const idCount = options.reduce(
      (total, o) =>
        total +
        (kind === 'dietary' ? (o.dietaryPreferenceIds?.length ?? 0) : (o.allergyIds?.length ?? 0)),
      0,
    );
    return idCount > 0 ? String(idCount) : null;
  }
}
