import { ChangeDetectionStrategy, Component, signal, inject, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { map, switchMap } from 'rxjs';

import {
  EntityNamesEnum,
  RsvpDto,
  UserProfileDto,
  CreateUserDtoGuestInfoRelation,
  UserDto,
} from '@app/core';
import { Modal } from '@app/shared/modal/modal';
import { Btn } from '@app/shared/button/button';
import { TextInput } from '@app/shared/input/input';
import { ChoiceCard } from '@app/shared/choice-card/choice-card';
import { DecorFish } from '@app/shared/decor/fish';

type RelationSide = 'bride' | 'groom';
type RelationKind = 'family' | 'friends' | 'colleagues' | 'other';

/**
 * Standalone "New guest" overlay (DS `ScreenGuestManager`/`ScreenGuestManagerMobile`
 * `addGuest()`), split out of `RsvpDetailsModal` — that component now only
 * ever shows an existing RSVP, so it no longer needs a nullable `rsvp` or a
 * third view mode to model a guest that doesn't exist yet.
 */
@Component({
  selector: 'app-guest-create-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslatePipe, Modal, Btn, ReactiveFormsModule, TextInput, ChoiceCard, DecorFish],
  templateUrl: './guest-create-modal.html',
  styleUrl: './guest-create-modal.scss',
})
export class GuestCreateModal {
  readonly isOpen = signal(false);
  readonly closeModal = output<void>();
  /** Emits the new guest's user id once account + profile + RSVP all exist. */
  readonly guestCreated = output<string>();

  protected readonly relationKinds: RelationKind[] = ['family', 'friends', 'colleagues', 'other'];

  /** In-flight guard for the create chain — keeps the footer button disabled. */
  protected readonly saving = signal(false);
  protected readonly createFailed = signal(false);

  private readonly fb = inject(NonNullableFormBuilder);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  private readonly userCollection: EntityCollectionService<UserDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserDto>(EntityNamesEnum.USER);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  /**
   * `phoneNumber` is required and E.164-shaped because it is the guest's
   * sign-in identity (ADR-0013: phone + SMS OTP) and `CreateUserDto` requires
   * it; `email` is optional. The patterns mirror `CreateUserDto`'s so the
   * form rejects what the API would reject.
   */
  protected readonly createForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+[1-9]\d{6,14}$/)]],
    email: ['', Validators.email],
    side: this.fb.control<RelationSide>('bride'),
    kind: this.fb.control<RelationKind>('family'),
  });

  /** Open the overlay on a blank "New guest" draft. */
  open(): void {
    this.createForm.reset();
    this.createFailed.set(false);
    this.saving.set(false);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.closeModal.emit();
  }

  protected selectSide(side: RelationSide): void {
    this.createForm.controls.side.setValue(side);
  }

  protected selectKind(kind: RelationKind): void {
    this.createForm.controls.kind.setValue(kind);
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
    const draft: UserDto = {
      id: '',
      version: 1,
      role: 'guest',
      firstName,
      lastName,
      phoneNumber,
      preferredLang: 'es',
      email: email || undefined,
    };
    const relation: CreateUserDtoGuestInfoRelation = { side, kind, link: '' };

    // Both adds are pessimistic: @ngrx/data's optimistic default would insert
    // `draft` (whose `id` is still the empty server-assigned placeholder) into
    // the User collection and leave it there once the real entity arrives under
    // its own id. Nothing is shown until all three calls succeed anyway.
    this.userCollection
      .add(draft, { isOptimistic: false })
      .pipe(
        switchMap((user) =>
          this.userProfileCollection
            .update({ id: user.id, role: 'guest', firstName, lastName, guestInfo: { relation } })
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
  private blankRsvp(user: UserDto): RsvpDto {
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
}
