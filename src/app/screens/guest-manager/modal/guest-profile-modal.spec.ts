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

  function nicknameInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      'input[formcontrolname="nickname"]',
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

  it('clamps the nickname input to 8 characters', async () => {
    await open(guest());
    startEdit();

    nicknameInput().value = 'AVeryLongNickname';
    nicknameInput().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(nicknameInput().value).toBe('AVeryLon');
  });
});
