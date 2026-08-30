import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  CreateGuestDto,
  CreateGuestDtoRelation,
  EntityNamesEnum,
  GuestDto,
  GuestListResponseDtoItemsInnerRelationOneOf,
  UserProfileDto,
  WeddingGuestsService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { GuestCreateModal } from './guest-create-modal';

const SideEnum = GuestListResponseDtoItemsInnerRelationOneOf.SideEnum;

function createdGuest(overrides: Partial<GuestDto> = {}): GuestDto {
  return {
    id: 'new-guest-1',
    version: 1,
    firstName: 'Laura',
    lastName: 'Mendoza',
    phoneNumber: '+34600000000',
    preferredLang: GuestDto.PreferredLangEnum.EN,
    role: 'guest',
    relation: { side: 'bride', kind: 'other', link: 'Family friend' },
    ...overrides,
  };
}

/** An existing, unpaired guest — the shape `partnerCandidates()` reads off
 *  the `USER_PROFILE` collection. */
function partnerProfile(overrides: Partial<UserProfileDto> = {}): UserProfileDto {
  return {
    id: 'partner-1',
    firstName: 'Marcos',
    lastName: 'Ibanez',
    preferredLang: UserProfileDto.PreferredLangEnum.EN,
    role: UserProfileDto.RoleEnum.GUEST,
    guestInfo: { relation: { side: 'groom', kind: 'friends', link: 'Best man' } },
    ...overrides,
  };
}

describe('GuestCreateModal (T313 — app-profile-fields/app-relation-fields)', () => {
  let fixture: ComponentFixture<GuestCreateModal>;
  let createSpy: ReturnType<typeof vi.fn>;
  let addPartnerSpy: ReturnType<typeof vi.fn>;

  async function open(): Promise<void> {
    createSpy = vi.fn(() => of(createdGuest()));
    addPartnerSpy = vi.fn(() => of(createdGuest()));

    await TestBed.configureTestingModule({
      imports: [GuestCreateModal],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          provide: WeddingGuestsService,
          useValue: {
            guestsControllerCreateV1: createSpy,
            guestsControllerAddPartnerV1: addPartnerSpy,
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    fixture = TestBed.createComponent(GuestCreateModal);
    fixture.componentInstance.open();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** `app-profile-fields` renders firstName/lastName/nickname/email/phone, in
   *  that DOM order (T310), followed by `app-relation-fields`'s own
   *  side/kind/link block — same ordering `profile-fields.spec.ts` (T310)
   *  already asserts. */
  function profileInputs(): HTMLInputElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('input[app-input]') as NodeListOf<HTMLInputElement>,
    );
  }

  function relationFieldsEl(): HTMLElement {
    return fixture.nativeElement.querySelector('app-relation-fields') as HTMLElement;
  }

  /** The group(kind) `seg-row` — the only one with 4 options (family/friends/
   *  colleagues/other); side (3) and preferred-language (3) are the others. */
  function kindSegRow(): HTMLElement {
    const segRows = Array.from(
      fixture.nativeElement.querySelectorAll('.seg-row') as NodeListOf<HTMLElement>,
    );
    return segRows.find((row) => row.querySelectorAll('button').length === 4)!;
  }

  function selectKind(kind: 'family' | 'friends' | 'colleagues' | 'other'): void {
    const order = ['family', 'friends', 'colleagues', 'other'];
    const buttons = kindSegRow().querySelectorAll('button');
    (buttons[order.indexOf(kind)] as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  /** `app-profile-fields`/`app-relation-fields` are "controlled" components —
   *  each keystroke's `valueChange` only reaches the child's next render via
   *  the host's `[value]` binding, which needs a change-detection pass to
   *  push through. So every edit here round-trips with its own
   *  `detectChanges()` before the next one fires — otherwise a second edit's
   *  `{ ...this.value(), … }` spread reads the *previous* render's stale
   *  `value()`, clobbering the first edit (same risk a real double-keystroke
   *  inside one browser task would not hit, since each keystroke is its own
   *  task with its own Angular change-detection pass in between). */
  function setValue(el: HTMLInputElement, value: string): void {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Fills every field the create form requires — DS "New guest" draft, minus
   *  the partner link. "other" kind so `link` is free text and no `<select>`
   *  interaction is needed. */
  async function fillRequiredFields(): Promise<void> {
    selectKind('other');

    const inputs = profileInputs();
    setValue(inputs[0], 'Laura'); // firstName
    setValue(inputs[1], 'Mendoza'); // lastName

    const phone = fixture.nativeElement.querySelector(
      'input[app-input][type="tel"]',
    ) as HTMLInputElement | null;
    if (phone) setValue(phone, '+34600000000');

    const link = relationFieldsEl().querySelector('input[app-input]') as HTMLInputElement | null;
    if (link) setValue(link, 'Family friend');

    fixture.detectChanges();
    await fixture.whenStable();
  }

  function nicknameInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      'input[app-input][maxlength="30"]',
    ) as HTMLInputElement;
  }

  function submit(): void {
    (
      fixture.nativeElement.querySelectorAll('button[app-btn][modal-actions]')[1] as HTMLButtonElement
    ).click();
    fixture.detectChanges();
  }

  it('renders lockContact off — email/phone stay editable controls', async () => {
    await open();

    const email = fixture.nativeElement.querySelector('input[app-input][type="email"]');
    const phone = fixture.nativeElement.querySelector('input[app-input][type="tel"]');
    expect(email).toBeTruthy();
    expect(phone).toBeTruthy();
    // lockContact renders a static `.value` row instead — none present here.
    expect(fixture.nativeElement.querySelector('.value')).toBeNull();
  });

  it('renders showRelation on — app-relation-fields is composed', async () => {
    await open();

    expect(fixture.nativeElement.querySelector('app-relation-fields')).toBeTruthy();
  });

  it('sends a typed nickname through to CreateGuestDto', async () => {
    await open();
    await fillRequiredFields();

    const nickname = nicknameInput();
    nickname.value = 'Lau';
    nickname.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    submit();

    const dto = createSpy.mock.calls[0][0].createGuestDto as CreateGuestDto;
    expect(dto.nickname).toBe('Lau');
  });

  it('omits the nickname (undefined, never "") when left blank', async () => {
    await open();
    await fillRequiredFields();

    submit();

    const dto = createSpy.mock.calls[0][0].createGuestDto as CreateGuestDto;
    expect(dto.nickname).toBeUndefined();
    expect(dto).not.toEqual(expect.objectContaining({ nickname: '' }));
  });

  it('clamps the nickname input to 30 characters', async () => {
    await open();
    await fillRequiredFields();

    const nickname = nicknameInput();
    nickname.value = 'AVeryLongNicknameThatIsDefinitelyOverThirtyChars';
    nickname.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(nicknameInput().value.length).toBe(30);
  });

  it('blocks create when required fields are missing', async () => {
    await open();

    submit();

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('shapes a family relation into CreateGuestDtoRelation with the select link', async () => {
    await open();

    // Family is the default kind — its link is a `<select>`, not a text input.
    const inputs = profileInputs();
    setValue(inputs[0], 'Laura');
    setValue(inputs[1], 'Mendoza');
    const phone = fixture.nativeElement.querySelector(
      'input[app-input][type="tel"]',
    ) as HTMLInputElement;
    setValue(phone, '+34600000000');

    const select = relationFieldsEl().querySelector('select.select-native') as HTMLSelectElement;
    select.value = GuestListResponseDtoItemsInnerRelationOneOf.LinkEnum.SISTER;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    submit();

    const dto = createSpy.mock.calls[0][0].createGuestDto as CreateGuestDto;
    expect(dto.relation).toEqual<CreateGuestDtoRelation>({
      side: SideEnum.BRIDE,
      kind: 'family',
      link: GuestListResponseDtoItemsInnerRelationOneOf.LinkEnum.SISTER,
    });
  });

  it('shapes a non-family relation into CreateGuestDtoRelation with free-text link', async () => {
    await open();
    await fillRequiredFields();

    submit();

    const dto = createSpy.mock.calls[0][0].createGuestDto as CreateGuestDto;
    expect(dto.relation).toEqual<CreateGuestDtoRelation>({
      side: SideEnum.BRIDE,
      kind: 'other',
      link: 'Family friend',
    });
  });

  it('partner-linking section: toggling on renders the existing-guest picker unaffected', async () => {
    await open();

    const collection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
    collection.addOneToCache(partnerProfile());
    fixture.detectChanges();

    const toggle = fixture.nativeElement.querySelector(
      'button[app-toggle]',
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.partner-card')).toBeTruthy();
    const candidate = fixture.nativeElement.querySelector('.candidate') as HTMLButtonElement;
    expect(candidate?.textContent).toContain('Marcos Ibanez');
  });

  it('partner-linking section: creates the guest then links the selected candidate', async () => {
    await open();

    const collection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
    collection.addOneToCache(partnerProfile());
    fixture.detectChanges();

    await fillRequiredFields();

    const toggle = fixture.nativeElement.querySelector(
      'button[app-toggle]',
    ) as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();

    const candidate = fixture.nativeElement.querySelector('.candidate') as HTMLButtonElement;
    candidate.click();
    fixture.detectChanges();

    submit();

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(addPartnerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-guest-1', partnerId: 'partner-1' }),
    );
  });
});
