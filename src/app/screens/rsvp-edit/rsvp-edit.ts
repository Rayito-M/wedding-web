import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  EMPTY_RSVP_DRAFT,
  EntityNamesEnum,
  HeaderService,
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
 * The RSVP once it exists (design system `ScreenRSVPEdit.jsx`): the page
 * header, the shared `app-rsvp-editor` in `owner` perspective (rendered
 * unconditionally, with `showStatus` so the guest can switch their answer
 * inline), and the save footer.
 *
 * This screen is chrome, persistence and gating only (ADR W-0003
 * §Decision.2). The editable body — the attendance answer, participant
 * cards, name lock, diet and allergy chips, add/remove, the note — lives in
 * `app-rsvp-editor` and is shared with the couple's manage-RSVP modal.
 *
 * There is no "Change my answer" control any more (Phase L decision 1): a
 * declined guest edits their status inline, in the same editor that shows
 * their party, and `app-rsvp-create` stays reachable only for a genuinely
 * `pending` record (`screens/rsvp/rsvp.html`).
 *
 * Two headings, two owners: this host says *which record this is* ("Your
 * reply", `rsvp.edit.title`, one string for both the attending and the
 * declined state — the eyebrow and the subtitle carry the status; the DS's
 * status-driven `<h2>` is a deliberate non-adoption, ADR W-0003 §Decision.9
 * and Phase L — following it would print "Your party" twice, since that
 * heading already moved into the editor), while the editor labels the list
 * below it ("Your party") from its own perspective namespace.
 */
@Component({
  selector: 'app-rsvp-edit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Btn, RsvpEditor, TranslatePipe, PluralTranslatePipe],
  templateUrl: './rsvp-edit.html',
  styleUrl: './rsvp-edit.scss',
})
export class RsvpEdit {
  private readonly translateService = inject(TranslateService);
  private readonly header = inject(HeaderService);

  private readonly rsvpCollection: EntityCollectionService<RsvpDto> = inject(
    EntityServices,
  ).getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP);

  /** The current guest's RSVP, as read by the orchestrator. */
  readonly rsvp = input.required<RsvpDto>();

  // Placeholder until the constructor's `effect()` below resyncs it from the
  // required `rsvp` input — reading a required input signal at field-init
  // time is flagged by the Angular compiler (NG8118) even though the value
  // is available; the effect runs once immediately after construction, well
  // before the initial render is visible.
  protected readonly draft = signal<RsvpDraft>(EMPTY_RSVP_DRAFT);
  protected readonly dirty = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);

  /** Seats held: the primary guest, their partner if any, and the children. */
  protected readonly seatsHeld = computed(() => {
    const draft = this.draft();
    return 1 + (draft.partner2 ? 1 : 0) + draft.children.length;
  });

  /** The save gate, shared with the couple's editor (ADR W-0003 §Decision.7). */
  protected readonly unnamedCount = computed(() => unnamedAdultCount(this.draft()));

  constructor() {
    effect(() => {
      const header = this.translateService.instant('rsvp.header');
      const eyebrowKey =
        this.draft().status === RsvpDto.StatusEnum.DECLINED
          ? 'rsvp.edit.eyebrow.declined'
          : 'rsvp.edit.eyebrow.confirmed';
      this.header.set(`${header} · ${this.translateService.instant(eyebrowKey)}`);
    });

    // Resync the draft whenever the orchestrator hands us a fresh entity
    // (e.g. after our own successful save round-trips through the cache).
    effect(() => {
      const rsvp = this.rsvp();
      this.draft.set(toRsvpDraft(rsvp));
      this.dirty.set(false);
      this.saveFailed.set(false);
    });
  }

  /** The editor is controlled: it never mutates, it hands back a new draft. */
  protected onDraftChange(draft: RsvpDraft): void {
    this.draft.set(draft);
    this.dirty.set(true);
    this.saveFailed.set(false);
  }

  protected async save(): Promise<void> {
    if (this.saving() || !this.dirty()) return;
    this.saving.set(true);
    this.saveFailed.set(false);
    const changes = fromRsvpDraft(this.draft());
    try {
      // `EntityCollectionService.update()` takes a flat `Partial<T>` (must
      // include `id`) — it's the underlying `EntityCollectionDataService`
      // (`RsvpDataService.update()`) that wraps it as `{ id, changes }`
      // before calling the API.
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
