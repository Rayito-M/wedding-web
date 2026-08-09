import { ChangeDetectionStrategy, Component, signal, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  EntityNamesEnum,
  RsvpDto,
  RsvpDtoAdultsPartner1Options,
  UserProfileDto,
  CreateUserDtoGuestInfoRelation,
} from '@app/core';
import { Modal } from '@app/shared/modal/modal';
import { Btn } from '@app/shared/button/button';
import { TextInput } from '@app/shared/input/input';
import { DecorFish } from '@app/shared/decor/fish';
import { GuestSeg } from './guest-seg/guest-seg';

type RelationSide = 'bride' | 'groom' | 'both';
type RelationKind = 'family' | 'friends' | 'colleagues' | 'other';

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
  imports: [TranslatePipe, Modal, Btn, ReactiveFormsModule, TextInput, GuestSeg, DecorFish],
  templateUrl: './guest-profile-modal.html',
  styleUrl: './guest-profile-modal.scss',
})
export class GuestProfileModal {
  readonly isOpen = signal(false);
  readonly closeModal = output<void>();
  /** "Manage RSVP" / the summary card — emits the guest's user id. */
  readonly manageRsvp = output<string>();

  protected readonly relationSides: RelationSide[] = ['bride', 'groom', 'both'];
  protected readonly relationKinds: RelationKind[] = ['family', 'friends', 'colleagues', 'other'];

  /** `'profile'` — read-only guest info + RSVP summary; `'edit'` — profile-edit form. */
  protected readonly viewMode = signal<'profile' | 'edit'>('profile');

  /** Set by `open(userId)` — the RSVP's `id` equals its primary guest's user id. */
  private readonly userId = signal<string | null>(null);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly translate = inject(TranslateService);

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

  protected readonly editForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    side: this.fb.control<RelationSide>('bride'),
    kind: this.fb.control<RelationKind>('family'),
  });

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
   * Open the overlay for this guest and fetch their RSVP fresh — but only if
   * the profile says there is one: `GET /v1/rsvp/{id}` answers 204 for a guest
   * who never replied, which @ngrx/data can only report as a failed query.
   */
  open(userId: string): void {
    this.userId.set(userId);
    if (this.userProfiles().find((p) => p.id === userId)?.guestInfo?.rsvp) {
      this.rsvpCollection.getByKey(userId);
    }
    this.viewMode.set('profile');
    this.isOpen.set(true);
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
    this.editForm.setValue({
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      side: (profile?.guestInfo?.relation?.side as RelationSide | undefined) ?? 'bride',
      kind: (profile?.guestInfo?.relation?.kind as RelationKind | undefined) ?? 'family',
    });
    this.viewMode.set('edit');
  }

  protected cancelEdit(): void {
    this.viewMode.set('profile');
  }

  protected selectSide(side: RelationSide): void {
    this.editForm.controls.side.setValue(side);
  }

  protected selectKind(kind: RelationKind): void {
    this.editForm.controls.kind.setValue(kind);
  }

  /**
   * Saves firstName/lastName/relation via the real profile-update endpoint
   * (`EntityCollectionService.update` → `UserProfileDataService` →
   * `profileControllerUpdateProfileByIdV1`). Email/phone are intentionally
   * not editable here: `UpdateUserProfileDto` (the actual API contract) has
   * no fields for them, so this view shows them read-only instead of wiring
   * up form controls that could never be saved.
   */
  protected saveProfile(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const profile = this.guestProfile();
    if (!profile) return;

    const { firstName, lastName, side, kind } = this.editForm.getRawValue();
    const relation: CreateUserDtoGuestInfoRelation = {
      side,
      kind,
      link: profile.guestInfo?.relation?.link ?? '',
    };

    this.userProfileCollection
      .update({ id: profile.id, role: profile.role, firstName, lastName, guestInfo: { relation } })
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
