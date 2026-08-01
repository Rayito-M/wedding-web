import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  OnInit,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { map, switchMap } from 'rxjs';

import {
  EntityNamesEnum,
  RsvpDto,
  RsvpDtoAdultsPartner1Options,
  UserProfileDto,
  UserProfileDtoRelation,
  UserResponseDto,
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
export class RsvpDetailsModal implements OnInit {
  readonly rsvp = signal<RsvpDto | null>(null);
  readonly isOpen = signal(false);
  readonly closeModal = output<void>();
  readonly saveComments = output<{ rsvpId: string; comments: string }>();
  /** Emits the new guest's user id once account + profile + RSVP all exist. */
  readonly guestCreated = output<string>();

  protected readonly relationKinds: RelationKind[] = ['family', 'friends', 'colleagues', 'other'];

  /**
   * `'profile'` — read-only guest info + RSVP summary; `'edit'` — profile-edit
   * form; `'create'` — the DS "New guest" form (`ScreenGuestManager` opens the
   * same overlay with a blank draft and a "Create guest" footer).
   */
  protected readonly viewMode = signal<'profile' | 'edit' | 'create'>('profile');

  /** In-flight guard for the create chain — keeps the footer button disabled. */
  protected readonly saving = signal(false);
  protected readonly createFailed = signal(false);

  private readonly commentsText = signal('');
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly translate = inject(TranslateService);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  private readonly userCollection: EntityCollectionService<UserResponseDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserResponseDto>(EntityNamesEnum.USER);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  /**
   * Read-only lookup into the profiles `guest-manager.ts` already fetches
   * (its constructor `effect()` calls `getByKey` for every RSVP's partners) —
   * this modal never dispatches its own fetch, it only reads the shared cache.
   */
  private readonly userProfiles = toSignal(this.userProfileCollection.entities$, {
    initialValue: [] as UserProfileDto[],
  });

  /** Profile of the RSVP's primary guest (`adults.partner1`). */
  protected readonly partner1Profile = computed<UserProfileDto | undefined>(() => {
    const rsvp = this.rsvp();
    if (!rsvp) return undefined;
    return this.userProfiles().find((p) => p.id === rsvp.adults.partner1.id);
  });

  protected readonly editForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    side: this.fb.control<RelationSide>('bride'),
    kind: this.fb.control<RelationKind>('family'),
  });

  /**
   * "New guest" form. `phoneNumber` is required and E.164-shaped because it is
   * the guest's sign-in identity (ADR-0013: phone + SMS OTP) and `CreateUserDto`
   * requires it; `email` is optional. The patterns mirror `CreateUserDto`'s so
   * the form rejects what the API would reject.
   */
  protected readonly createForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+[1-9]\d{6,14}$/)]],
    email: ['', Validators.email],
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
    if (this.viewMode() === 'create') {
      return this.translate.instant('guest_manager.modal.newGuest');
    }
    const rsvp = this.rsvp();
    if (!rsvp) return '';
    return this.viewMode() === 'edit'
      ? this.translate.instant('guest_manager.modal.editProfile')
      : this.guestFullName(rsvp);
  });

  ngOnInit(): void {
    // Initialize comments from RSVP when modal opens
    const currentRsvp = this.rsvp();
    if (currentRsvp?.adults.partner1.options?.comments) {
      this.commentsText.set(currentRsvp.adults.partner1.options.comments);
    }
  }

  open(rsvp: RsvpDto): void {
    this.rsvp.set(rsvp);
    this.commentsText.set(rsvp.adults.partner1.options?.comments || '');
    this.viewMode.set('profile');
    this.isOpen.set(true);
  }

  /** Open the overlay on a blank "New guest" draft (DS `addGuest`). */
  openNew(): void {
    this.rsvp.set(null);
    this.createForm.reset();
    this.createFailed.set(false);
    this.saving.set(false);
    this.viewMode.set('create');
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
      side: (profile?.relation?.side as RelationSide | undefined) ?? 'bride',
      kind: (profile?.relation?.kind as RelationKind | undefined) ?? 'family',
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
    const relation: UserProfileDtoRelation = {
      side,
      kind,
      link: profile.relation?.link ?? '',
    };

    this.userProfileCollection
      .update({ id: profile.id, role: profile.role, firstName, lastName, relation })
      .subscribe({
        next: () => this.viewMode.set('profile'),
        error: (err: unknown) => console.error('Failed to save profile', err),
      });
  }

  /**
   * Create the guest the DS "New guest" form describes. The API splits that
   * single form across three calls, so they run in sequence:
   *
   * 1. `POST /v1/users` — the account (identity: names, phone, optional email).
   * 2. `PATCH /v1/profile/{id}` — `relation` (side · group); `CreateUserDto`
   *    has no field for it, and it is what the guest list groups on.
   * 3. `POST /v1/rsvp/{id}` — the `pending` RSVP. The guest manager lists
   *    RSVPs, so without this the new guest would not show up until they
   *    signed in themselves. Admin-initiated creation is allowed here.
   *
   * A failure part-way leaves the earlier steps applied (there is no
   * transaction across these endpoints); the guest is reported as not created
   * and the form stays open so the admin can retry.
   */
  protected createGuest(): void {
    if (this.saving()) return;
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const { firstName, lastName, phoneNumber, email, side, kind } = this.createForm.getRawValue();
    this.saving.set(true);
    this.createFailed.set(false);

    // `id`/`version` are server-assigned — `UserDataService.add()` ignores both.
    const draft: UserResponseDto = {
      id: '',
      version: 1,
      firstName,
      lastName,
      phoneNumber,
      email: email || undefined,
    };
    const relation: UserProfileDtoRelation = { side, kind, link: '' };

    // Both adds are pessimistic: @ngrx/data's optimistic default would insert
    // `draft` (whose `id` is still the empty server-assigned placeholder) into
    // the User collection and leave it there once the real entity arrives under
    // its own id. Nothing is shown until all three calls succeed anyway.
    this.userCollection
      .add(draft, { isOptimistic: false })
      .pipe(
        switchMap((user) =>
          this.userProfileCollection
            .update({ id: user.id, role: 'guest', firstName, lastName, relation })
            .pipe(map(() => user)),
        ),
        switchMap((user) =>
          this.rsvpCollection
            .add(this.blankRsvp(user), { isOptimistic: false })
            .pipe(map(() => user.id)),
        ),
      )
      .subscribe({
        next: (userId) => {
          this.saving.set(false);
          this.guestCreated.emit(userId);
          this.close();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.createFailed.set(true);
          console.error('Failed to create guest', err);
        },
      });
  }

  /**
   * Minimal RSVP skeleton for `RsvpDataService.add()`, which only reads `id`
   * (the guest the record is created for), `status`, `adults.partner2` and
   * `children` — the server owns every other field.
   */
  private blankRsvp(user: UserResponseDto): RsvpDto {
    return {
      id: user.id,
      version: 1,
      createdAt: '',
      updatedAt: '',
      status: 'pending',
      adults: { partner1: { id: user.id, firstName: user.firstName, lastName: user.lastName } },
      children: [],
      submittedBy: '',
    };
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
