import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  signal,
  computed,
  inject,
  output,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DataServiceError, EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  EntityNamesEnum,
  GuestDto,
  RsvpDto,
  RsvpDtoAdultsPartner1Options,
  UserProfileDto,
  UpdateUserProfileDto,
  CreateGuestDtoRelation,
  GuestListResponseDtoItemsInnerRelationOneOf,
  TranslateLanguageService,
  UserListResponseDtoItemsInnerDelegateToInner,
  WeddingGuestsService,
  lastSeenLabel as formatLastSeen,
  relationLinkLabel as formatRelationLink,
  todayInMadrid,
  partnerHasAccount,
} from '@app/core';
import { DelegateChip, DelegateChips } from '@app/shared/delegate-chips/delegate-chips';
import { Modal } from '@app/shared/modal/modal';
import { Btn } from '@app/shared/button/button';
import { DecorFish } from '@app/shared/decor/fish';
import { TextInput } from '@app/shared/input/input';
import { ProfileFields, ProfileFieldsValue } from '@app/shared/profile-fields/profile-fields';
import { RelationKind } from '@app/shared/relation-fields/relation-fields';

/** The four-value closed vocabulary a delegation `kind` is drawn from (hub
 *  ADR-0039 §4/§5) — reused verbatim from the generated client, never a
 *  hand-copied union (CLAUDE.md hard rule 15). One entry of `delegateTo[]`. */
type KindEnum = UserListResponseDtoItemsInnerDelegateToInner.KindEnum;
const KIND_ENUM = UserListResponseDtoItemsInnerDelegateToInner.KindEnum;
/** Fixed render order for the kind picker — no meaning beyond "a stable
 *  order", the enum itself carries no ranking. */
const KINDS: KindEnum[] = [KIND_ENUM.FATHER, KIND_ENUM.MOTHER, KIND_ENUM.BROTHER, KIND_ENUM.SISTER];

/** A guest eligible to be picked as a delegate — trimmed down from
 *  `UserProfileDto` to the two fields the search-and-pick list needs. */
interface DelegateCandidate {
  readonly id: string;
  readonly name: string;
}

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
  imports: [TranslatePipe, Modal, Btn, DecorFish, ProfileFields, DelegateChips, TextInput],
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

  private readonly guestCollection: EntityCollectionService<GuestDto> = inject(
    EntityServices,
  ).getEntityCollectionService<GuestDto>(EntityNamesEnum.GUEST);

  /**
   * Delegation (hub ADR-0039) writes through `PATCH /v1/guests/:id`, not
   * `/v1/profile` — `UpdateUserProfileDto` structurally has no `delegateTo`
   * field (grepped `src/app/core/api/model/`: absent), so it rides its own
   * envelope/`version`, fetched directly from `WeddingGuestsService` rather
   * than through an `@ngrx/data` collection (no `Guest` entity exists yet —
   * `guest-create-modal.ts` calls this same service the same way, for the
   * same reason).
   */
  // private readonly guestsApi = inject(WeddingGuestsService);

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

  // ── Delegation (hub ADR-0039, T335) ─────────────────────────────────────

  /**
   * The guest's own `GuestDto` — fetched separately from `guestProfile()`
   * (see `guestsApi`'s doc) purely for its `delegateTo`/`version`; every
   * other field on it is unused (the read-only view and the edit form both
   * keep reading `guestProfile()` for identity/relation/contact). `null`
   * before the fetch resolves or when it fails (`delegationError`).
   */
  protected readonly delegationDoc = signal<GuestDto | null>(null);
  protected readonly delegationLoading = signal(false);
  protected readonly delegationError = signal(false);
  /** Set while a delegation write is in flight — gates the Save button
   *  alongside the profile-fields write, same "one Save, two writes"
   *  shape as the class doc's grant flow. */
  protected readonly delegationSaving = signal(false);
  /** A delegation write failed (409 or otherwise) — shown next to the
   *  picker; a 409 also triggers a re-fetch (`fetchDelegationDoc`), same
   *  "re-read and say plainly what happened" pattern as `milestones.ts`. */
  protected readonly delegationSaveError = signal(false);

  /**
   * The draft grant/removal list, `null` outside edit mode. Accumulates
   * every pick/remove in memory; written by `saveProfile()`, discarded by
   * `cancelEdit()` — no separate confirmation (ADR-0039 §8).
   */
  protected readonly delegationDraft = signal<
    UserListResponseDtoItemsInnerDelegateToInner[] | null
  >(null);
  protected readonly delegationSearch = signal('');
  /** A candidate has been picked but has no `kind` yet — the mandatory
   *  second step (ADR-0039 §1/§12). Save is blocked while this is set. */
  protected readonly pendingPickId = signal<string | null>(null);
  /** Save was attempted while `pendingPickId()` was still set — drives the
   *  inline "choose who they are" hint (the required-kind gate, T335's own
   *  acceptance). */
  protected readonly delegationSaveBlocked = signal(false);

  protected readonly kinds = KINDS;

  /** Search-and-pick candidates: guests only, self excluded, already-picked
   *  excluded, empty until typed, capped at 8 (T335 acceptance). */
  protected readonly delegationCandidates = computed<DelegateCandidate[]>(() => {
    const query = this.delegationSearch().trim().toLowerCase();
    if (!query) return [];
    const selfId = this.userId();
    const picked = new Set((this.delegationDraft() ?? []).map((d) => d.id));
    const candidates: DelegateCandidate[] = [];
    for (const profile of this.userProfiles()) {
      if (profile.role !== 'guest' || profile.id === selfId || picked.has(profile.id)) continue;
      const name = `${profile.firstName} ${profile.lastName}`.trim();
      if (!name.toLowerCase().includes(query)) continue;
      candidates.push({ id: profile.id, name });
      if (candidates.length === 8) break;
    }
    return candidates;
  });

  protected readonly pendingPickName = computed<string>(() => {
    const id = this.pendingPickId();
    if (!id) return '';
    return this.nameFor(id);
  });

  /**
   * The rows `<app-delegate-chips>` renders — the live draft while editing,
   * else the last-fetched stored list. One computed for both call sites
   * (view mode, edit mode's current-chips row) so neither can drift from the
   * other (T335's "shares the display half" acceptance, mirrored by T336).
   */
  protected readonly delegateChips = computed<DelegateChip[]>(() => {
    const entries = this.delegationDraft() ?? this.delegationDoc()?.delegateTo ?? [];
    return entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      name: this.nameFor(entry.id),
    }));
  });

  private nameFor(id: string): string {
    const profile = this.userProfiles().find((p) => p.id === id);
    return profile
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : this.translate.instant('delegation.field.unknownGuest');
  }

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
   * `relation.link` is a catalog key for `family` (rendered through the
   * shared `relation.link.*` namespace, as `guest-create-modal` writes it)
   * and free text for every other kind — the split lives once, in the shared
   * `relationLinkLabel` helper.
   */
  protected readonly relationLinkLabel = computed<string | null>(() => {
    const relation = this.guestProfile()?.guestInfo?.relation;
    if (!relation?.link) return null;
    return formatRelationLink(relation, (key) => this.translate.instant(key));
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
    this.fetchDelegationDoc(userId);
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

  /**
   * Fetch the guest's `GuestDto` — the one source for `delegateTo` and the
   * `version` a grant/removal is optimistic-locked on (`UserProfileDto` has
   * neither, see `guestsApi`'s doc). Also the retry target on both the
   * picker's own error state and a 409 on save (re-read, per
   * `milestones.ts`'s established pattern).
   */
  protected fetchDelegationDoc(userId: string): void {
    this.delegationLoading.set(true);
    this.delegationError.set(false);
    this.guestCollection.getByKey(userId).subscribe({
      next: (doc) => {
        this.delegationDoc.set(doc);
        this.delegationLoading.set(false);
      },
      error: () => {
        this.delegationDoc.set(null);
        this.delegationLoading.set(false);
        this.delegationError.set(true);
      },
    });
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
    this.delegationDraft.set([...(this.delegationDoc()?.delegateTo ?? [])]);
    this.delegationSearch.set('');
    this.pendingPickId.set(null);
    this.delegationSaveBlocked.set(false);
    this.delegationSaveError.set(false);
    this.viewMode.set('edit');
  }

  protected cancelEdit(): void {
    this.viewMode.set('profile');
    this.delegationDraft.set(null);
    this.delegationSearch.set('');
    this.pendingPickId.set(null);
    this.delegationSaveBlocked.set(false);
  }

  // ── Delegation picker (hub ADR-0039 §12) ────────────────────────────────

  protected onDelegationSearch(query: string): void {
    this.delegationSearch.set(query);
  }

  /** Step 1: pick a name — this does **not** add the delegate yet, it opens
   *  the mandatory kind step (`chooseKind`) instead. */
  protected pickCandidate(id: string): void {
    this.pendingPickId.set(id);
    this.delegationSearch.set('');
    this.delegationSaveBlocked.set(false);
  }

  protected cancelPendingPick(): void {
    this.pendingPickId.set(null);
    this.delegationSaveBlocked.set(false);
  }

  /** Step 2: the required `kind` — committing it is what actually adds the
   *  entry to the draft (ADR-0039 §1: "you cannot create a delegation you
   *  cannot name"). */
  protected chooseKind(kind: KindEnum): void {
    const id = this.pendingPickId();
    if (!id) return;
    this.delegationDraft.update((list) => [...(list ?? []), { id, kind }]);
    this.pendingPickId.set(null);
    this.delegationSaveBlocked.set(false);
  }

  /** The kind `<select>`'s `(change)` — same "read the native element,
   *  forward the typed value" shape as `RelationFields.onLinkSelect`. */
  protected onKindSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as KindEnum;
    this.chooseKind(value);
  }

  protected removeDelegate(id: string): void {
    this.delegationDraft.update((list) => (list ?? []).filter((d) => d.id !== id));
  }

  /** The picker's own error-state retry — re-runs the same fetch `open()`
   *  triggers, against whichever guest is currently open. */
  protected retryDelegationFetch(): void {
    const userId = this.userId();
    if (userId) this.fetchDelegationDoc(userId);
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
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
    // The required-kind gate (T335 acceptance): a name picked in step 1 with
    // no `kind` chosen in step 2 blocks Save entirely — never silently
    // dropped, never saved without a kind (ADR-0039 §1/§5).
    if (this.pendingPickId()) {
      this.delegationSaveBlocked.set(true);
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
        ? {
            side: relation.side,
            kind: relation.kind,
            link: relation.link as FamilyRelation['link'],
          }
        : { side: relation.side, kind: relation.kind, link: relation.link };

    this.userProfileCollection
      .update({
        id: profile.id,
        firstName,
        lastName,
        nickname: nickname || undefined,
        guestInfo: { relation: relationPayload },
        delegateTo: draft.delegateTo,
      })
      .subscribe({
        // One Save, two writes (ADR-0039 §8: the grant rides the profile
        // save) — the delegation write only fires once the profile fields
        // have actually landed, so a profile-save failure never leaves a
        // delegation change written against a name/relation that didn't
        // save.
        next: () => this.saveDelegationIfChanged(),
        error: (err: unknown) => console.error('Failed to save profile', err),
      });
  }

  /**
   * The second write Save performs (see `saveProfile()`'s doc): a no-op,
   * closing the editor immediately, when nothing in `delegationDraft`
   * differs from what was loaded. Otherwise `PATCH /v1/guests/:id` with
   * only `id`/`version`/`delegateTo` — a partial patch, `UpdateGuestDto`'s
   * other fields all being optional (never re-sends `firstName`/`relation`/…,
   * which the profile write above just saved through its own endpoint).
   *
   * Writes directly off the already-loaded `delegationDoc()` rather than
   * re-fetching the guest first — `doc.id`/`doc.version` are exactly what
   * `startEdit()` seeded the draft from, and nothing in this modal re-reads
   * the guest in between (T360: an interim `getByKey()`-then-spread here was
   * a c3d8eb8-era regression that both widened the PATCH body to the whole
   * entity and, coincidentally, was never the reason the 409 path below
   * worked or didn't).
   */
  private saveDelegationIfChanged(): void {
    const doc = this.delegationDoc();
    const draft = this.delegationDraft();
    if (!doc || draft === null || !this.delegationChanged(doc.delegateTo ?? [], draft)) {
      this.delegationDraft.set(null);
      this.viewMode.set('profile');
      return;
    }

    this.delegationSaving.set(true);
    this.delegationSaveError.set(false);
    this.guestCollection.update({ id: doc.id, version: doc.version, delegateTo: draft }).subscribe({
      next: (updated) => {
        this.delegationDoc.set(updated);
        this.delegationDraft.set(null);
        this.delegationSaving.set(false);
        this.viewMode.set('profile');
      },
      error: (err: unknown) => {
        this.delegationSaving.set(false);
        this.delegationSaveError.set(true);
        // Someone else changed this guest first — re-read rather than
        // retrying blind against a `version` that no longer exists
        // (matches `milestones.ts`'s 409 handling). The editor stays
        // open so the couple can redo the grant against the fresh copy;
        // their in-progress draft is discarded along with it, same as a
        // stale form anywhere else in this modal.
        if (this.isConflict(err)) {
          this.delegationDraft.set(null);
          this.fetchDelegationDoc(doc.id);
        }
      },
    });
  }

  private delegationChanged(
    before: UserListResponseDtoItemsInnerDelegateToInner[],
    after: UserListResponseDtoItemsInnerDelegateToInner[],
  ): boolean {
    if (before.length !== after.length) return true;
    const key = (d: UserListResponseDtoItemsInnerDelegateToInner) => `${d.id}:${d.kind}`;
    const beforeKeys = new Set(before.map(key));
    return after.some((d) => !beforeKeys.has(key(d)));
  }

  /** For errors coming through @ngrx/data (`guestCollection.update()`),
   *  which wrap the underlying HTTP error as `DataServiceError.error` — same
   *  split as `milestones.ts`'s `isConflict()`/`httpStatus()` pair. (T360:
   *  this modal used to call the generated API client directly here, where
   *  the raw `HttpErrorResponse` needed no unwrapping; c3d8eb8 rewired the
   *  write onto `guestCollection` without updating this check, so the 409
   *  branch above was silently unreachable — `httpStatus(err)` was reading
   *  `.status` off a `DataServiceError`, which has none.) */
  private isConflict(error: unknown): boolean {
    return this.httpStatus((error as DataServiceError | undefined)?.error) === 409;
  }

  private httpStatus(error: unknown): number | undefined {
    return (error as HttpErrorResponse | undefined)?.status;
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
