import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { GuestListResponseDtoItemsInnerRelationOneOf } from '@app/core';

import { RelationFields, RelationFieldsValue } from './relation-fields';

const SideEnum = GuestListResponseDtoItemsInnerRelationOneOf.SideEnum;

describe('RelationFields (T309)', () => {
  let fixture: ComponentFixture<RelationFields>;
  let emitted: RelationFieldsValue[];

  async function create(
    value: RelationFieldsValue,
    inputs: Record<string, unknown> = {},
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [RelationFields],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(RelationFields);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('sideLabel', 'Side');
    fixture.componentRef.setInput('groupLabel', 'Group');
    for (const [name, val] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, val);
    }
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
  }

  function query<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  function queryAll<T extends HTMLElement>(selector: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
  }

  const value = (
    overrides: Partial<RelationFieldsValue> = {},
  ): RelationFieldsValue => ({
    side: SideEnum.BRIDE,
    kind: 'family',
    link: 'sister',
    ...overrides,
  });

  it('renders segmented controls and the family select in edit mode', async () => {
    await create(value());

    expect(queryAll('.seg-row').length).toBe(2);
    expect(query('select.select-native')).toBeTruthy();
    expect(query('.info-item')).toBeNull();
  });

  it('readOnly renders the info rows instead of controls', async () => {
    await create(value(), { readOnly: true });

    expect(query('.seg-row')).toBeNull();
    expect(query('select.select-native')).toBeNull();
    expect(query('input[app-input]')).toBeNull();

    const items = queryAll('.info-item');
    // Side, group, relationship — three read-only rows.
    expect(items.length).toBe(3);
    expect(items[0].querySelector('.value')?.textContent?.trim()).toBe(
      'guest_manager.relation.side.bride',
    );
    expect(items[1].querySelector('.value')?.textContent?.trim()).toBe(
      'guest_manager.relation.kind.family',
    );
    expect(items[2].querySelector('.value')?.textContent?.trim()).toBe(
      'guest_manager.relation.link.sister',
    );
  });

  it('shows an em dash in the read-only relationship row when there is no link', async () => {
    await create(value({ link: '' }), { readOnly: true });

    const items = queryAll('.info-item');
    const relationshipValue = items[2].querySelector('.value');
    expect(relationshipValue?.textContent?.trim()).toBe('—');
    expect(relationshipValue?.classList.contains('muted')).toBe(true);
  });

  it('showSide=false hides the side control', async () => {
    await create(value(), { showSide: false });

    expect(queryAll('.seg-row').length).toBe(1);
  });

  it('showSide=false hides the side row in read-only mode too', async () => {
    await create(value(), { readOnly: true, showSide: false });

    expect(queryAll('.info-item').length).toBe(2);
  });

  it('picking a group/kind clears the previous link value', async () => {
    await create(value({ kind: 'family', link: 'sister' }));

    const kindRow = queryAll<HTMLElement>('.seg-row')[1];
    const friendsBtn = Array.from(kindRow.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'guest_manager.relation.kind.friends',
    ) as HTMLButtonElement;
    friendsBtn.click();
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual({ side: SideEnum.BRIDE, kind: 'friends', link: '' });
  });

  it('renders a free-text input instead of the family select for a non-family kind', async () => {
    await create(value({ kind: 'friends', link: 'College roommate' }));

    expect(query('select.select-native')).toBeNull();
    const input = query<HTMLInputElement>('input[app-input]');
    expect(input).toBeTruthy();
    expect(input?.value).toBe('College roommate');
  });

  it('swaps back to the family select when kind is family', async () => {
    await create(value({ kind: 'family' }));

    expect(query('select.select-native')).toBeTruthy();
    expect(query('input[app-input]')).toBeNull();
  });

  it('valueChange emits the full next value, not a partial, when side changes', async () => {
    await create(value({ side: SideEnum.BRIDE, kind: 'friends', link: 'Old friend' }));

    const sideRow = queryAll<HTMLElement>('.seg-row')[0];
    const groomBtn = Array.from(sideRow.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'guest_manager.relation.side.groom',
    ) as HTMLButtonElement;
    groomBtn.click();
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual({ side: SideEnum.GROOM, kind: 'friends', link: 'Old friend' });
  });

  it('valueChange emits the full next value when the free-text link changes', async () => {
    await create(value({ kind: 'colleagues', link: '' }));

    const input = query<HTMLInputElement>('input[app-input]')!;
    input.value = 'Worked together at Novatek';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual({
      side: SideEnum.BRIDE,
      kind: 'colleagues',
      link: 'Worked together at Novatek',
    });
  });

  it('valueChange emits the full next value when the family select changes', async () => {
    await create(value({ kind: 'family', link: 'sister' }));

    const select = query<HTMLSelectElement>('select.select-native')!;
    select.value = 'brother';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual({ side: SideEnum.BRIDE, kind: 'family', link: 'brother' });
  });
});
