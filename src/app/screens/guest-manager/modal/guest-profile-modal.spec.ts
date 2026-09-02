import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  GuestDto,
  UpdateUserProfileDto,
  UserProfileDto,
  WeddingGuestsService,
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

function guestDoc(overrides: Partial<GuestDto> = {}): GuestDto {
  return {
    id: 'guest-1',
    version: 1,
    firstName: 'Laura',
    lastName: 'Mendoza',
    phoneNumber: '+34600000001',
    role: 'guest',
    preferredLang: GuestDto.PreferredLangEnum.EN,
    relation: { side: 'bride', kind: 'family', link: 'sister' },
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
    expect(selectedSeg(0)).toBe('relation.side.groom');
    expect(selectedSeg(1)).toBe('relation.kind.friends');
    expect(linkInput()?.value).toBe('college');
  });
});

describe('GuestProfileModal — RSVP delegation (hub ADR-0039, T335)', () => {
  let fixture: ComponentFixture<GuestProfileModal>;
  let getSpy: ReturnType<typeof vi.fn>;
  let updateGuestSpy: ReturnType<typeof vi.fn>;

  async function setUp(
    doc: GuestDto,
    profiles: UserProfileDto[],
    options: { getGuest?: () => Observable<GuestDto>; updateGuest?: ReturnType<typeof vi.fn> } = {},
  ): Promise<void> {
    getSpy = vi.fn(options.getGuest ?? (() => of(doc)));
    updateGuestSpy =
      options.updateGuest ??
      vi.fn((params: { updateGuestDto: { delegateTo?: unknown } }) =>
        of({ ...doc, delegateTo: params.updateGuestDto.delegateTo, version: doc.version + 1 } as GuestDto),
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
          useValue: {
            profileControllerUpdateProfileByIdV1: vi.fn((params: { updateUserProfileDto: unknown }) =>
              of({ ...profiles[0], ...(params.updateUserProfileDto as object) } as UserProfileDto),
            ),
          },
        },
        {
          provide: WeddingGuestsService,
          useValue: {
            guestsControllerGetV1: getSpy,
            guestsControllerUpdateV1: updateGuestSpy,
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation(
      'en',
      {
        delegation: {
          kind: { father: 'Father', mother: 'Mother', brother: 'Brother', sister: 'Sister' },
          field: {
            kindRequiredHint: 'Choose what {{name}} is to this guest before saving.',
            kindPrompt: 'What is {{name}} to this guest?',
          },
        },
      },
      true,
    );

    const profileCollection = TestBed.inject(EntityServices).getEntityCollectionService<UserProfileDto>(
      EntityNamesEnum.USER_PROFILE,
    );
    for (const p of profiles) profileCollection.addOneToCache(p);

    fixture = TestBed.createComponent(GuestProfileModal);
    fixture.componentInstance.open(doc.id);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function startEdit(): void {
    const editBtn = Array.from(
      fixture.nativeElement.querySelectorAll('.actions-row button[app-btn]') as NodeListOf<HTMLButtonElement>,
    )[0];
    editBtn.click();
    fixture.detectChanges();
  }

  function saveProfile(): void {
    const saveBtn = fixture.nativeElement.querySelectorAll(
      'button[app-btn][modal-actions]',
    )[1] as HTMLButtonElement;
    saveBtn.click();
    fixture.detectChanges();
  }

  function searchInput(): HTMLInputElement {
    return fixture.nativeElement.querySelector('.delegation-search') as HTMLInputElement;
  }

  function typeSearch(query: string): void {
    const input = searchInput();
    input.value = query;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function candidateButtons(): HTMLButtonElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.candidate')) as HTMLButtonElement[];
  }

  function kindSelect(): HTMLSelectElement | null {
    return fixture.nativeElement.querySelector('.kind-picker select');
  }

  function chooseKind(kind: string): void {
    const select = kindSelect()!;
    select.value = kind;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('view mode renders name + kind, subject-side, for every stored delegate', async () => {
    await setUp(
      guestDoc({ delegateTo: [{ id: 'delegate-1', kind: 'sister' }] }),
      [guest({ id: 'guest-1' }), guest({ id: 'delegate-1', firstName: 'Ana', lastName: 'Ruiz' })],
    );

    const chip = fixture.nativeElement.querySelector('.info-item.span-2 .delegate-chip') as HTMLElement;
    expect(chip.textContent).toContain('Ana Ruiz · Sister');
    // Read-only: no picker, no remove control outside edit mode.
    expect(fixture.nativeElement.querySelector('.delegation-search')).toBeNull();
    expect(fixture.nativeElement.querySelector('.info-item.span-2 .chip-remove')).toBeNull();
  });

  it('view mode shows "—" when nobody answers for this guest', async () => {
    await setUp(guestDoc(), [guest({ id: 'guest-1' })]);

    const cell = fixture.nativeElement.querySelector('.info-item.span-2 .chip-empty') as HTMLElement;
    expect(cell.textContent?.trim()).toBe('—');
  });

  it('search excludes self and already-picked, caps at 8, and picking a name opens the kind step', async () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      guest({ id: `cand-${i}`, firstName: 'Ana', lastName: `Ruiz${i}` }),
    );
    await setUp(guestDoc(), [guest({ id: 'guest-1', firstName: 'Ana', lastName: 'Self' }), ...candidates]);
    startEdit();

    typeSearch('ana');

    // Self is never offered, and the list caps at 8 (T335 acceptance).
    expect(candidateButtons().length).toBe(8);
    expect(kindSelect()).toBeNull();

    candidateButtons()[0].click();
    fixture.detectChanges();

    expect(kindSelect()).not.toBeNull();
    // Picking a name alone never adds a chip — the kind step is mandatory.
    expect(fixture.nativeElement.querySelectorAll('.delegate-chip').length).toBe(0);
  });

  it('"No matching guests." shows for a query with no candidates', async () => {
    await setUp(guestDoc(), [guest({ id: 'guest-1' })]);
    startEdit();

    typeSearch('nobody-like-this');

    expect(fixture.nativeElement.querySelector('.candidate-empty')).not.toBeNull();
  });

  it('the required-kind gate: Save is blocked with a name picked and no kind chosen', async () => {
    await setUp(guestDoc(), [
      guest({ id: 'guest-1' }),
      guest({ id: 'delegate-1', firstName: 'Ana', lastName: 'Ruiz' }),
    ]);
    startEdit();
    typeSearch('ana');
    candidateButtons()[0].click();
    fixture.detectChanges();

    saveProfile();

    expect(updateGuestSpy).not.toHaveBeenCalled();
    const hint = fixture.nativeElement.querySelector('.delegation-field .field-error') as HTMLElement;
    expect(hint.textContent?.trim()).toBe('Choose what Ana Ruiz is to this guest before saving.');
    // The pending pick is not silently dropped — the kind step is still open.
    expect(kindSelect()).not.toBeNull();
  });

  it('choosing a kind adds the chip; Save writes delegateTo through PATCH /v1/guests/:id', async () => {
    await setUp(guestDoc({ version: 3 }), [
      guest({ id: 'guest-1' }),
      guest({ id: 'delegate-1', firstName: 'Ana', lastName: 'Ruiz' }),
    ]);
    startEdit();
    typeSearch('ana');
    candidateButtons()[0].click();
    fixture.detectChanges();
    chooseKind('sister');

    expect(fixture.nativeElement.querySelector('.delegate-chip')?.textContent).toContain('Ana Ruiz · Sister');

    saveProfile();

    expect(updateGuestSpy).toHaveBeenCalledWith({
      id: 'guest-1',
      updateGuestDto: {
        id: 'guest-1',
        version: 3,
        delegateTo: [{ id: 'delegate-1', kind: 'sister' }],
      },
    });
  });

  it('removing an existing delegate and saving sends the reduced list', async () => {
    await setUp(guestDoc({ delegateTo: [{ id: 'delegate-1', kind: 'sister' }] }), [
      guest({ id: 'guest-1' }),
      guest({ id: 'delegate-1', firstName: 'Ana', lastName: 'Ruiz' }),
    ]);
    startEdit();

    const removeBtn = fixture.nativeElement.querySelector(
      '.delegation-field .chip-remove',
    ) as HTMLButtonElement;
    removeBtn.click();
    fixture.detectChanges();

    saveProfile();

    expect(updateGuestSpy).toHaveBeenCalledWith(
      expect.objectContaining({ updateGuestDto: expect.objectContaining({ delegateTo: [] }) }),
    );
  });

  it('never writes delegateTo when nothing changed', async () => {
    await setUp(guestDoc({ delegateTo: [{ id: 'delegate-1', kind: 'sister' }] }), [
      guest({ id: 'guest-1' }),
      guest({ id: 'delegate-1', firstName: 'Ana', lastName: 'Ruiz' }),
    ]);
    startEdit();

    saveProfile();

    expect(updateGuestSpy).not.toHaveBeenCalled();
  });

  it('shows a loading state while the guest document is being fetched', async () => {
    const pending = new Subject<GuestDto>();
    await setUp(guestDoc(), [guest({ id: 'guest-1' })], { getGuest: () => pending });
    startEdit();

    expect(fixture.nativeElement.textContent).toContain('delegation.field.loading');
    expect(fixture.nativeElement.querySelector('.delegation-search')).toBeNull();

    pending.next(guestDoc());
    pending.complete();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('delegation.field.loading');
  });

  it('shows an error state with a retry when the fetch fails, and retry re-fetches', async () => {
    await setUp(guestDoc(), [guest({ id: 'guest-1' })], {
      getGuest: () => throwError(() => new HttpErrorResponse({ status: 500 })),
    });
    startEdit();

    expect(fixture.nativeElement.textContent).toContain('delegation.field.error');

    getSpy.mockImplementation(() => of(guestDoc()));
    const retryBtn = fixture.nativeElement.querySelector('.delegation-retry') as HTMLButtonElement;
    retryBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(getSpy).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).not.toContain('delegation.field.error');
  });

  it('a 409 on the delegation write re-fetches the guest and discards the draft, staying in edit mode', async () => {
    const conflict = new HttpErrorResponse({ status: 409 });
    await setUp(guestDoc({ version: 1 }), [
      guest({ id: 'guest-1' }),
      guest({ id: 'delegate-1', firstName: 'Ana', lastName: 'Ruiz' }),
    ]);
    updateGuestSpy.mockImplementation(() => throwError(() => conflict));
    startEdit();
    typeSearch('ana');
    candidateButtons()[0].click();
    fixture.detectChanges();
    chooseKind('sister');

    saveProfile();
    await fixture.whenStable();
    fixture.detectChanges();

    // Re-read, not a blind retry (mirrors `milestones.ts`'s 409 handling).
    expect(getSpy).toHaveBeenCalledTimes(2);
    // Still in edit mode — the couple can redo the grant against the fresh copy.
    expect(fixture.nativeElement.querySelector('.delegation-field')).not.toBeNull();
  });
});
