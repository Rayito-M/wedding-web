import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterLink, provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  UserProfileDto,
  WeddingConfigPublicResponseDto,
  WeddingConfigPublicResponseDtoMainVenue,
  WeddingConfigurationService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { ProfileModal } from './profile-modal';

const PUBLIC_CONFIG: WeddingConfigPublicResponseDto = {
  id: 'config',
  version: 1,
  brideName: 'Sara',
  groomName: 'Christophe',
  tagline: '',
  date: '2027-06-05',
  language: { es: 'Español', en: 'English', fr: 'Français' },
  themeId: WeddingConfigPublicResponseDto.ThemeIdEnum.TERRACOTTA,
  city: 'Granada',
  country: 'Spain',
  rsvpDeadline: '2027-05-01',
  mainVenue: {
    id: 'venue-1',
    name: 'Palacio de los Córdova',
    country: 'Spain',
    city: 'Granada',
    postalCode: '18001',
    address: 'Calle Real 1',
    mapUrl: '',
    type: WeddingConfigPublicResponseDtoMainVenue.TypeEnum.CEREMONY,
  },
};

function profile(overrides: Partial<UserProfileDto> = {}): UserProfileDto {
  return {
    id: 'u3',
    firstName: 'Laura',
    lastName: 'Ortega',
    nickname: 'Lau',
    email: 'laura.ortega@example.com',
    phoneNumber: '+34 655 908 771',
    preferredLang: UserProfileDto.PreferredLangEnum.ES,
    role: UserProfileDto.RoleEnum.GUEST,
    ...overrides,
  };
}

describe('ProfileModal', () => {
  let fixture: ComponentFixture<ProfileModal>;
  let closed: number;
  let saved: unknown[];

  async function create(inputs: Record<string, unknown> = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProfileModal],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        {
          provide: WeddingConfigurationService,
          useValue: { weddingConfigControllerGetPublicV1: () => of(PUBLIC_CONFIG) },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation(
      'en',
      {
        shared: { myProfile: 'My profile', cancel: 'Cancel', nickname: { label: 'Nickname' } },
        roles: { guest: 'Guest', bride: 'Bride', groom: 'Groom' },
        nav: { people: 'Contacts' },
        profileModal: {
          actions: {
            editProfile: 'Edit profile',
            saveChanges: 'Save changes',
            saved: 'Saved.',
            error: "Couldn't save. Try again.",
          },
        },
      },
      true,
    );

    fixture = TestBed.createComponent(ProfileModal);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('profile', profile());
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    closed = 0;
    saved = [];
    fixture.componentInstance.close.subscribe(() => closed++);
    fixture.componentInstance.save.subscribe((payload) => saved.push(payload));
    await fixture.whenStable();
  }

  function query<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  function findButton(label: string): HTMLButtonElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (b) => (b as HTMLButtonElement).textContent?.trim() === label,
    ) as HTMLButtonElement | undefined;
  }

  it('emits close on Escape', async () => {
    await create();
    fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(closed).toBe(1);
  });

  it('emits close on a backdrop click', async () => {
    await create();
    query<HTMLElement>('.modal-backdrop')!.click();
    expect(closed).toBe(1);
  });

  it('emits only the writable fields on save — never email or phone', async () => {
    await create();
    findButton('Edit profile')!.click();
    await fixture.whenStable();

    findButton('Save changes')!.click();
    await fixture.whenStable();

    expect(saved.length).toBe(1);
    expect(saved[0]).toEqual({
      firstName: 'Laura',
      lastName: 'Ortega',
      nickname: 'Lau',
      preferredLang: 'es',
    });
    expect(Object.keys(saved[0] as object)).not.toContain('email');
    expect(Object.keys(saved[0] as object)).not.toContain('phoneNumber');
  });

  it('exits edit mode and shows "Saved." once the host reports a successful save (T305)', async () => {
    await create();
    findButton('Edit profile')!.click();
    await fixture.whenStable();
    findButton('Save changes')!.click();
    await fixture.whenStable();

    // Still editing: this component never calls the API itself — it waits
    // for the host to report the outcome through `saving`/`saveError`.
    expect(findButton('Save changes')).toBeTruthy();

    // Host starts the async update…
    fixture.componentRef.setInput('saving', true);
    await fixture.whenStable();
    // …and it succeeds.
    fixture.componentRef.setInput('saving', false);
    await fixture.whenStable();

    expect(findButton('Save changes')).toBeUndefined();
    expect(query('.saved')?.textContent?.trim()).toBe('Saved.');
  });

  it('a failed save (host sets saveError) leaves the modal in edit mode with an error shown (T305)', async () => {
    await create();
    findButton('Edit profile')!.click();
    await fixture.whenStable();
    findButton('Save changes')!.click();
    await fixture.whenStable();

    // Host starts the async update…
    fixture.componentRef.setInput('saving', true);
    await fixture.whenStable();
    // …and it fails.
    fixture.componentRef.setInput('saveError', true);
    fixture.componentRef.setInput('saving', false);
    await fixture.whenStable();

    expect(findButton('Save changes')).toBeTruthy();
    expect(findButton('Edit profile')).toBeUndefined();
    expect(query('.error')?.textContent?.trim()).toBe("Couldn't save. Try again.");
    expect(query('.saved')).toBeNull();
  });

  it('renders the People link as a real routerLink, not a (click) handler', async () => {
    await create();
    const linkDe = fixture.debugElement.query(By.directive(RouterLink));
    expect(linkDe).toBeTruthy();
    expect(linkDe.injector.get(RouterLink).href).toBe('/people');
    const anchor = linkDe.nativeElement as HTMLAnchorElement;
    expect(anchor.getAttribute('onclick')).toBeNull();
  });

  it('renders nothing when open is false', async () => {
    await create({ open: false });
    expect(query('[role="dialog"]')).toBeNull();
  });
});
