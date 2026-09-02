import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EntityCollectionService, EntityServices } from '@ngrx/data';
import { provideEffects } from '@ngrx/effects';
import { provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { EntityNamesEnum, RsvpDto, entityConfig, provideEntityDataServices } from '@app/core';

import { RsvpCreate } from './rsvp-create';

/**
 * An `attending` flag that is **absent**, not `false`.
 *
 * Hub ADR-0040 made `attending` required on every adult member, so a member
 * carrying no flag is no longer constructible — but it is still readable
 * (stored RSVPs are not re-validated on read, ADR-0040 §1; and this bundle
 * outlives any single API deploy, CLAUDE.md hard rule 17). These fixtures keep
 * the shape they were written with, so what they assert is unchanged.
 */
const NO_FLAG = undefined as unknown as boolean;

/**
 * Copy fixture — local so a wording change in `public/i18n/*.json` cannot
 * turn these assertions red. What is under test is *which action sends the
 * reply*: "Send reply" must be the button that PATCHes, and the "See you in
 * June" receipt must only ever be shown once the PATCH has landed (a guest
 * coming alone never touches "Add meals & allergies", so the reply cannot be
 * left hanging behind it).
 */
const TRANSLATIONS = {
  shared: {
    continue: 'Continue',
    back: 'Back',
    nickname: { label: 'Nickname', placeholder: 'e.g. Lau', hint: 'Max 30 characters' },
  },
  rsvp: {
    header: 'RSVP',
    create: {
      step: 'STEP {{current}}/{{total}}',
      attending: {
        title: 'Will you join us?',
        yes: 'With joy',
        no: 'Sadly no',
        withPartner: 'With my partner',
        withChildren: 'With children',
      },
      party: { title: 'Your party', firstName: 'First name', lastName: 'Last name' },
      confirm: {
        yesTitle: 'See you in June',
        noTitle: "You'll be missed",
        yesMessage: 'Your reply is in.',
        noMessage: 'Thank you for letting us know.',
      },
      actions: { send: 'Send reply', addMeals: 'Add meals & allergies', done: 'Done' },
      error: 'Something went wrong sending your reply.',
    },
  },
};

/** The `pending` record the orchestrator has already provisioned — a guest
 *  with no linked partner and no children, i.e. the case that never reached
 *  the API before. */
function pendingRsvp(): RsvpDto {
  return {
    id: 'rsvp-1',
    version: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    status: RsvpDto.StatusEnum.PENDING,
    adults: {
      partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: NO_FLAG },
    },
    children: [],
    submittedBy: 'guest-1',
  };
}

describe('RsvpCreate', () => {
  let fixture: ComponentFixture<RsvpCreate>;
  let component: RsvpCreate;
  let collection: EntityCollectionService<RsvpDto>;
  let update: ReturnType<typeof vi.spyOn>;

  async function create(rsvp = pendingRsvp()): Promise<void> {
    fixture = TestBed.createComponent(RsvpCreate);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('rsvp', rsvp);
    await fixture.whenStable();
  }

  function text(): string {
    return (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  /** The footer's primary action — the last `app-btn`, since "Back" precedes it. */
  function primaryButton(): HTMLButtonElement {
    const buttons = fixture.nativeElement.querySelectorAll('footer button[app-btn]');
    return buttons[buttons.length - 1] as HTMLButtonElement;
  }

  function primaryLabel(): string {
    return (primaryButton().textContent ?? '').trim();
  }

  async function clickPrimary(): Promise<void> {
    primaryButton().click();
    await fixture.whenStable();
  }

  async function click(selector: string, index = 0): Promise<void> {
    (fixture.nativeElement.querySelectorAll(selector)[index] as HTMLElement).click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RsvpCreate],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', TRANSLATIONS, true);

    collection = TestBed.inject(EntityServices).getEntityCollectionService<RsvpDto>(
      EntityNamesEnum.RSVP,
    );
    collection.clearCache();
    update = vi
      .spyOn(collection, 'update')
      .mockReturnValue(of({ ...pendingRsvp(), status: RsvpDto.StatusEnum.ATTENDING }));
  });

  it('sends the reply from "Send reply" for a guest with no partner and no children', async () => {
    await create();

    await click('button[app-choice-card]', 0); // With joy
    expect(primaryLabel()).toBe('Send reply');
    expect(update).not.toHaveBeenCalled();

    await clickPrimary();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({
      id: 'rsvp-1',
      version: 3,
      status: RsvpDto.StatusEnum.ATTENDING,
      adults: { partner1: { id: 'guest-1' }, partner2: undefined },
      children: undefined,
    });
  });

  it('shows the confirmation only after the reply is saved, and hands on from there', async () => {
    await create();
    const submitted = vi.fn();
    component.submitted.subscribe(submitted);

    await click('button[app-choice-card]', 0);
    expect(text()).not.toContain('See you in June');

    await clickPrimary();

    expect(text()).toContain('See you in June');
    expect(primaryLabel()).toBe('Add meals & allergies');
    expect(submitted).not.toHaveBeenCalled();

    // The receipt's button only hands the guest on — it must not re-PATCH.
    await clickPrimary();

    expect(submitted).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('sends a declined reply straight from the first step', async () => {
    await create();

    await click('button[app-choice-card]', 1); // Sadly no
    expect(primaryLabel()).toBe('Send reply');

    await clickPrimary();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({ status: RsvpDto.StatusEnum.DECLINED });
    expect(text()).toContain("You'll be missed");
    expect(primaryLabel()).toBe('Done');
  });

  it('keeps the party step for a guest bringing someone, and sends from there', async () => {
    await create();

    await click('button[app-choice-card]', 0);
    await click('button[app-toggle]', 0); // With my partner
    expect(primaryLabel()).toBe('Continue');

    await clickPrimary();
    expect(text()).toContain('Your party');
    expect(primaryLabel()).toBe('Send reply');
    // Incomplete party — the send stays gated.
    expect(primaryButton().disabled).toBe(true);

    const [first, last] = fixture.nativeElement.querySelectorAll('input[app-input]');
    (first as HTMLInputElement).value = 'Grace';
    first.dispatchEvent(new Event('input'));
    (last as HTMLInputElement).value = 'Hopper';
    last.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    await clickPrimary();

    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0]).toMatchObject({
      status: RsvpDto.StatusEnum.ATTENDING,
      adults: { partner2: { firstName: 'Grace', lastName: 'Hopper', kind: 'plus-one' } },
    });
    expect(text()).toContain('See you in June');
  });

  describe('nickname (T299)', () => {
    /** A typed-in partner (no `id`) so the name/nickname fields stay editable. */
    async function toPartyStepWithPartner(): Promise<void> {
      await create();
      await click('button[app-choice-card]', 0);
      await click('button[app-toggle]', 0); // With my partner
      await clickPrimary();
    }

    it("submits the partner's nickname trimmed, and omits it when left blank", async () => {
      await toPartyStepWithPartner();
      const [firstName, lastName, nickname] =
        fixture.nativeElement.querySelectorAll('input[app-input]');
      (firstName as HTMLInputElement).value = 'Grace';
      firstName.dispatchEvent(new Event('input'));
      (lastName as HTMLInputElement).value = 'Hopper';
      lastName.dispatchEvent(new Event('input'));
      (nickname as HTMLInputElement).value = '  Gigi ';
      nickname.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      await clickPrimary();

      expect(update.mock.calls[0][0].adults?.partner2).toMatchObject({ nickname: 'Gigi' });

      // Left blank instead: the field is absent from the payload, never sent as "".
      update.mockClear();
      await create();
      await click('button[app-choice-card]', 0);
      await click('button[app-toggle]', 0);
      await clickPrimary();
      const [firstName2, lastName2] = fixture.nativeElement.querySelectorAll('input[app-input]');
      (firstName2 as HTMLInputElement).value = 'Grace';
      firstName2.dispatchEvent(new Event('input'));
      (lastName2 as HTMLInputElement).value = 'Hopper';
      lastName2.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      await clickPrimary();

      const partner2 = update.mock.calls[0][0].adults?.partner2;
      expect(partner2?.nickname).toBeUndefined();
      expect(partner2).not.toEqual(expect.objectContaining({ nickname: '' }));
    });

    it("clamps the partner's nickname input to 30 characters", async () => {
      await toPartyStepWithPartner();
      const [, , nickname] = fixture.nativeElement.querySelectorAll('input[app-input]');
      (nickname as HTMLInputElement).value = 'AVeryLongNicknameThatExceedsThirtyCharacters';
      nickname.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      const [, , clamped] = fixture.nativeElement.querySelectorAll('input[app-input]');
      expect((clamped as HTMLInputElement).value).toBe('AVeryLongNicknameThatExceedsTh');
    });

    it('renders the nickname read-only, never an editable input, for a linked partner', async () => {
      const rsvp: RsvpDto = {
        ...pendingRsvp(),
        adults: {
          partner1: pendingRsvp().adults.partner1,
          partner2: { id: 'guest-2', firstName: 'Grace', lastName: 'Hopper', nickname: 'Gigi', options: {}, kind: 'guest', attending: NO_FLAG },
        },
      };
      await create(rsvp);
      await click('button[app-choice-card]', 0);
      await clickPrimary(); // party step: withPartner is pre-filled true

      const [firstName, lastName, nickname] =
        fixture.nativeElement.querySelectorAll('input[app-input]');
      expect((firstName as HTMLInputElement).disabled).toBe(true);
      expect((lastName as HTMLInputElement).disabled).toBe(true);
      expect((nickname as HTMLInputElement).disabled).toBe(true);
      expect((nickname as HTMLInputElement).value).toBe('Gigi');
    });

    it("submits each child's nickname trimmed, and omits it when left blank", async () => {
      await create();
      await click('button[app-choice-card]', 0);
      await click('button[app-toggle]', 1); // With children
      await clickPrimary();

      const inputs = fixture.nativeElement.querySelectorAll('input[app-input]');
      const [firstName, age, nickname] = inputs; // one child row: name, age, nickname
      (firstName as HTMLInputElement).value = 'Iris';
      firstName.dispatchEvent(new Event('input'));
      (age as HTMLInputElement).value = '7';
      age.dispatchEvent(new Event('input'));
      (nickname as HTMLInputElement).value = ' Iri ';
      nickname.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      await clickPrimary();

      const [child] = update.mock.calls[0][0].children;
      expect(child).toMatchObject({ firstName: 'Iris', age: 7, nickname: 'Iri' });

      // Left blank instead: absent from the payload, never sent as "".
      update.mockClear();
      await create();
      await click('button[app-choice-card]', 0);
      await click('button[app-toggle]', 1);
      await clickPrimary();
      const [firstName2, age2] = fixture.nativeElement.querySelectorAll('input[app-input]');
      (firstName2 as HTMLInputElement).value = 'Iris';
      firstName2.dispatchEvent(new Event('input'));
      (age2 as HTMLInputElement).value = '7';
      age2.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      await clickPrimary();

      const [childBlank] = update.mock.calls[0][0].children;
      expect(childBlank.nickname).toBeUndefined();
      expect(childBlank).not.toEqual(expect.objectContaining({ nickname: '' }));
    });
  });

  it('stays on the form and shows the error when the save fails', async () => {
    update.mockReturnValue(throwError(() => new Error('nope')));
    await create();

    await click('button[app-choice-card]', 0);
    await clickPrimary();

    expect(text()).toContain('Something went wrong sending your reply.');
    expect(text()).not.toContain('See you in June');
    expect(primaryLabel()).toBe('Send reply');
  });
});
