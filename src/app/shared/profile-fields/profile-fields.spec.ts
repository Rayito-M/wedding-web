import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { GuestListResponseDtoItemsInnerRelationOneOf, UpdateUserProfileDto } from '@app/core';

import { NICKNAME_MAX_LENGTH, ProfileFields, ProfileFieldsValue } from './profile-fields';

const SideEnum = GuestListResponseDtoItemsInnerRelationOneOf.SideEnum;
const LangEnum = UpdateUserProfileDto.PreferredLangEnum;

describe('ProfileFields (T310)', () => {
  let fixture: ComponentFixture<ProfileFields>;
  let emitted: ProfileFieldsValue[];

  async function create(
    value: ProfileFieldsValue,
    inputs: Record<string, unknown> = {},
  ): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProfileFields],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(ProfileFields);
    fixture.componentRef.setInput('value', value);
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

  const value = (overrides: Partial<ProfileFieldsValue> = {}): ProfileFieldsValue => ({
    firstName: 'Laura',
    lastName: 'Ortega',
    nickname: 'Lau',
    email: 'laura@example.com',
    phoneNumber: '+34600000000',
    preferredLang: LangEnum.ES,
    relation: { side: SideEnum.BRIDE, kind: 'family', link: 'sister' },
    ...overrides,
  });

  it('renders text inputs in edit mode', async () => {
    await create(value());

    expect(queryAll('input[app-input]').length).toBeGreaterThan(0);
    const firstNameInput = query<HTMLInputElement>('input[app-input]');
    expect(firstNameInput?.value).toBe('Laura');
    expect(query('.value')).toBeNull();
  });

  it('readOnly renders static values instead of controls', async () => {
    await create(value(), { readOnly: true });

    expect(query('input[app-input]')).toBeNull();
    const values = queryAll('.value').map((el) => el.textContent?.trim());
    expect(values).toContain('Laura');
    expect(values).toContain('Ortega');
    expect(values).toContain('Lau');
    expect(values).toContain('laura@example.com');
    expect(values).toContain('+34600000000');
  });

  it('lockContact locks email/phone even while readOnly() is false', async () => {
    await create(value(), { lockContact: true, contactHint: 'Managed by the couple' });

    // firstName/lastName/nickname still editable...
    expect(queryAll('input[app-input]').length).toBeGreaterThan(0);
    // ...but email/phone render as static values with the hint.
    const values = queryAll('.value').map((el) => el.textContent?.trim());
    expect(values).toContain('laura@example.com');
    expect(values).toContain('+34600000000');
    const hints = queryAll('.field-hint').map((el) => el.textContent?.trim());
    expect(hints).toContain('Managed by the couple');
  });

  it('showLanguage=false hides the language pill row', async () => {
    await create(value(), { showLanguage: false });

    expect(query('.seg-row')).toBeTruthy(); // the relation block's own seg-row(s)
    const segRows = queryAll('.seg-row');
    // With showLanguage off, only relation's side + group seg-rows remain (2).
    expect(segRows.length).toBe(2);
  });

  it('showLanguage=true adds the language pill row', async () => {
    await create(value(), { showLanguage: true, showRelation: false });

    const segRows = queryAll('.seg-row');
    expect(segRows.length).toBe(1);
    const buttons = Array.from(segRows[0].querySelectorAll('button'));
    expect(buttons.length).toBe(3);
  });

  it('showRelation=false hides the relation block entirely', async () => {
    await create(value(), { showRelation: false, showLanguage: false });

    expect(query('.relation-block')).toBeNull();
    expect(query('app-relation-fields')).toBeNull();
  });

  it('showRelation=true renders app-relation-fields', async () => {
    await create(value());

    expect(query('app-relation-fields')).toBeTruthy();
  });

  it('nickname clamps at 30 characters', async () => {
    await create(value({ nickname: '' }));

    const inputs = queryAll<HTMLInputElement>('input[app-input]');
    // firstName, lastName, nickname, email, phone in that DOM order — nickname is 3rd.
    const nicknameInput = inputs[2];
    expect(nicknameInput.maxLength).toBe(NICKNAME_MAX_LENGTH);

    const longValue = 'x'.repeat(40);
    nicknameInput.value = longValue;
    nicknameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].nickname).toBe('x'.repeat(NICKNAME_MAX_LENGTH));
    expect(emitted[0].nickname.length).toBe(30);
  });

  it('valueChange emits the full next value, not a partial, on a text field change', async () => {
    await create(value());

    const inputs = queryAll<HTMLInputElement>('input[app-input]');
    const lastNameInput = inputs[1];
    lastNameInput.value = 'Smith';
    lastNameInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toEqual(value({ lastName: 'Smith' }));
  });

  it('valueChange emits the full next value on a language pill change', async () => {
    await create(value({ preferredLang: LangEnum.ES }), { showRelation: false });

    const segRow = query<HTMLElement>('.seg-row')!;
    const enButton = Array.from(segRow.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'English',
    ) as HTMLButtonElement;
    enButton.click();
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].preferredLang).toBe(LangEnum.EN);
  });

  it('valueChange emits the full next value when the relation block changes', async () => {
    await create(value({ relation: { side: SideEnum.BRIDE, kind: 'family', link: 'sister' } }));

    const relationFields = query('app-relation-fields')!;
    const kindRow = relationFields.querySelectorAll('.seg-row')[1];
    const friendsBtn = Array.from(kindRow.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'guest_manager.relation.kind.friends',
    ) as HTMLButtonElement;
    friendsBtn.click();
    fixture.detectChanges();

    expect(emitted.length).toBe(1);
    expect(emitted[0].relation).toEqual({ side: SideEnum.BRIDE, kind: 'friends', link: '' });
    // The rest of the value is untouched — a full next value, not a partial.
    expect(emitted[0].firstName).toBe('Laura');
  });

  it('falls back to a default relation value when the host has not seeded one', async () => {
    await create(value({ relation: undefined }));

    // No thrown error, and the relation block still renders with the default.
    expect(query('app-relation-fields')).toBeTruthy();
  });
});
