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
import { map } from 'rxjs';

import {
  EntityNamesEnum,
  UserProfileDto,
  CreateUserDto,
  CreateUserDtoGuestInfoRelation,
  CreateUserDtoGuestInfoRelationOneOf,
  UserDto,
} from '@app/core';
import { langDescription } from '@app/model';
import { Modal } from '@app/shared/modal/modal';
import { Btn } from '@app/shared/button/button';
import { TextInput } from '@app/shared/input/input';
import { DecorFish } from '@app/shared/decor/fish';
import { Toggle } from '@app/shared/toggle/toggle';
import { GuestSeg } from './guest-seg/guest-seg';

type RelationSide = 'bride' | 'groom' | 'both';
type RelationKind = 'family' | 'friends' | 'colleagues' | 'other';

/** A guest the new guest can be linked to, as the DS candidate list shows them
 *  (name + "side · group" meta). */
interface PartnerCandidate {
  id: string;
  name: string;
  side: RelationSide;
  kind: RelationKind;
}

/** E.164, mirroring `CreateUserDto.phoneNumber` — the guest's sign-in identity. */
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/;

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
 * picks an existing guest and stores them as `guestInfo.partnerId`. Adding a
 * couple means creating each of the two guests, then linking from the second.
 */
@Component({
  selector: 'app-guest-create-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslatePipe, Modal, Btn, ReactiveFormsModule, TextInput, GuestSeg, Toggle, DecorFish],
  templateUrl: './guest-create-modal.html',
  styleUrl: './guest-create-modal.scss',
})
export class GuestCreateModal {
  readonly isOpen = signal(false);
  readonly closeModal = output<void>();
  /** Emits the new guest's user id once their account and partner link exist. */
  readonly guestCreated = output<string>();

  protected readonly relationSides: RelationSide[] = ['bride', 'groom', 'both'];
  protected readonly relationKinds: RelationKind[] = ['family', 'friends', 'colleagues', 'other'];

  /**
   * DS `LANG_OPTS` order (English, Español, Français) — 'en' first since it is
   * this app's actual default (`provideTranslateService({ lang: 'en' })` in
   * `app.config.ts`, also `TranslateLanguageService`'s browser-detect fallback
   * and `<html lang="en">`), not the 'es' the DS mock happens to default to.
   */
  protected readonly preferredLangs: CreateUserDto.PreferredLangEnum[] = [
    CreateUserDto.PreferredLangEnum.EN,
    CreateUserDto.PreferredLangEnum.ES,
    CreateUserDto.PreferredLangEnum.FR,
  ];

  /** Native language names (DS `LANG_OPTS`) — not translated: a language's own
   *  name doesn't change with the admin's UI language. */
  protected readonly langDescription = langDescription;

  /** Full API enum (`CreateUserDtoGuestInfoRelationOneOf.LinkEnum`) — richer
   *  than the DS mock's shortened `FAMILY_RELATIONS` list. */
  protected readonly familyRelations: CreateUserDtoGuestInfoRelationOneOf.LinkEnum[] =
    Object.values(CreateUserDtoGuestInfoRelationOneOf.LinkEnum);

  /** In-flight guard for the create chain — keeps the footer button disabled. */
  protected readonly saving = signal(false);
  protected readonly createFailed = signal(false);

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

  private readonly userCollection: EntityCollectionService<UserDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserDto>(EntityNamesEnum.USER);

  /**
   * `phoneNumber` is required and E.164-shaped because it is the guest's
   * sign-in identity (ADR-0013: phone + SMS OTP) and `CreateUserDto` requires
   * it; `email` is optional. The patterns mirror `CreateUserDto`'s so the
   * form rejects what the API would reject.
   */
  protected readonly createForm = this.fb.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    phoneNumber: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    email: ['', Validators.email],
    side: this.fb.control<RelationSide>('bride'),
    kind: this.fb.control<RelationKind>('family'),
    preferredLang: this.fb.control<CreateUserDto.PreferredLangEnum>(
      CreateUserDto.PreferredLangEnum.EN,
    ),
    /**
     * A select value (`CreateUserDtoGuestInfoRelationOneOf.LinkEnum` member)
     * when `kind === 'family'`, free text otherwise — `createGuest()` shapes
     * whichever `CreateUserDtoGuestInfoRelation` variant matches. Required
     * because both API variants require a non-empty `link`.
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
    // The previous `link` (a family-relation enum member, or free text for a
    // different kind) no longer matches the new kind's field shape — DS's
    // `setGroup` clears it the same way.
    this.createForm.controls.link.setValue('');
  }

  protected selectPreferredLang(lang: CreateUserDto.PreferredLangEnum): void {
    this.createForm.controls.preferredLang.setValue(lang);
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

  /** i18n key for the free-text relation-link placeholder — copy adapts per
   *  non-family `kind` (DS: "Worked together at Novatek" for colleagues,
   *  "Childhood friend from Girona" for friends). */
  protected linkPlaceholderKey(): string {
    return `guest_manager.form.linkPlaceholder.${this.createForm.controls.kind.value}`;
  }

  /** Modal title — the guest's name as it is typed (DS shows the name as the
   *  serif title, with "New guest · side · group" as the eyebrow above it).
   *  Empty until a name is entered, so the caller falls back to a placeholder. */
  protected guestDisplayName(): string {
    const { firstName, lastName } = this.createForm.getRawValue();
    return `${firstName} ${lastName}`.trim();
  }

  /**
   * Create the guest the DS "New guest" form describes: one `POST /v1/users`
   * carrying `guestInfo` (`relation`, plus `partnerId` when the partner switch
   * picked an existing guest). No RSVP, and no second account — the partner is
   * a guest who already exists.
   *
   * `partnerId` has to ride along on the create: neither `PATCH /v1/users` nor
   * `PATCH /v1/profile/{id}` accepts it. On failure the form stays open with
   * nothing written, so the admin can fix the details and retry.
   */
  protected createGuest(): void {
    if (this.saving()) return;
    if (this.createForm.invalid) {
      // TODO: show why the form is invalid
      console.warn('Guest create form invalid', this.createForm.invalid, this.createForm.errors);
      this.createForm.markAllAsTouched();
      return;
    }

    const { firstName, lastName, phoneNumber, email, side, kind, preferredLang, link } =
      this.createForm.getRawValue();
    this.saving.set(true);
    this.createFailed.set(false);

    // `CreateUserDtoGuestInfoRelation` is a union: the family variant's `link`
    // is the strict `LinkEnum` (the `<select>` only ever assigns one of its
    // members), the other variants take free text.
    const relation: CreateUserDtoGuestInfoRelation =
      kind === 'family'
        ? { side, kind, link: link as CreateUserDtoGuestInfoRelationOneOf.LinkEnum }
        : { side, kind, link };

    const partner = this.createForm.controls.partner.getRawValue();
    const partnerId = partner.linked ? partner.existingId : undefined;

    // The add is pessimistic: @ngrx/data's optimistic default would insert the
    // draft (whose `id` is still the empty server-assigned placeholder) into
    // the collection and leave it there once the real entity arrives under its
    // own id. Nothing is shown until the create succeeds anyway.
    this.userCollection
      .add(
        this.guestDraft(
          { firstName, lastName, phoneNumber, email, preferredLang },
          { relation, partnerId },
        ),
        { isOptimistic: false },
      )
      .pipe(map((user) => user.id))
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
   * A guest account for `POST /v1/users`.
   *
   * Only the new guest points at the partner; the partner does not point back,
   * because `partnerId` is create-only and can no longer be set on the guest
   * who already exists. The pair is resolved through this one link.
   */
  private guestDraft(
    identity: {
      firstName: string;
      lastName: string;
      phoneNumber: string;
      email: string;
      preferredLang: CreateUserDto.PreferredLangEnum;
    },
    guestInfo: { relation: CreateUserDtoGuestInfoRelation; partnerId?: string },
  ): CreateUserDto {
    return {
      role: 'guest',
      firstName: identity.firstName,
      lastName: identity.lastName,
      phoneNumber: identity.phoneNumber,
      preferredLang: identity.preferredLang,
      email: identity.email || undefined,
      guestInfo,
    };
  }
}
