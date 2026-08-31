import { Pipe, PipeTransform, inject, type Signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import type { GuestListResponseDtoItemsInnerRelation } from '../api';

/**
 * A guest's relation to the couple is rendered on three unrelated surfaces —
 * the people directory, the profile modal, and the guest manager's create/
 * profile modals (through `app-relation-fields`) — so its vocabulary lives in
 * one shared i18n namespace, `relation.*` in `public/i18n/{en,es,fr}.json`,
 * not under any one screen's namespace. `relation.side.*` and
 * `relation.kind.*` are plain key prefixes templates concatenate themselves;
 * `link` needs this helper because it is two different things depending on
 * `kind`.
 *
 * `kind: 'family'` ⇒ `link` is a catalog key from the contract's closed
 * `LinkEnum` (`sister-in-law`, `stepgrandfather`, …) and must be translated.
 * Every other `kind` ⇒ `link` is free text the couple typed (a job title, a
 * club name) and must be printed verbatim, never used as a lookup key.
 *
 * Returns `null` for the free-text case so callers can tell "translate this"
 * from "print this as-is"; `relationLinkLabel` below is the one-call version.
 */
export function relationLinkKey(
  relation: GuestListResponseDtoItemsInnerRelation | null | undefined,
): string | null {
  if (!relation?.link) return null;
  return relation.kind === 'family' ? `relation.link.${relation.link}` : null;
}

/**
 * The display label for a relation's `link` — translated catalog term for
 * `family`, the free text verbatim otherwise, empty string when there is no
 * link yet. `translate` is supplied by the caller (`TranslateService.instant`
 * at every call site today), same shape as `lastSeenLabel`.
 */
export function relationLinkLabel(
  relation: GuestListResponseDtoItemsInnerRelation | null | undefined,
  translate: (key: string) => string,
): string {
  if (!relation?.link) return '';
  const key = relationLinkKey(relation);
  return key ? translate(key) : relation.link;
}

/**
 * Template form of `relationLinkLabel` — `{{ relation | relationLink }}`.
 *
 * Impure and signal-cached exactly like ngx-translate's own `TranslatePipe`
 * (v18 `translate()` returns a `Signal`), so the label re-renders on a
 * language switch in an `OnPush` component without the host having to depend
 * on the current language itself.
 */
@Pipe({
  name: 'relationLink',
  pure: false,
})
export class RelationLinkPipe implements PipeTransform {
  private readonly translateService = inject(TranslateService);

  private cachedSignal: Signal<unknown> | null = null;
  private lastKey: string | null = null;

  transform(relation: GuestListResponseDtoItemsInnerRelation | null | undefined): string {
    const key = relationLinkKey(relation);
    // Free text (or no link at all) — printed verbatim, never looked up.
    if (!key) return relation?.link ?? '';

    if (key !== this.lastKey || !this.cachedSignal) {
      this.cachedSignal = this.translateService.translate(key);
      this.lastKey = key;
    }
    return String(this.cachedSignal());
  }
}
