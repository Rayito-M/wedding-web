import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { GuestListResponseDtoItemsInnerRelationOneOf, UpdateUserProfileDto } from '@app/core';
import { langDescription } from '@app/model';
import { GuestSeg } from '@app/shared/guest-seg/guest-seg';
import { TextInput } from '@app/shared/input/input';
import { RelationFields, RelationFieldsValue } from '@app/shared/relation-fields/relation-fields';

/** Nickname clamps at 30 characters (T307's DS-widened cap, up from Phase S's
 *  deliberately-narrower 8) — a named constant, per this task's acceptance,
 *  rather than a bare literal at each call site. */
export const NICKNAME_MAX_LENGTH = 30;

const LANG_ENUM = UpdateUserProfileDto.PreferredLangEnum;

/**
 * The value this component edits.
 *
 * **Nested vs. flat (implementer's call, per this task's acceptance).** The DS
 * `ProfileFields.jsx` flattens `side`/`group`/`relation` alongside its own
 * fields and re-slices them back out before handing them to `RelationFields`.
 * This port nests them instead, as `relation?: RelationFieldsValue` — it
 * reuses `RelationFieldsValue` (T309) verbatim rather than re-decomposing the
 * same three fields under different names, and the `[value]`/`(valueChange)`
 * pair handed to `<app-relation-fields>` below becomes a direct pass-through
 * instead of a per-field pick/patch. `relation` is only meaningful — and only
 * rendered — when `showRelation()` is true; a caller with `showRelation`
 * off (`profile-modal`, T312) simply never sets it.
 */
export interface ProfileFieldsValue {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  phoneNumber: string;
  preferredLang: UpdateUserProfileDto.PreferredLangEnum;
  relation?: RelationFieldsValue;
}

const DEFAULT_VALUE: ProfileFieldsValue = {
  firstName: '',
  lastName: '',
  nickname: '',
  email: '',
  phoneNumber: '',
  preferredLang: LANG_ENUM.EN,
};

/** Fallback handed to `<app-relation-fields>` when `value().relation` is
 *  `undefined` — an Angular signal input's default only applies when the
 *  binding is omitted entirely, not when it's bound to `undefined`, so this
 *  component must supply a real value itself whenever `showRelation()` is on
 *  but the host hasn't seeded `relation` yet. Same shape `RelationFields`
 *  itself defaults to. */
const DEFAULT_RELATION_VALUE: RelationFieldsValue = {
  side: GuestListResponseDtoItemsInnerRelationOneOf.SideEnum.BRIDE,
  kind: 'family',
  link: '',
};

/** EN-first order (this app's actual default language — see
 *  `guest-create-modal.ts`'s identical `preferredLangs`, same rationale). */
const PREFERRED_LANGS: UpdateUserProfileDto.PreferredLangEnum[] = [
  LANG_ENUM.EN,
  LANG_ENUM.ES,
  LANG_ENUM.FR,
];

type TextFieldKey = 'firstName' | 'lastName' | 'nickname' | 'email' | 'phoneNumber';

/**
 * Shared person-profile form (DS `components/core/ProfileFields.jsx`, commit
 * `b5c718d8dc214bafe7f67ee296c53f371ae31080`): first/last name, nickname,
 * email, phone, preferred language, and — composing `app-relation-fields`
 * (T309) — the side/group/relationship block. Extracted out of the near-
 * identical field lists `profile-modal`, `guest-profile-modal`, and
 * `guest-create-modal` each hand-roll today (T311-T313 migrate them).
 *
 * **Language picker (implementer's call, per this task's acceptance).** This
 * app has two existing patterns: `guest-create-modal`'s `app-guest-seg` pills
 * over a hardcoded EN-first `preferredLangs` array, and `profile-modal`'s
 * `ConfigurationService`-driven `weddingConfigPublic()?.language` list. This
 * component is shared across all three call sites and must stay
 * config-agnostic — it has no business injecting `ConfigurationService` just
 * to render three static pills, and the wedding's *enabled* languages are a
 * different concept from `UpdateUserProfileDto.preferredLang`'s full
 * (es/en/fr) enum a person can be set to regardless of which languages the
 * public site currently offers. So this component ports `guest-create-modal`'s
 * pattern: a hardcoded `PREFERRED_LANGS` array plus the existing
 * `langDescription` catalog (native names, not translated — a language's own
 * name doesn't change with the viewer's UI language), rendered with the same
 * `app-guest-seg` pill already used for the side/group row below it, instead
 * of inventing a third pill class (`profile-modal`'s bespoke `.lang-chip`
 * does not carry over). `GuestProfileModal`'s edit form has no language
 * control today — `showLanguage()` being `false` renders nothing, so that
 * call site (T311) is unaffected either way.
 *
 * Plain input/output, "patch" semantics — `valueChange` always emits the full
 * next value, matching `RelationFields`'/`rsvp-editor`'s `draftChange`
 * precedent. `readOnly` swaps every control for a static value; `lockContact`
 * additionally locks email/phone even while `readOnly()` is false (the
 * guest's own profile, where identity is editable but contact details are
 * couple-managed — T303's existing behaviour, now owned here).
 *
 * No call site is wired yet (T311-T313's job) — built and unit-tested in
 * isolation, same as T303's/T309's precedent.
 */
@Component({
  selector: 'app-profile-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslatePipe, TextInput, GuestSeg, RelationFields],
  templateUrl: './profile-fields.html',
  styleUrl: './profile-fields.scss',
})
export class ProfileFields {
  readonly value = input<ProfileFieldsValue>(DEFAULT_VALUE);
  readonly valueChange = output<ProfileFieldsValue>();

  /** Column count for the paired rows (name, contact, relation) — 2 (default)
   *  or 1. */
  readonly columns = input<1 | 2>(2);
  /** Render every field as a static value instead of a control. */
  readonly readOnly = input(false);
  /** Show the preferred-language pill row. `false` for the guest-manager admin
   *  edit form, which has no language control (an admin does not set a
   *  guest's `preferredLang`). */
  readonly showLanguage = input(true);
  /** Compose `app-relation-fields` below the rest of the form. */
  readonly showRelation = input(true);
  /** Render email/phone as static values even while `readOnly()` is `false` —
   *  the guest's own profile, where contact details are couple-managed. */
  readonly lockContact = input(false);
  /** Pre-translated helper line under email/phone, shown only while
   *  `lockContact()` is on and the form isn't fully `readOnly()`. */
  readonly contactHint = input<string>();
  /** Forwarded to `app-relation-fields`' `hint` input. */
  readonly relationHint = input<string>();
  /** Optional heading above the relation block. */
  readonly relationTitle = input<string>();

  protected readonly nicknameMaxLength = NICKNAME_MAX_LENGTH;
  protected readonly preferredLangs = PREFERRED_LANGS;
  protected readonly langDescription = langDescription;

  protected readonly relationValue = computed<RelationFieldsValue>(
    () => this.value().relation ?? DEFAULT_RELATION_VALUE,
  );

  protected setField(key: TextFieldKey, val: string): void {
    this.patch({ [key]: val } as Partial<ProfileFieldsValue>);
  }

  protected setNickname(val: string): void {
    this.setField('nickname', val.slice(0, NICKNAME_MAX_LENGTH));
  }

  protected selectLang(lang: UpdateUserProfileDto.PreferredLangEnum): void {
    if (this.readOnly()) return;
    this.patch({ preferredLang: lang });
  }

  protected onRelationChange(relation: RelationFieldsValue): void {
    this.patch({ relation });
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private patch(partial: Partial<ProfileFieldsValue>): void {
    this.valueChange.emit({ ...this.value(), ...partial });
  }
}
