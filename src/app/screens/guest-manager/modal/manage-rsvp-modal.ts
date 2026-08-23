import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { EntityCollectionService, EntityServices } from '@ngrx/data';

import {
  EMPTY_RSVP_DRAFT,
  EntityNamesEnum,
  PluralTranslatePipe,
  RsvpDraft,
  RsvpDto,
  UserProfileDto,
  fromRsvpDraft,
  toRsvpDraft,
  unnamedAdultCount,
} from '@app/core';
import { Modal } from '@app/shared/modal/modal';
import { Btn } from '@app/shared/button/button';
import { DecorFish } from '@app/shared/decor/fish';
import { RsvpEditor } from '@app/shared/rsvp-editor/rsvp-editor';

/**
 * Manage-RSVP overlay — the couple's editor for a guest's reply (DS
 * `ScreenGuestManager.jsx` / `ScreenGuestManagerMobile.jsx`, the `draft != null`
 * branch of the profile overlay). One responsive modal covers both DS screens.
 *
 * The editable body is the shared `app-rsvp-editor` in its `couple`
 * perspective (in-repo ADR W-0003): attendance answer (`showStatus`),
 * accordion participant cards with diet/allergy chips and free-text allergy
 * entries, add/remove, and the note — read-only here (`noteReadonly`), because
 * the couple must never overwrite words a guest wrote to them. This modal
 * keeps only the chrome: header, footer, the draft it owns, and the write.
 *
 * Opened from `app-guest-profile-modal`'s summary card or its "Manage RSVP"
 * button; "Back" returns there (the parent swaps the two overlays). Writes go
 * through the same `PATCH /v1/rsvp/{id}` the guest's own `app-rsvp-edit`
 * screen uses, sharing its draft mapping (`core/helper/rsvp-draft`).
 */
@Component({
  selector: 'app-manage-rsvp-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslatePipe, PluralTranslatePipe, Modal, Btn, DecorFish, RsvpEditor],
  templateUrl: './manage-rsvp-modal.html',
  styleUrl: './manage-rsvp-modal.scss',
})
export class ManageRsvpModal {
  readonly isOpen = signal(false);
  /** "Back" — emits the guest's user id so the parent can reopen the profile. */
  readonly back = output<string>();
  readonly closeModal = output<void>();
  /** A successful save — emits the guest's user id so the list row can refresh. */
  readonly rsvpSaved = output<string>();
  /**
   * "Open their profile" on a partner whose name is locked to their own guest
   * account (T269) — emits *that partner's* user id, not the primary guest's,
   * so the parent can swap this overlay for `app-guest-profile-modal` on them.
   */
  readonly openProfile = output<string>();

  private readonly translate = inject(TranslateService);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  private readonly userProfileCollection: EntityCollectionService<UserProfileDto> = inject(
    EntityServices,
  ).getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE);

  /** Set by `open(userId)` — the RSVP's `id` equals its primary guest's user id. */
  private readonly userId = signal<string | null>(null);

  protected readonly draft = signal<RsvpDraft>(EMPTY_RSVP_DRAFT);
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);

  private readonly rsvps = toSignal(this.rsvpCollection.entities$, {
    initialValue: [] as RsvpDto[],
  });

  /** Read-only lookup into the profiles `guest-manager.ts` already bulk-loads. */
  private readonly userProfiles = toSignal(this.userProfileCollection.entities$, {
    initialValue: [] as UserProfileDto[],
  });

  protected readonly rsvp = computed<RsvpDto | null>(() => {
    const userId = this.userId();
    if (!userId) return null;
    return this.rsvps().find((r) => r.id === userId) ?? null;
  });

  /**
   * Everyone still owed a first and last name — the same gate the guest's own
   * screen uses (ADR W-0003 §Decision.7). A partner who has their own guest
   * account is excluded: their name is read-only here, so blocking on it would
   * be a gate nobody can satisfy.
   */
  protected readonly unnamedCount = computed(() => unnamedAdultCount(this.draft()));

  protected readonly guestFullName = computed(() => {
    const userId = this.userId();
    const profile = userId ? this.userProfiles().find((p) => p.id === userId) : undefined;
    if (profile) return `${profile.firstName} ${profile.lastName}`.trim();
    const d = this.draft();
    return `${d.partner1.firstName} ${d.partner1.lastName}`.trim();
  });

  protected readonly modalTitle = computed(
    () => this.guestFullName() || this.translate.instant('guest_manager.modal.guestPlaceholder'),
  );

  constructor() {
    // `open()` sets `userId` before the fetch resolves, so the draft can't be
    // seeded synchronously there — resync it whenever the RSVP lands (and
    // again after a save round-trips through the cache).
    effect(() => {
      const rsvp = this.rsvp();
      this.draft.set(rsvp ? toRsvpDraft(rsvp) : EMPTY_RSVP_DRAFT);
      this.saveFailed.set(false);
    });
  }

  /**
   * Open the editor for this guest. Only reachable from a profile whose RSVP
   * already loaded, so the record is in the cache; refetch it anyway so the
   * `version` this editor sends back is the freshest one (the write is
   * optimistic-locked on it).
   */
  open(userId: string): void {
    this.userId.set(userId);
    this.rsvpCollection.getByKey(userId);
    this.saveFailed.set(false);
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
    this.closeModal.emit();
  }

  /** "Back" — hand the guest back to `app-guest-profile-modal`. */
  protected goBack(): void {
    const userId = this.userId();
    this.isOpen.set(false);
    if (userId) this.back.emit(userId);
  }

  /** The editor is controlled: it never mutates, it hands back a fresh draft. */
  protected onDraftChange(draft: RsvpDraft): void {
    this.draft.set(draft);
  }

  /**
   * The couple followed a linked partner's name to that partner's own profile.
   * Unsaved edits are **discarded**, deliberately and exactly as the "Back"
   * button beside it already discards them: this is the same overlay swap, and
   * the alternative — blocking the jump while the draft is dirty — would need
   * a disabled state nobody can explain without new copy. The draft is reset
   * from the cached record here so the discard is real rather than incidental
   * on the next `open()` refetch.
   */
  protected onOpenProfile(partnerUserId: string): void {
    const rsvp = this.rsvp();
    this.draft.set(rsvp ? toRsvpDraft(rsvp) : EMPTY_RSVP_DRAFT);
    this.isOpen.set(false);
    this.openProfile.emit(partnerUserId);
  }

  protected async save(): Promise<void> {
    const userId = this.userId();
    if (!userId || !this.rsvp() || this.saving() || this.unnamedCount() > 0) return;
    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      // `EntityCollectionService.update()` takes a flat `Partial<T>` (must
      // include `id`) — `RsvpDataService.update()` wraps it as `{ id, changes }`
      // before calling the API.
      await firstValueFrom(this.rsvpCollection.update({ id: userId, ...fromRsvpDraft(this.draft()) }));
      this.rsvpSaved.emit(userId);
      this.close();
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
