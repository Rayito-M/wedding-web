import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  CreateGuestDto,
  GuestDto,
  WeddingGuestsService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { GuestCreateModal } from './guest-create-modal';

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

describe('GuestCreateModal — nickname (T300)', () => {
  let fixture: ComponentFixture<GuestCreateModal>;
  let createSpy: ReturnType<typeof vi.fn>;

  async function open(): Promise<void> {
    createSpy = vi.fn(() => of(createdGuest()));

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
            guestsControllerAddPartnerV1: vi.fn(() => of(createdGuest())),
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

  /** Fills every field the create form requires — DS "New guest" draft, minus
   *  the partner link (left off, "other" kind so `link` is free text and no
   *  `<select>` interaction is needed). */
  async function fillRequiredFields(): Promise<void> {
    // "Other" kind — the group `seg-row` (4 options: family/friends/colleagues/
    // other) — its last button makes `link` a free-text input instead of a
    // family-relation `<select>`.
    const segRows = Array.from(
      fixture.nativeElement.querySelectorAll('.seg-row') as NodeListOf<HTMLElement>,
    );
    const kindRow = segRows.find((row) => row.querySelectorAll('button').length === 4);
    const kindButtons = kindRow!.querySelectorAll('button');
    (kindButtons[3] as HTMLButtonElement).click();
    fixture.detectChanges();

    const inputs: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll(
      'input[app-input], input.select-native',
    );
    const byPlaceholder = (placeholder: string): HTMLInputElement | undefined =>
      Array.from(fixture.nativeElement.querySelectorAll('input[app-input]') as NodeListOf<
        HTMLInputElement
      >).find((el) => el.placeholder === placeholder);

    const setValue = (el: HTMLInputElement, value: string) => {
      el.value = value;
      el.dispatchEvent(new Event('input'));
    };

    const firstName = inputs[0];
    setValue(firstName, 'Laura');
    const lastName = inputs[1];
    setValue(lastName, 'Mendoza');

    const phone = byPlaceholder('+34 600 00 00 00');
    if (phone) setValue(phone, '+34600000000');

    const link = fixture.nativeElement.querySelector(
      'input[formcontrolname="link"]',
    ) as HTMLInputElement | null;
    if (link) setValue(link, 'Family friend');

    fixture.detectChanges();
    await fixture.whenStable();
  }

  function nicknameInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector(
      'input[formcontrolname="nickname"]',
    ) as HTMLInputElement;
  }

  function submit(): void {
    (
      fixture.nativeElement.querySelectorAll('button[app-btn][modal-actions]')[1] as HTMLButtonElement
    ).click();
    fixture.detectChanges();
  }

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

  it('clamps the nickname input to 8 characters', async () => {
    await open();
    await fillRequiredFields();

    const nickname = nicknameInput();
    nickname.value = 'AVeryLongNickname';
    nickname.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(nicknameInput().value).toBe('AVeryLon');
  });
});
