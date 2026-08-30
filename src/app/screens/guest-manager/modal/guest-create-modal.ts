import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  output,
  type Signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  EntityNamesEnum,
  UserProfileDto,
  CreateGuestDto,
  CreateGuestDtoRelation,
  GuestListResponseDtoItemsInnerRelationOneOf,
  WeddingGuestsService,
} from '@app/core';
import { Modal } from '@app/shared/modal/modal';
import { Btn } from '@app/shared/button/button';
import { TextInput } from '@app/shared/input/input';
import { DecorFish } from '@app/shared/decor/fish';
import { Toggle } from '@app/shared/toggle/toggle';
import { ProfileFields, type ProfileFieldsValue } from '@app/shared/profile-fields/profile-fields';
import type { RelationFieldsValue, RelationKind } from '@app/shared/relation-fields/relation-fields';

/** Generated enum, never a hand-copied `'bride' | 'groom' | 'both'` union
 *  (phase-U intro, hard rule 15) — `guest-profile-modal.ts`'s identical alias
 *  is dropped the same way in T311. */
const SIDE_ENUM = GuestListResponseDtoItemsInnerRelationOneOf.SideEnum;

/** A guest the new guest can be linked to, as the DS candidate list shows them
 *  (name + "side · group" meta). */
interface PartnerCandidate {
  id: string;
  name: string;
  side: GuestListResponseDtoItemsInnerRelationOneOf.SideEnum;
  kind: RelationKind;
}

/** E.164, mirroring `CreateGuestDto.phoneNumber` — the guest's sign-in identity. */
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

/** The family variant of `CreateGuestDtoRelation`, whose `link` is the closed
 *  relationship enum (the other variants take free text). */
type FamilyRelation = GuestListResponseDtoItemsInnerRelationOneOf;

/** Blank `app-profile-fields` draft — `open()`'s reset target, mirroring
 *  `createForm.reset()`'s own blank defaults. */
function blankProfileFieldsValue(): ProfileFieldsValue {
  return {
    firstName: '',
    lastName: '',
    nickname: '',
    email: '',
    phoneNumber: '',
    preferredLang: CreateGuestDto.PreferredLangEnum.EN,
    relation: { side: SIDE_ENUM.BRIDE, kind: 'family', link: '' },
  };
}

/**
 * Standalone "New guest" overlay (DS `ScreenGuestManager`/`ScreenGuestManagerMobile`
 * `addGuest()`), split out of `GuestProfileModal` — that component now only
 * ever shows an existing RSVP, so it no longer needs a nullable `rsvp` or a
 * third view mode to model a guest that doesn't exist yet.
 *
 * Creates exactly one guest **account** — it never writes an RSVP. The RSVP is
 * the guest's own answer (ADR-0022/0024: status is client-set by whoever
 * responds), so it comes into being when the guest replies, or when an admin
 * fills it in for them through `ManageRsvpModal`. A guest with no RSVP yet
 * lists under the guest manager's "undefined" filter.
 *
 * The DS partner section ("Link to the guest partner") is a switch over one
 * choice: a partner must already be on the guest list, so the section only ever
 * picks an existing guest. Adding a couple means creating each of the two
 * guests, then linking from the second.
 *
 * Creating and linking are two API calls, in that order: `POST /v1/guests`
 * makes the account, then `POST /v1/guests/{id}/partner/{partnerId}` links it —
 * `CreateGuestDto` has no partner field. So the link can fail on its own after
 * the guest already exists; `createdGuestId` records that, and pressing the
 * footer button again retries only the link instead of creating a duplicate.
 */
@Component({
  selector: 'app-guest-create-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    TranslatePipe,
    Modal,
    Btn,
    ReactiveFormsModule,
    TextInput,
    Toggle,
    DecorFish,
    ProfileFields,
  ],
  templateUrl: './guest-create-modal.html',
  styleUrl: './guest-create-modal.scss',
})
export class GuestCreateModal {
  readonly isOpen = signal(false);
  readonly closeModal = output<void>();
  /** Emits the new guest's user id once the account exists — after the partner
   *  link when one was asked for, but also when that link failed, since the
   *  guest is on the list either way. */
  readonly guestCreated = output<string>();

  /** Drives `<app-profile-fields>`'s `[value]` — kept in sync with `createForm`
   *  at this component's two write sites (`open()`'s reset,
   *  `onProfileFieldsChange()`'s patch) rather than derived from it, so the
   *  form's `Validators`/`invalid`/`markAllAsTouched()` gating (`createGuest()`)
   *  stays exactly as it was before this migration — this signal only feeds
   *  the child component's rendering. */
  protected readonly profileFieldsValue = signal<ProfileFieldsValue>(blankProfileFieldsValue());

  /** In-flight guard for the create chain — keeps the footer button disabled. */
  protected readonly saving = signal(false);
  protected readonly createFailed = signal(false);
  /** The guest exists but `POST .../partner/...` was refused — the form stays
   *  open on a link-only retry (see the class doc). */
  protected readonly partnerLinkFailed = signal(false);

  /** Set once `POST /v1/guests` has succeeded, so a retry after a failed
   *  partner link never creates a second account. */
  private readonly createdGuestId = signal<string | null>(null);

  private readonly fb = inject(NonNullableFormBuilder);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  /** Already loaded by `GuestManager` (the list this modal is opened from) —
   *  the "Existing guest" partner picker filters it client-side rather than
   *  fetching, since there is no guest-search endpoint. */
  private readonly userProfileList: Signal<UserProfileDto[]> = toSignal(
    this.userProfileCollection.entities$,
    { initialValue: [] },
  );

  /** Guests are their own resource (`/v1/guests`), and the partner link is a
   *  sub-resource route rather than a field — neither maps onto an @ngrx/data
   *  collection write, so both go straight through the generated client. */
  private readonly guestsApi = inject(WeddingGuestsService);

  /**
   * `phoneNumber` is required and E.164-shaped because it is the guest's
   * sign-in identity (ADR-0013: phone + SMS OTP) and `CreateGuestDto` requires
   * it; `email` is optional. The patterns mirror `CreateGuestDto`'s so the
   * form rejects what the API would reject.
   */
  protected readonly createForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    /** Optional, max 30 characters (T307's DS-widened cap) — clamped by
     *  `<app-profile-fields>` (T310) before it ever reaches
     *  `onProfileFieldsChange()`. */
    nickname: [''],
    phoneNumber: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    email: ['', Validators.email],
    side: this.fb.control<GuestListResponseDtoItemsInnerRelationOneOf.SideEnum>(SIDE_ENUM.BRIDE),
    kind: this.fb.control<RelationKind>('family'),
    preferredLang: this.fb.control<CreateGuestDto.PreferredLangEnum>(
      CreateGuestDto.PreferredLangEnum.EN,
    ),
    /**
     * A select value (a family `LinkEnum` member) when `kind === 'family'`,
     * free text otherwise — `createGuest()` shapes whichever
     * `CreateGuestDtoRelation` variant matches. Required because both API
     * variants require a non-empty `link`.
     */
    link: ['', Validators.required],

    /**
     * DS partner section. `linked` is the switch; the two controls under it
     * only exist while it is on — `syncPartnerControls()` disables them
     * otherwise, which is also what keeps `existingId`'s `required` out of
     * `createForm.invalid` (the footer button's guard) when no partner is being
     * linked. `search` never leaves the client: it only filters the candidate
     * list.
     */
    partner: this.fb.group({
      linked: this.fb.control(false),
      existingId: ['', Validators.required],
      search: [''],
    }),
  });

  private readonly partnerSearch = toSignal(
    this.createForm.controls.partner.controls.search.valueChanges,
    { initialValue: '' },
  );

  /** DS partner candidate list: guests only, minus anyone already paired (they
   *  have a partner, so linking a third person to them would contradict it),
   *  name-filtered, capped at the DS's 20 rows. */
  protected readonly partnerCandidates = computed<PartnerCandidate[]>(() => {
    const query = this.partnerSearch().trim().toLowerCase();
    const candidates: PartnerCandidate[] = [];

    for (const profile of this.userProfileList()) {
      const guestInfo = profile.role === 'guest' ? profile.guestInfo : undefined;
      if (!guestInfo || guestInfo.partner) continue;

      const name = `${profile.firstName} ${profile.lastName}`.trim();
      if (query && !name.toLowerCase().includes(query)) continue;

      candidates.push({
        id: profile.id,
        name,
        side: guestInfo.relation.side,
        // The generated union widens `kind` to `string`; the API only ever
        // emits the four `RelationKind` members.
        kind: guestInfo.relation.kind as RelationKind,
      });
      if (candidates.length === 20) break;
    }

    return candidates;
  });

  constructor() {
    this.syncPartnerControls();
  }

  /** Open the overlay on a blank "New guest" draft. */
  open(): void {
    this.createForm.reset();
    // `reset()` restores values, not the enabled/disabled state the previous
    // partner switch left behind.
    this.syncPartnerControls();
    this.profileFieldsValue.set(blankProfileFieldsValue());
    this.createFailed.set(false);
    this.partnerLinkFailed.set(false);
    this.createdGuestId.set(null);
    this.saving.set(false);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.closeModal.emit();
  }

  /** `<app-profile-fields>`'s `(valueChange)` — mirrors the emitted value
   *  onto the signal that feeds it back (so the child stays controlled) and
   *  onto `createForm`'s matching controls, so `createGuest()`'s existing
   *  `Validators`/`invalid`/`markAllAsTouched()` gating and `guestDraft()`'s
   *  `getRawValue()` read keep working unchanged. `relation` is always set —
   *  `showRelation` is on for this call site (see the class doc) — but the
   *  fallback keeps this assignment total rather than partial. */
  protected onProfileFieldsChange(value: ProfileFieldsValue): void {
    this.profileFieldsValue.set(value);

    const relation: RelationFieldsValue = value.relation ?? {
      side: SIDE_ENUM.BRIDE,
      kind: 'family',
      link: '',
    };

    this.createForm.patchValue({
      firstName: value.firstName,
      lastName: value.lastName,
      nickname: value.nickname,
      email: value.email,
      phoneNumber: value.phoneNumber,
      preferredLang: value.preferredLang,
      side: relation.side,
      kind: relation.kind,
      link: relation.link,
    });
  }

  /** The DS partner switch. Switching off drops the picker's state, so turning
   *  it back on starts from an empty search rather than the last one. */
  protected setPartnerLinked(linked: boolean): void {
    const partner = this.createForm.controls.partner;
    if (partner.controls.linked.value === linked) return;

    partner.controls.linked.setValue(linked);
    partner.controls.existingId.setValue('');
    partner.controls.search.setValue('');
    this.syncPartnerControls();
  }

  /** Candidate rows toggle: picking the selected one clears the link (DS). */
  protected selectCandidate(id: string): void {
    const existingId = this.createForm.controls.partner.controls.existingId;
    existingId.setValue(existingId.value === id ? '' : id);
  }

  protected isPartnerLinked(): boolean {
    return this.createForm.controls.partner.controls.linked.value;
  }

  protected isCandidateSelected(id: string): boolean {
    return this.createForm.controls.partner.controls.existingId.value === id;
  }

  /**
   * Enable the picker's controls only while the switch is on. Angular skips
   * disabled controls when computing validity, so this is what keeps a guest
   * with no partner from failing the form on `existingId`'s `required`.
   */
  private syncPartnerControls(): void {
    const { controls } = this.createForm.controls.partner;
    const linked = controls.linked.value;
    const opts = { emitEvent: false };

    if (linked) {
      controls.existingId.enable(opts);
      controls.search.enable(opts);
    } else {
      controls.existingId.disable(opts);
      controls.search.disable(opts);
    }
  }

  /** Modal title — the guest's name as it is typed (DS shows the name as the
   *  serif title, with "New guest · side · group" as the eyebrow above it).
   *  Empty until a name is entered, so the caller falls back to a placeholder. */
  protected guestDisplayName(): string {
    const { firstName, lastName } = this.createForm.getRawValue();
    return `${firstName} ${lastName}`.trim();
  }

  /**
   * Create the guest the DS "New guest" form describes, then link the partner
   * the switch picked — `POST /v1/guests` followed by
   * `POST /v1/guests/{id}/partner/{partnerId}`. No RSVP, and no second account:
   * the partner is a guest who already exists.
   *
   * The two calls fail independently. A create failure leaves nothing written,
   * so the admin fixes the details and presses again; a link failure (400 —
   * partner gone or not a guest, 409 — one of them linked meanwhile) leaves
   * the guest created, so pressing again retries only the link.
   */
  protected createGuest(): void {
    if (this.saving()) return;

    const createdId = this.createdGuestId();
    if (!createdId && this.createForm.invalid) {
      // TODO: show why the form is invalid
      console.warn('Guest create form invalid', this.createForm.invalid, this.createForm.errors);
      this.createForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.createFailed.set(false);
    this.partnerLinkFailed.set(false);

    // The guest already exists — this press is a retry of the link alone.
    if (createdId) {
      this.linkPartner(createdId);
      return;
    }

    this.guestsApi.guestsControllerCreateV1({ createGuestDto: this.guestDraft() }).subscribe({
      next: (guest) => {
        this.createdGuestId.set(guest.id);
        this.linkPartner(guest.id);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.createFailed.set(true);
        console.error('Failed to create guest', err);
      },
    });
  }

  /**
   * Second half of the create flow: point the new guest at the partner picked
   * in the DS partner section. `addPartner` (POST) is the right verb here —
   * both guests are unlinked by construction (the candidate list drops anyone
   * who already has a partner), so a 409 means the guest list moved under the
   * admin and replacing a stranger's link silently would be wrong.
   *
   * `guestCreated` is emitted on every outcome that leaves a guest behind,
   * including a failed link: the account is on the list either way, and the
   * parent needs to fetch its profile to render the row.
   */
  private linkPartner(guestId: string): void {
    const partner = this.createForm.controls.partner.getRawValue();
    const partnerId = partner.linked ? partner.existingId : '';

    if (!partnerId) {
      this.saving.set(false);
      this.guestCreated.emit(guestId);
      this.close();
      return;
    }

    this.guestsApi.guestsControllerAddPartnerV1({ id: guestId, partnerId }).subscribe({
      next: () => {
        this.saving.set(false);
        // The link points both ways, so the partner's cached profile is now
        // stale — and a stale one still looks free to `partnerCandidates`,
        // which would offer them for the next guest and earn a 409. The parent
        // refetches the new guest; only this component knows about the partner.
        this.userProfileCollection.getByKey(partnerId);
        this.guestCreated.emit(guestId);
        this.close();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.partnerLinkFailed.set(true);
        // The guest exists — surface it now so the list shows them unlinked
        // even if the admin gives up on the link and closes the modal.
        this.guestCreated.emit(guestId);
        console.error('Failed to link guest partner', err);
      },
    });
  }

  /** The form as `POST /v1/guests` takes it — identity, language and relation.
   *  The partner is not part of this payload; it is its own route. */
  private guestDraft(): CreateGuestDto {
    const { firstName, lastName, nickname, phoneNumber, email, side, kind, preferredLang, link } =
      this.createForm.getRawValue();

    // `CreateGuestDtoRelation` is a union: the family variant's `link` is the
    // strict `LinkEnum` (the `<select>` only ever assigns one of its members),
    // the other variants take free text.
    const relation: CreateGuestDtoRelation =
      kind === 'family'
        ? { side, kind, link: link as FamilyRelation['link'] }
        : { side, kind, link };

    return {
      firstName,
      lastName,
      nickname: nickname || undefined,
      phoneNumber,
      preferredLang,
      email: email || undefined,
      relation,
    };
  }
}
