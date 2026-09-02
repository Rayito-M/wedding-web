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
import { firstValueFrom } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  EMPTY_RSVP_DRAFT,
  EntityNamesEnum,
  ProfileModalService,
  RsvpDraft,
  RsvpDto,
  PluralTranslatePipe,
  fromRsvpDraft,
  toRsvpDraft,
  unnamedAdultCount,
} from '@app/core';
import { Btn } from '@app/shared/button/button';
import { RsvpEditor } from '@app/shared/rsvp-editor/rsvp-editor';

/**
 * The chrome a delegate sees around the shared `app-rsvp-editor` when acting
 * on a subject's RSVP (hub ADR-0039 §6, T337) — the delegate hub's "open a
 * card" destination. Mirrors `app-rsvp-edit`'s own chrome (header, footer,
 * save wiring, the desktop card wrapper) rather than reusing that component
 * directly: `app-rsvp-edit` is the *guest's own* screen (`ProfileModalService`
 * routing, `EMPTY_RSVP_DRAFT`-seeded header text, first-person copy) and
 * folding a second "whose RSVP is this" branch into it risks the exact thing
 * T337 must not touch — the zero-delegation guest screen staying
 * byte-for-byte what it is today (this component is never mounted then).
 * `app-manage-rsvp-modal` set the same precedent for the couple's own outer
 * chrome around this same shared editor.
 *
 * Perspective is always `delegate` (third-person copy, `rsvp.editor
 * .perspective.delegate.*`) — never `owner`, per this task's acceptance.
 * `statusPending` is on: a delegate may be opening a subject who has not
 * answered yet at all. `noteReadonly` is on for the same reason `app-manage
 * -rsvp-modal` sets it: a delegate must never overwrite words the subject
 * wrote in their own name.
 *
 * The RSVP deadline blocks a delegate's write like any non-admin (410) —
 * this component surfaces that exactly the way `app-rsvp-edit` surfaces any
 * save failure: the generic `saveFailed` message, no special-cased copy
 * (neither screen distinguishes a 410 from any other error today).
 */
@Component({
  selector: 'app-delegate-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Btn, RsvpEditor, TranslatePipe, PluralTranslatePipe],
  templateUrl: './delegate-edit.html',
  styleUrl: './delegate-edit.scss',
})
export class DelegateEdit {
  private readonly translateService = inject(TranslateService);
  private readonly profileModal = inject(ProfileModalService);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  /** The subject's RSVP — one of `Rsvp.delegatedRsvps()`'s entries. */
  readonly rsvp = input.required<RsvpDto>();
  /** The subject's party label, exactly what the hub card already showed
   *  (ADR-0039 §7's party label, from the RSVP's own adults) — reused here
   *  rather than re-derived, so the header can never read a different name
   *  than the card the guest just tapped. */
  readonly subjectName = input.required<string>();

  readonly back = output<void>();

  protected readonly draft = signal<RsvpDraft>(EMPTY_RSVP_DRAFT);
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);

  protected readonly seatsHeld = computed(() => {
    const draft = this.draft();
    return 1 + (draft.partner2 ? 1 : 0) + draft.children.length;
  });

  protected readonly unnamedCount = computed(() => unnamedAdultCount(this.draft()));

  constructor() {
    effect(() => {
      const rsvp = this.rsvp();
      this.draft.set(toRsvpDraft(rsvp));
      this.dirty.set(false);
      this.saveFailed.set(false);
    });
  }

  protected onDraftChange(draft: RsvpDraft): void {
    this.draft.set(draft);
    this.dirty.set(true);
    this.saveFailed.set(false);
  }

  /** "Open their profile" on a linked partner — same shell-level routing as
   *  `app-rsvp-edit`'s own (ADR W-0006 §Decision.3); `GET /v1/profile/:id`
   *  is readable by any authenticated guest, so this needs no admin check. */
  protected onOpenProfile(userId: string): void {
    this.profileModal.open(userId);
  }

  protected onBack(): void {
    this.back.emit();
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.dirty()) return;
    this.saving.set(true);
    this.saveFailed.set(false);
    const changes = fromRsvpDraft(this.draft());
    try {
      const updated = await firstValueFrom(
        this.rsvpCollection.update({ id: this.rsvp().id, ...changes }),
      );
      this.draft.set(toRsvpDraft(updated));
      this.dirty.set(false);
    } catch {
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
    }
  }
}
