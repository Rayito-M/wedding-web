import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  UpdateUserProfileDto,
  UserProfileDto,
  WeddingUserProfileService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { GuestProfileModal } from './guest-profile-modal';

function guest(overrides: Partial<UserProfileDto> = {}): UserProfileDto {
  return {
    id: 'guest-1',
    firstName: 'Laura',
    lastName: 'Mendoza',
    preferredLang: UserProfileDto.PreferredLangEnum.EN,
    role: UserProfileDto.RoleEnum.GUEST,
    guestInfo: { relation: { side: 'bride', kind: 'family', link: 'sister' } },
    ...overrides,
  };
}

describe('GuestProfileModal — nickname (T300)', () => {
  let fixture: ComponentFixture<GuestProfileModal>;
  let updateSpy: ReturnType<typeof vi.fn>;

  async function open(profile: UserProfileDto): Promise<void> {
    updateSpy = vi.fn((params: { updateUserProfileDto: UpdateUserProfileDto }) =>
      of({ ...profile, ...params.updateUserProfileDto } as UserProfileDto),
    );

    await TestBed.configureTestingModule({
      imports: [GuestProfileModal],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          provide: WeddingUserProfileService,
          useValue: { profileControllerUpdateProfileByIdV1: updateSpy },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    TestBed.inject(EntityServices)
      .getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE)
      .addOneToCache(profile);

    fixture = TestBed.createComponent(GuestProfileModal);
    fixture.componentInstance.open(profile.id);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function startEdit(): void {
    const editBtn = Array.from(
      fixture.nativeElement.querySelectorAll('.actions-row button[app-btn]') as NodeListOf<
        HTMLButtonElement
      >,
    )[0];
    editBtn.click();
    fixture.detectChanges();
  }

  // `app-profile-fields` renders plain `input[app-input]` elements — no
  // `formControlName` to key off any more (T311 replaced `editForm` with a
  // draft signal). The nickname input is the only text field carrying a
  // `maxlength` attribute (`app-profile-fields`' 30-char clamp), so that's
  // the reliable locator; `lockContact` renders email/phone as static `.value`
  // rows, not inputs, so firstName/lastName/nickname are the only three
  // `type="text"` inputs in identity order.
  function textInputs(): HTMLInputElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('input[app-input][type="text"]'),
    ) as HTMLInputElement[];
  }

  function firstNameInput(): HTMLInputElement {
    return textInputs()[0];
  }

  function nicknameInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      'input[app-input][maxlength]',
    ) as HTMLInputElement;
  }

  function saveProfile(): void {
    const saveBtn = fixture.nativeElement.querySelectorAll(
      'button[app-btn][modal-actions]',
    )[1] as HTMLButtonElement;
    saveBtn.click();
    fixture.detectChanges();
  }

  it('shows the nickname in quotes in the read-only profile view, without replacing the name', async () => {
    await open(guest({ nickname: 'Lau' }));

    const value = fixture.nativeElement.querySelector(
      '.info-grid .info-item:nth-child(3) .value',
    ) as HTMLElement;
    expect(value.textContent?.trim()).toBe('“Lau”');
    expect(
      (fixture.nativeElement.querySelector('h2.modal-title') as HTMLElement).textContent?.trim(),
    ).toBe('Laura Mendoza');
  });

  it('shows a placeholder when there is no nickname', async () => {
    await open(guest());

    const value = fixture.nativeElement.querySelector(
      '.info-grid .info-item:nth-child(3) .value',
    ) as HTMLElement;
    expect(value.textContent?.trim()).toBe('—');
  });

  it('seeds the edit form from the current nickname and round-trips an edit', async () => {
    await open(guest({ nickname: 'Lau' }));
    startEdit();

    expect(nicknameInput().value).toBe('Lau');

    nicknameInput().value = 'Lu';
    nicknameInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    saveProfile();

    const dto = updateSpy.mock.calls[0][0].updateUserProfileDto as UpdateUserProfileDto;
    expect(dto.nickname).toBe('Lu');
  });

  it('clears a nickname to undefined, never "", when the field is emptied', async () => {
    await open(guest({ nickname: 'Lau' }));
    startEdit();

    nicknameInput().value = '';
    nicknameInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    saveProfile();

    const dto = updateSpy.mock.calls[0][0].updateUserProfileDto as UpdateUserProfileDto;
    expect(dto.nickname).toBeUndefined();
    expect(dto).not.toEqual(expect.objectContaining({ nickname: '' }));
  });

  it('clamps the nickname input to 30 characters (T307/T310, up from the old 8-char cap)', async () => {
    await open(guest());
    startEdit();

    nicknameInput().value = 'A'.repeat(40);
    nicknameInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(nicknameInput().value).toBe('A'.repeat(30));
  });

  it('required firstName/lastName/link still block save (validation re-homed to saveProfile())', async () => {
    await open(guest({ firstName: 'Laura', lastName: 'Mendoza' }));
    startEdit();

    firstNameInput().value = '';
    firstNameInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    saveProfile();

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('a family relation kind sends the selected LinkEnum member as `link`', async () => {
    await open(
      guest({ guestInfo: { relation: { side: 'bride', kind: 'family', link: 'sister' } } }),
    );
    startEdit();

    saveProfile();

    const dto = updateSpy.mock.calls[0][0].updateUserProfileDto as UpdateUserProfileDto;
    expect(dto.relation).toEqual({ side: 'bride', kind: 'family', link: 'sister' });
  });

  it('a non-family relation kind sends free-text `link` unchanged', async () => {
    await open(
      guest({ guestInfo: { relation: { side: 'groom', kind: 'friends', link: 'College roommate' } } }),
    );
    startEdit();

    saveProfile();

    const dto = updateSpy.mock.calls[0][0].updateUserProfileDto as UpdateUserProfileDto;
    expect(dto.relation).toEqual({ side: 'groom', kind: 'friends', link: 'College roommate' });
  });
});

describe('GuestProfileModal — open into edit mode (T308)', () => {
  let fixture: ComponentFixture<GuestProfileModal>;

  async function setUp(profile: UserProfileDto): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [GuestProfileModal],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          provide: WeddingUserProfileService,
          useValue: { profileControllerUpdateProfileByIdV1: vi.fn() },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {}, true);

    TestBed.inject(EntityServices)
      .getEntityCollectionService<UserProfileDto>(EntityNamesEnum.USER_PROFILE)
      .addOneToCache(profile);

    fixture = TestBed.createComponent(GuestProfileModal);
  }

  function eyebrowText(): string | undefined {
    return (fixture.nativeElement.querySelector('.modal-eyebrow') as HTMLElement).textContent
      ?.trim()
      .split('·')[0]
      .trim();
  }

  // `app-profile-fields`/`app-relation-fields` render plain `input[app-input]`
  // elements, not `formControlName`-keyed ones (T311). `lockContact` renders
  // email/phone as static `.value` rows, so the identity block's `type="text"`
  // inputs are firstName (0), lastName (1), nickname (2, the only one with a
  // `maxlength` attribute); a non-family relation's free-text `link` renders
  // as a further `type="text"` input after those three.
  function textInputs(): HTMLInputElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('input[app-input][type="text"]'),
    ) as HTMLInputElement[];
  }

  function nicknameInput(): HTMLInputElement | null {
    return fixture.nativeElement.querySelector('input[app-input][maxlength]');
  }

  function firstNameInput(): HTMLInputElement | null {
    return textInputs()[0] ?? null;
  }

  function linkInput(): HTMLInputElement | null {
    return textInputs()[3] ?? null;
  }

  /** The selected segmented-control button's text, within the `nth` `.seg-row`
   *  (0 = side, 1 = group/kind) — reflects `editDraft`'s seeded value without
   *  reaching into the protected signal directly. */
  function selectedSeg(nth: number): string | undefined {
    const row = fixture.nativeElement.querySelectorAll('.seg-row')[nth] as HTMLElement;
    const btn = row.querySelector('button[aria-pressed="true"]') as HTMLElement | null;
    return btn?.textContent?.trim();
  }

  it('a normal open() lands read-only-first (unchanged, guest-table row click)', async () => {
    await setUp(guest({ nickname: 'Lau' }));

    fixture.componentInstance.open('guest-1');
    fixture.detectChanges();

    expect(eyebrowText()).toBe('guest_manager.modal.viewProfile');
    expect(nicknameInput()).toBeNull();
  });

  it('open(userId, { edit: true }) lands straight into edit mode, seeded like startEdit()', async () => {
    await setUp(
      guest({
        firstName: 'Laura',
        lastName: 'Mendoza',
        nickname: 'Lau',
        guestInfo: { relation: { side: 'groom', kind: 'friends', link: 'college' } },
      }),
    );

    fixture.componentInstance.open('guest-1', { edit: true });
    fixture.detectChanges();

    expect(eyebrowText()).toBe('guest_manager.modal.editProfile');
    expect(firstNameInput()?.value).toBe('Laura');
    expect(nicknameInput()?.value).toBe('Lau');
    expect(selectedSeg(0)).toBe('guest_manager.relation.side.groom');
    expect(selectedSeg(1)).toBe('guest_manager.relation.kind.friends');
    expect(linkInput()?.value).toBe('college');
  });
});
