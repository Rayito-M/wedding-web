import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  PersonKey,
  RsvpDraft,
  RsvpDto,
  RsvpDtoAdultsPartner1Options,
  TranslateLanguageService,
  WeddingConfigResponseDto,
  partnerHasAccount,
  toggleOptionId,
  withPersonOptions,
} from '@app/core';
import { Avatar } from '@app/shared/avatar/avatar';
import { ChoiceCard } from '@app/shared/choice-card/choice-card';
import { ConfirmDialog } from '@app/shared/confirm-dialog/confirm-dialog';
import { Pill } from '@app/shared/pill/pill';
import { TextInput } from '@app/shared/input/input';
import { TextareaInput } from '@app/shared/textarea/textarea';

/**
 * Who is filling this editor in. Pure presentation — it indexes the
 * `rsvp.editor.perspective.*` copy namespace and nothing else, so it has no
 * API counterpart (ADR W-0003 §Decision.3). Ships with the two members that
 * have a call site; the DS's `partner`/`delegate` are deliberately absent.
 */
type Perspective = 'owner' | 'couple';

/** Which slot a card occupies — drives the role pill and the field layout. */
type PersonRole = 'primary' | 'partner' | 'child';

/** One configured diet/allergy option, resolved to the current language. */
interface CatalogOption {
  readonly id: string;
  readonly label: string;
}

/** One participant row, flattened out of the draft for the template. */
interface PersonCard {
  readonly key: PersonKey;
  readonly role: PersonRole;
  /** i18n key for the role pill — perspective-driven for the primary guest. */
  readonly roleKey: string;
  readonly firstName: string;
  readonly lastName: string;
  /** Optional, max 8 characters, shown in quotes beside the name — never in
   *  place of it. Read-only whenever `nameLocked` is true. */
  readonly nickname: string;
  /** `null` for adults — children only. */
  readonly age: string | null;
  /**
   * `partner2` only: this partner has their own guest account, so their name
   * belongs to that account and is rendered as static text (ADR W-0002
   * §Decision.3). Always `false` for the primary guest (who owns the account
   * being edited) and for children.
   */
  readonly nameLocked: boolean;
  /**
   * The guest account this card belongs to, when it has one — `partner2`'s
   * linked account id, otherwise `null`. Backs the couple's "Open their
   * profile" jump; the primary guest and children never carry one here.
   */
  readonly accountId: string | null;
  readonly options: RsvpDtoAdultsPartner1Options;
}

/**
 * The one RSVP editor, used everywhere an RSVP is edited: the guest's own
 * screen and the couple's guest-manager modal (in-repo ADR W-0003, DS
 * `ui_kits/wedding-app/RSVPEditor.jsx`). The only thing that varies is
 * `perspective` — who is filling it in — which selects the copy namespace for
 * the section heading, the meta line, the role pill of the primary guest, the
 * note label and the add links.
 *
 * Controlled component: it holds no dirty/saved state, performs no HTTP write
 * and never mutates the draft it is given — every edit emits a fresh
 * `RsvpDraft` on `draftChange` and the host persists it. Only the accordion's
 * expansion state and the half-typed custom-allergy entries are local.
 *
 * Deliberately **not** built, per ADR W-0003 §"Explicitly out of scope": the
 * DS's phone/email fields, the "Own account & invitation" toggle, the roster
 * lookup + "Link account" card, and the `needPhone` validation. Also a
 * deliberate deviation from the DS: with `noteReadonly` the note is static
 * text rather than an editable field, so the couple cannot overwrite what a
 * guest wrote to them.
 */
@Component({
  selector: 'app-rsvp-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [Avatar, ChoiceCard, ConfirmDialog, Pill, TextInput, TextareaInput, TranslatePipe],
  templateUrl: './rsvp-editor.html',
  styleUrl: './rsvp-editor.scss',
})
export class RsvpEditor {
  private readonly lang = inject(TranslateLanguageService);
  private readonly translate = inject(TranslateService);

  private readonly weddingConfigCollection: EntityCollectionService<WeddingConfigResponseDto> =
    inject(EntityServices).getEntityCollectionService<WeddingConfigResponseDto>(
      EntityNamesEnum.WEDDING_CONFIG,
    );

  /** The RSVP being edited, owned by the host. */
  readonly draft = input.required<RsvpDraft>();

  /** Who is filling it in — selects the copy namespace. */
  readonly perspective = input<Perspective>('owner');

  /** Render the attendance answer row (the couple's editor; the guest changes
   *  their answer through the create flow instead). */
  readonly showStatus = input(false);

  /** Offer "Pending" as a third answer, alongside "With joy" / "Sadly no" —
   *  the couple's editor only (DS `RSVPEditor.jsx` L107, L217–227). Ignored
   *  when `showStatus` is false. */
  readonly statusPending = input(false);

  /** Render the note as static text instead of a field — see the class note. */
  readonly noteReadonly = input(false);

  /** A fresh draft after every edit; the host decides when to persist it. */
  readonly draftChange = output<RsvpDraft>();

  /**
   * "Open their profile" on a partner whose name is locked to their own guest
   * account — emits that guest's user id. The **only** perspective-specific
   * action on this component (ADR W-0003 §Decision.6, amended): it renders in
   * the `couple` perspective alone, because the guest-manager is the one
   * surface with a profile overlay to swap to. The guest's own screen binds
   * nothing and gets no trigger.
   */
  readonly openProfile = output<string>();

  /** The answer choices to render, in DS order — "Pending" only joins when
   *  `statusPending()` is set (the couple's editor; the guest's omits it). */
  protected readonly statuses = computed<RsvpDto.StatusEnum[]>(() =>
    this.statusPending()
      ? [RsvpDto.StatusEnum.ATTENDING, RsvpDto.StatusEnum.PENDING, RsvpDto.StatusEnum.DECLINED]
      : [RsvpDto.StatusEnum.ATTENDING, RsvpDto.StatusEnum.DECLINED],
  );

  /** The muted reassurance line under the answer row — DS `RSVPEditor.jsx`
   *  L225. Shown only while the row itself is shown and the answer is "no". */
  protected readonly showDeclinedHint = computed(
    () => this.showStatus() && this.draft().status === RsvpDto.StatusEnum.DECLINED,
  );

  /** Which participant card is expanded — the first one, until the user says
   *  otherwise. Local: it is view state, not part of the reply. */
  protected readonly openKey = signal<PersonKey | null>('partner1');

  /** Half-typed custom-allergy text, per participant, before it commits to a
   *  chip. Local for the same reason. */
  private readonly customEntries = signal<Record<string, string>>({});

  /** Singleton resource: at most one document in the collection. The editor
   *  owns this read so neither host has to (ADR W-0003 §Decision.1). */
  private readonly weddingConfig = toSignal(
    this.weddingConfigCollection.entities$.pipe(map((configs) => configs[0])),
    { initialValue: undefined },
  );

  protected readonly dietaryOptions = computed<CatalogOption[]>(() =>
    this.toCatalog(this.weddingConfig()?.dietaryPreferences),
  );

  protected readonly allergyOptions = computed<CatalogOption[]>(() =>
    this.toCatalog(this.weddingConfig()?.allergies),
  );

  protected readonly cards = computed<PersonCard[]>(() => {
    const draft = this.draft();
    const perspective = this.perspective();
    const list: PersonCard[] = [
      {
        key: 'partner1',
        role: 'primary',
        roleKey: `rsvp.editor.perspective.${perspective}.primaryHint`,
        firstName: draft.partner1.firstName,
        lastName: draft.partner1.lastName,
        nickname: draft.partner1.nickname ?? '',
        age: null,
        nameLocked: false,
        accountId: null,
        options: draft.partner1.options,
      },
    ];
    if (draft.partner2) {
      list.push({
        key: 'partner2',
        role: 'partner',
        roleKey: 'rsvp.editor.kind.partner',
        firstName: draft.partner2.firstName,
        lastName: draft.partner2.lastName,
        nickname: draft.partner2.nickname ?? '',
        age: null,
        nameLocked: partnerHasAccount(draft.partner2),
        accountId: partnerHasAccount(draft.partner2) ? (draft.partner2.id ?? null) : null,
        options: draft.partner2.options,
      });
    }
    draft.children.forEach((child, index) => {
      list.push({
        key: `child:${index}`,
        role: 'child',
        roleKey: 'rsvp.editor.kind.child',
        firstName: child.firstName,
        lastName: '',
        nickname: child.nickname ?? '',
        age: child.age,
        nameLocked: false,
        accountId: null,
        options: child.options,
      });
    });
    return list;
  });

  protected readonly total = computed(() => this.cards().length);

  protected readonly canAddPartner = computed(() => !this.draft().partner2);

  protected readonly noteText = computed(() => this.draft().partner1.options.comments ?? '');

  /** Key into the perspective copy table, e.g. `…perspective.owner.party`. */
  protected perspectiveKey(name: string): string {
    return `rsvp.editor.perspective.${this.perspective()}.${name}`;
  }

  /** The DS differentiates the nickname placeholder by row kind
   *  (`RSVPEditor.jsx`: "e.g. Teo" for a child, "e.g. Lau" for an adult) —
   *  this picks the matching key. */
  protected nicknamePlaceholderKey(card: PersonCard): string {
    return card.role === 'child'
      ? 'rsvp.editor.person.nicknamePlaceholderChild'
      : 'rsvp.editor.person.nicknamePlaceholder';
  }

  constructor() {
    this.weddingConfigCollection.getByKey(''); // Singleton resource, only fetches if cache is empty
  }

  // ── accordion ──────────────────────────────────────────────────────────

  protected isOpen(key: PersonKey): boolean {
    return this.openKey() === key;
  }

  protected toggleOpen(key: PersonKey): void {
    this.openKey.update((current) => (current === key ? null : key));
  }

  // ── collapsed-card display ─────────────────────────────────────────────

  protected fullName(card: PersonCard): string {
    return `${card.firstName} ${card.lastName}`.trim();
  }

  protected initial(card: PersonCard): string {
    return (this.fullName(card) || '?').charAt(0).toUpperCase();
  }

  /** Age · diets · allergies, else "No meal details yet" (DS `summary`). */
  protected summaryFor(card: PersonCard): string {
    const bits: string[] = [];
    if (card.role === 'child' && card.age) {
      bits.push(this.translate.instant('rsvp.editor.person.yearsOld', { age: card.age }));
    }
    const diets = this.labelsFor(this.dietaryOptions(), card.options.dietaryPreferenceIds);
    if (diets.length) bits.push(diets.join(', '));
    const allergies = [
      ...this.labelsFor(this.allergyOptions(), card.options.allergyIds),
      ...(card.options.customAllergies ?? []),
    ].filter((entry) => !!entry.trim());
    if (allergies.length) {
      bits.push(
        this.translate.instant('rsvp.editor.person.allergiesSummary', {
          list: allergies.join(', '),
        }),
      );
    }
    return bits.length
      ? bits.join(' · ')
      : this.translate.instant('rsvp.editor.person.noMealDetails');
  }

  // ── attendance ─────────────────────────────────────────────────────────

  protected isStatus(status: RsvpDto.StatusEnum): boolean {
    return this.draft().status === status;
  }

  protected setStatus(status: RsvpDto.StatusEnum): void {
    this.draftChange.emit({ ...this.draft(), status });
  }

  // ── names ──────────────────────────────────────────────────────────────

  protected setAdultFirstName(key: PersonKey, value: string): void {
    const draft = this.draft();
    if (key === 'partner1') {
      this.draftChange.emit({ ...draft, partner1: { ...draft.partner1, firstName: value } });
      return;
    }
    if (key !== 'partner2' || !draft.partner2 || this.partner2NameLocked()) return;
    this.draftChange.emit({ ...draft, partner2: { ...draft.partner2, firstName: value } });
  }

  protected setAdultLastName(key: PersonKey, value: string): void {
    const draft = this.draft();
    if (key === 'partner1') {
      this.draftChange.emit({ ...draft, partner1: { ...draft.partner1, lastName: value } });
      return;
    }
    if (key !== 'partner2' || !draft.partner2 || this.partner2NameLocked()) return;
    this.draftChange.emit({ ...draft, partner2: { ...draft.partner2, lastName: value } });
  }

  /** Mirrors `setAdultFirstName`'s shape, plus the DS's 8-character clamp
   *  (`RSVPEditor.jsx`'s `v.slice(0, 8)`) — the wire allows up to 30, but the
   *  DS's narrower cap is deliberate (see Phase S intro). A locked partner2's
   *  nickname is owned by their own account too, same as their name. */
  protected setAdultNickname(key: PersonKey, value: string): void {
    const nickname = value.slice(0, 8);
    const draft = this.draft();
    if (key === 'partner1') {
      this.draftChange.emit({ ...draft, partner1: { ...draft.partner1, nickname } });
      return;
    }
    if (key !== 'partner2' || !draft.partner2 || this.partner2NameLocked()) return;
    this.draftChange.emit({ ...draft, partner2: { ...draft.partner2, nickname } });
  }

  /** The template renders a locked partner's name as static text; this backs
   *  it up so a programmatic call cannot rename another guest's account
   *  (ADR W-0002 §Decision.3). */
  private partner2NameLocked(): boolean {
    return partnerHasAccount(this.draft().partner2);
  }

  // ── open their profile (couple only) ───────────────────────────────────

  /** Does this card offer the jump to its own guest's profile? */
  protected canOpenProfile(card: PersonCard): boolean {
    return this.perspective() === 'couple' && !!card.accountId;
  }

  /** Hand the linked guest's id to the host, which owns the overlay swap. */
  protected requestProfile(card: PersonCard): void {
    if (!this.canOpenProfile(card) || !card.accountId) return;
    this.openProfile.emit(card.accountId);
  }

  protected setChildFirstName(index: number, value: string): void {
    const draft = this.draft();
    this.draftChange.emit({
      ...draft,
      children: draft.children.map((c, i) => (i === index ? { ...c, firstName: value } : c)),
    });
  }

  protected setChildAge(index: number, value: string): void {
    const digits = value.replace(/\D/g, '').slice(0, 2);
    const draft = this.draft();
    this.draftChange.emit({
      ...draft,
      children: draft.children.map((c, i) => (i === index ? { ...c, age: digits } : c)),
    });
  }

  /** Mirrors `setChildFirstName`'s shape, plus the same 8-character clamp as
   *  `setAdultNickname`. */
  protected setChildNickname(index: number, value: string): void {
    const nickname = value.slice(0, 8);
    const draft = this.draft();
    this.draftChange.emit({
      ...draft,
      children: draft.children.map((c, i) => (i === index ? { ...c, nickname } : c)),
    });
  }

  // ── meal options ───────────────────────────────────────────────────────

  protected isSelected(card: PersonCard, field: 'dietaryPreferenceIds' | 'allergyIds', id: string): boolean {
    return (card.options[field] ?? []).includes(id);
  }

  protected toggleDiet(key: PersonKey, id: string): void {
    this.draftChange.emit(
      withPersonOptions(this.draft(), key, (opts) =>
        toggleOptionId(opts, 'dietaryPreferenceIds', id),
      ),
    );
  }

  protected toggleAllergy(key: PersonKey, id: string): void {
    this.draftChange.emit(
      withPersonOptions(this.draft(), key, (opts) => toggleOptionId(opts, 'allergyIds', id)),
    );
  }

  // ── custom allergies (multi-entry chips) ───────────────────────────────

  protected customEntry(key: PersonKey): string {
    return this.customEntries()[key] ?? '';
  }

  protected setCustomEntry(key: PersonKey, value: string): void {
    this.customEntries.update((entries) => ({ ...entries, [key]: value }));
  }

  /**
   * Commit the half-typed entry as its own chip. Called from Enter and from
   * blur; `preventDefault()` keeps Enter from submitting a surrounding form.
   * Blank and whitespace-only entries are dropped, and so is a trimmed
   * case-insensitive duplicate of an entry this person already carries.
   */
  protected commitCustomAllergy(card: PersonCard, event: Event): void {
    event.preventDefault();
    const entry = this.customEntry(card.key).trim();
    this.setCustomEntry(card.key, '');
    if (!entry) return;
    const current = card.options.customAllergies ?? [];
    const needle = entry.toLowerCase();
    if (current.some((existing) => existing.trim().toLowerCase() === needle)) return;
    this.draftChange.emit(
      withPersonOptions(this.draft(), card.key, (opts) => ({
        ...opts,
        customAllergies: [...(opts.customAllergies ?? []), entry],
      })),
    );
  }

  protected removeCustomAllergy(key: PersonKey, index: number): void {
    this.draftChange.emit(
      withPersonOptions(this.draft(), key, (opts) => ({
        ...opts,
        customAllergies: (opts.customAllergies ?? []).filter((_, i) => i !== index),
      })),
    );
  }

  // ── note ───────────────────────────────────────────────────────────────

  protected setNote(value: string): void {
    if (this.noteReadonly()) return;
    this.draftChange.emit(
      withPersonOptions(this.draft(), 'partner1', (opts) => ({
        ...opts,
        comments: value || null,
      })),
    );
  }

  // ── party membership ───────────────────────────────────────────────────

  /** A partner added here is always a plus-one: no `id`, so
   *  `partnerHasAccount()` is false and the card stays editable. */
  protected addPartner(): void {
    const draft = this.draft();
    if (draft.partner2) return;
    this.openKey.set('partner2');
    this.draftChange.emit({
      ...draft,
      partner2: {
        firstName: '',
        lastName: '',
        options: {},
        kind: 'plus-one',
      },
    });
  }

  protected addChild(): void {
    const draft = this.draft();
    this.openKey.set(`child:${draft.children.length}`);
    this.draftChange.emit({
      ...draft,
      children: [...draft.children, { firstName: '', age: '', options: {} }],
    });
  }

  /**
   * `partner2` or a child, awaiting confirmation from `<app-confirm-dialog>`
   * — `null` means no dialog is open. `.remove-btn`'s `(click)` sets this
   * instead of mutating the draft directly (Phase M / T278); the mutation
   * itself is unchanged and now lives in `confirmRemove`.
   */
  protected readonly pendingRemoval = signal<PersonKey | null>(null);

  private readonly partyTitleRef = viewChild<ElementRef<HTMLHeadingElement>>('partyTitle');

  /** The card the confirm dialog is asking about, or `null` when closed. */
  protected readonly pendingCard = computed<PersonCard | null>(() => {
    const key = this.pendingRemoval();
    if (key === null) return null;
    return this.cards().find((card) => card.key === key) ?? null;
  });

  /** i18n key for the dialog title — by card kind, never by parsing `key`. */
  protected removeDialogTitleKey(): string {
    return this.pendingCard()?.role === 'child'
      ? 'rsvp.editor.remove.titleChild'
      : 'rsvp.editor.remove.titlePartner';
  }

  /** The consequence line, with the person's name — or the DS's fallback
   *  ("This partner" / "This child") when they have none yet. */
  protected removeDialogMessage(): string {
    const card = this.pendingCard();
    if (!card) return '';
    const fallbackKey =
      card.role === 'child' ? 'rsvp.editor.remove.fallbackChild' : 'rsvp.editor.remove.fallbackPartner';
    const name = this.fullName(card) || this.translate.instant(fallbackKey);
    return this.translate.instant('rsvp.editor.remove.message', { name });
  }

  /** Opens the confirmation. Same early `return` as the old `removePerson`
   *  — ignores `partner1` and any unrecognised key, so a programmatic call
   *  can't queue up removing the primary guest. */
  protected requestRemove(key: PersonKey): void {
    if (key !== 'partner2' && !key.startsWith('child:')) return;
    this.pendingRemoval.set(key);
  }

  /** Verbatim the old `removePerson` body, run against the pending key, then
   *  clears the signal. Focus moves to the party heading — the trigger that
   *  would normally receive it is gone. */
  protected confirmRemove(): void {
    const key = this.pendingRemoval();
    if (key === null) return;
    const draft = this.draft();
    let next: RsvpDraft;
    if (key === 'partner2') {
      next = { ...draft, partner2: undefined };
    } else if (key.startsWith('child:')) {
      const index = this.childIndex(key);
      next = { ...draft, children: draft.children.filter((_, i) => i !== index) };
    } else {
      return;
    }
    if (this.openKey() === key) this.openKey.set(null);
    this.draftChange.emit(next);
    this.pendingRemoval.set(null);
    this.partyTitleRef()?.nativeElement.focus();
  }

  /** Every dismissal means "keep them" — clears the signal, emits nothing.
   *  Focus restoration to `.remove-btn` is `app-confirm-dialog`'s own job. */
  protected cancelRemove(): void {
    this.pendingRemoval.set(null);
  }

  // ── helpers ────────────────────────────────────────────────────────────

  protected childIndex(key: PersonKey): number {
    return Number(key.slice('child:'.length));
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  private labelsFor(catalog: CatalogOption[], ids: string[] | undefined): string[] {
    return (ids ?? []).map((id) => catalog.find((option) => option.id === id)?.label ?? id);
  }

  private toCatalog(
    entries: WeddingConfigResponseDto['dietaryPreferences'] | undefined,
  ): CatalogOption[] {
    const lang = this.lang.currentLang();
    return (entries ?? []).map((entry) => ({ id: entry.id, label: entry.label[lang] }));
  }
}
