import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
  GuestListResponseDtoItemsInnerRelationOneOf,
  relationLinkLabel as formatRelationLink,
} from '@app/core';
import { TextInput } from '@app/shared/input/input';
import { GuestSeg } from '@app/shared/guest-seg/guest-seg';

/**
 * The four relation groupings a guest can be filed under (DS
 * `RELATION_GROUPS`, this app's `kind`). The wire's `kind`
 * (`GuestListResponseDtoItemsInnerRelationOneOf.kind`) is untyped `string` —
 * no generated enum exists to import — so this is declared once, here, and
 * every call site imports it (phase-U intro, hard rule 15's narrower
 * cousin: only API-model types with a real generated counterpart are barred
 * from local declaration).
 */
export type RelationKind = 'family' | 'friends' | 'colleagues' | 'other';

/** The value this component edits — `side`/`link` mirror the generated
 *  `GuestListResponseDtoItemsInnerRelationOneOf` shape exactly (hard rule 15:
 *  `side` reuses the generated `SideEnum`, never a hand-copied
 *  `'bride' | 'groom' | 'both'` union). */
export interface RelationFieldsValue {
  side: GuestListResponseDtoItemsInnerRelationOneOf.SideEnum;
  kind: RelationKind;
  link: string;
}

const SIDE_ENUM = GuestListResponseDtoItemsInnerRelationOneOf.SideEnum;
const LINK_ENUM = GuestListResponseDtoItemsInnerRelationOneOf.LinkEnum;

const SIDES: GuestListResponseDtoItemsInnerRelationOneOf.SideEnum[] = [
  SIDE_ENUM.BRIDE,
  SIDE_ENUM.GROOM,
  SIDE_ENUM.BOTH,
];

const KINDS: RelationKind[] = ['family', 'friends', 'colleagues', 'other'];

/** The family variant's closed `link` vocabulary (DS `FAMILY_RELATIONS`,
 *  widened to the full generated `LinkEnum` — same list `guest-create-modal`/
 *  `guest-profile-modal` already offer). */
const FAMILY_LINKS: GuestListResponseDtoItemsInnerRelationOneOf.LinkEnum[] =
  Object.values(LINK_ENUM);

const DEFAULT_VALUE: RelationFieldsValue = { side: SIDE_ENUM.BRIDE, kind: 'family', link: '' };

/**
 * Shared side/group(kind)/relationship(link) editor (DS
 * `components/core/RelationFields.jsx`, commit
 * `b5c718d8dc214bafe7f67ee296c53f371ae31080`) — extracted out of the
 * identical block `guest-profile-modal.html` and `guest-create-modal.html`
 * each hand-rolled (T309). `app-profile-fields` (T310) composes this, same
 * as the DS's `ProfileFields` composes `RelationFields`.
 *
 * Plain input/output, "patch" semantics: `valueChange` always emits the full
 * next `{side, kind, link}`, never a partial (mirrors the DS's
 * `onChange({ ...current, ...partial })`) — the host decides what to do with
 * it (a `FormGroup.patchValue`, a draft signal, …), same shape as
 * `rsvp-editor`'s `draftChange`.
 *
 * `readOnly` swaps the controls for the DS's plain info rows; `showSide`
 * hides the side control entirely (DS: "e.g. providers"); `sideLabel`/
 * `groupLabel`/`hint` are pre-translated strings the host supplies — this
 * component owns no i18n copy of its own for them, since their voice differs
 * by caller (DS's own doc: "voice depends on who is editing"). Every other
 * label (the side/kind pill text, the "Relationship link · <kind>" heading,
 * the family `<select>`'s option list, the non-family placeholder) reuses the
 * existing shared `relation.*` / `guest_manager.form.*` keys the ported
 * markup already used — this component owns neither namespace: `relation.*`
 * is shared with the people directory and the profile modal (see
 * `core/pipe/relation-link.pipe.ts`).
 *
 * No call site is wired yet (T311/T313's job) — built and unit-tested here in
 * isolation, same as T303's precedent (`shared/profile-modal`).
 */
@Component({
  selector: 'app-relation-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslatePipe, GuestSeg, TextInput],
  templateUrl: './relation-fields.html',
  styleUrl: './relation-fields.scss',
})
export class RelationFields {
  private readonly translate = inject(TranslateService);

  readonly value = input<RelationFieldsValue>(DEFAULT_VALUE);
  readonly valueChange = output<RelationFieldsValue>();

  /** Column count for the side/group row — 2 (default) or 1. */
  readonly columns = input<1 | 2>(2);
  /** Hide the side segmented control entirely (DS: "e.g. providers"). */
  readonly showSide = input(true);
  /** Render the values as read-only info rows instead of controls. */
  readonly readOnly = input(false);
  /** Pre-translated label for the side control/row — the host's job (see
   *  the class doc); no default so an omitted label renders as nothing
   *  rather than a silently-hardcoded English word. */
  readonly sideLabel = input<string>();
  /** Pre-translated label for the group(kind) control/row. */
  readonly groupLabel = input<string>();
  /** Pre-translated helper line under the relationship control, edit mode
   *  only (mirrors the DS, which never shows it in the read-only branch). */
  readonly hint = input<string>();

  protected readonly sides = SIDES;
  protected readonly kinds = KINDS;
  protected readonly familyLinks = FAMILY_LINKS;

  protected readonly isFamily = computed(() => this.value().kind === 'family');

  /** i18n key for the free-text relation-link placeholder — copy adapts per
   *  non-family `kind`, ported as-is from `guest-profile-modal`/
   *  `guest-create-modal`. */
  protected readonly linkPlaceholderKey = computed(
    () => `guest_manager.form.linkPlaceholder.${this.value().kind}`,
  );

  /**
   * The read-only relationship row's value: a family `link` is a catalog key
   * (translated through the shared `relation.link.*` namespace), every other
   * kind's `link` is free text — that split now lives once, in the shared
   * `relationLinkLabel` helper. `null` when there is no link yet, so the
   * template can fall back to an em dash.
   */
  protected readonly relationLinkLabel = computed<string | null>(() => {
    const value = this.value();
    if (!value.link) return null;
    return formatRelationLink(value, (key) => this.translate.instant(key));
  });

  protected selectSide(side: GuestListResponseDtoItemsInnerRelationOneOf.SideEnum): void {
    this.patch({ side });
  }

  protected selectKind(kind: RelationKind): void {
    // The previous `link` (a family-relation enum member, or free text for a
    // different kind) no longer matches the new kind's field shape —
    // `guest-profile-modal`/`guest-create-modal`'s existing `selectKind`
    // cleared it the same way; ported, not new behavior.
    this.patch({ kind, link: '' });
  }

  protected onLinkInput(event: Event): void {
    this.patch({ link: (event.target as HTMLInputElement).value });
  }

  protected onLinkSelect(event: Event): void {
    this.patch({ link: (event.target as HTMLSelectElement).value });
  }

  private patch(partial: Partial<RelationFieldsValue>): void {
    this.valueChange.emit({ ...this.value(), ...partial });
  }
}
