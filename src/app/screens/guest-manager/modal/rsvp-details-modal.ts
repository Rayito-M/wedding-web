import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  effect,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  EntityNamesEnum,
  RsvpDto,
  RsvpDtoAdultsPartner1Options,
  UserProfileDto,
  ImportUserDtoGuestsInnerAnyOfRelation,
} from '@app/core';
import { Modal } from '@app/shared/modal/modal';
import { Btn } from '@app/shared/button/button';
import { TextInput } from '@app/shared/input/input';
import { ChoiceCard } from '@app/shared/choice-card/choice-card';
import { DecorFish } from '@app/shared/decor/fish';

type RelationSide = 'bride' | 'groom';
type RelationKind = 'family' | 'friends' | 'colleagues' | 'other';

@Component({
  selector: 'app-rsvp-details-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslatePipe, Modal, Btn, ReactiveFormsModule, TextInput, ChoiceCard, DecorFish],
  templateUrl: './rsvp-details-modal.html',
  styleUrl: './rsvp-details-modal.scss',
})
export class RsvpDetailsModal {
  readonly isOpen = signal(false);
  readonly closeModal = output<void>();
  readonly saveComments = output<{ rsvpId: string; comments: string }>();

  protected readonly relationKinds: RelationKind[] = ['family', 'friends', 'colleagues', 'other'];

  /** `'profile'` — read-only guest info + RSVP summary; `'edit'` — profile-edit form. */
  protected readonly viewMode = signal<'profile' | 'edit'>('profile');

  /** Set by `open(userId)` — the RSVP's `id` equals its primary guest's user id. */
  private readonly userId = signal<string | null>(null);
  private readonly commentsText = signal('');
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
   */
  private readonly rsvps = toSignal(this.rsvpCollection.entities$, {
    initialValue: [] as RsvpDto[],
  });

  protected readonly rsvp = computed<RsvpDto | null>(() => {
    const userId = this.userId();
    if (!userId) return null;
    return this.rsvps().find((r) => r.id === userId) ?? null;
  });

  /** Profile of the RSVP's primary guest — shares its id with the RSVP itself. */
  protected readonly partner1Profile = computed<UserProfileDto | undefined>(() => {
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

  protected readonly modalTitle = computed(() => {
    const rsvp = this.rsvp();
    if (!rsvp) return '';
    return this.viewMode() === 'edit'
      ? this.translate.instant('guest_manager.modal.editProfile')
      : this.guestFullName(rsvp);
  });

  constructor() {
    // `open()` sets `userId` before the fetch resolves, so the comments draft
    // can't be seeded synchronously there — sync it whenever the RSVP lands.
    effect(() => {
      this.commentsText.set(this.rsvp()?.adults.partner1.options?.comments ?? '');
    });
  }

  /** Open the overlay for this guest and fetch their RSVP fresh. */
  open(userId: string): void {
    this.userId.set(userId);
    this.rsvpCollection.getByKey(userId);
    this.viewMode.set('profile');
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.viewMode.set('profile');
    this.closeModal.emit();
  }

  onSave(): void {
    const currentRsvp = this.rsvp();
    if (currentRsvp) {
      this.saveComments.emit({
        rsvpId: currentRsvp.id,
        comments: this.commentsText(),
      });
    }
    this.close();
  }

  getCommentsText(): string {
    return this.commentsText();
  }

  updateComments(text: string): void {
    this.commentsText.set(text);
  }

  /** Full name used as the modal title. */
  guestFullName(rsvp: RsvpDto): string {
    return `${rsvp.adults.partner1.firstName} ${rsvp.adults.partner1.lastName}`;
  }

  /** Enter the profile-edit view, seeded from the currently loaded profile. */
  protected startEdit(): void {
    const profile = this.partner1Profile();
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
    const profile = this.partner1Profile();
    if (!profile) return;

    const { firstName, lastName, side, kind } = this.editForm.getRawValue();
    const relation: ImportUserDtoGuestsInnerAnyOfRelation = {
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
