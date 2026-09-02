import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  RsvpDraft,
  RsvpDto,
  WeddingConfigResponseDto,
  entityConfig,
  fromRsvpDraft,
  provideEntityDataServices,
  toRsvpDraft,
} from '@app/core';

import { RsvpEditor } from './rsvp-editor';

/**
 * Copy fixture — the shipped English for the handful of keys these tests read
 * back out of the DOM. Kept local so a copy change in `public/i18n/*.json`
 * cannot silently turn these assertions red; what is under test is that the
 * component asks for the *right key*, not what the key says.
 */
const TRANSLATIONS = {
  shared: {
    remove: 'Remove',
    partner: { nameManaged: 'Name managed by their own guest account.' },
    nickname: { hint: 'Max 30 characters' },
  },
  rsvp: {
    editor: {
      attendingLabel: 'Attending?',
      total: 'Total: {{count}}',
      attendingOfTotal: 'Attending: {{attending}} of {{total}}',
      choice: { attending: 'With joy', pending: 'Pending', declined: 'Sadly no' },
      attending: {
        sectionLabel: 'Attending',
        label: '{{name}} will be there',
        fallbackName: 'They',
        hint: {
          coming:
            'Switch this off if they cannot make it — their account, meal and allergy details stay, so they can be switched back any time.',
          comingPlusOne:
            'Switch this off if they cannot make it — their name, meal and allergy details stay, so they can be switched back any time.',
          declined: 'They stay on this RSVP and can be switched back to attending right up to the day.',
        },
      },
      person: {
        openProfile: 'Open their profile',
        notAttending: 'Not attending',
        nicknameLabel: 'Nickname',
        nicknamePlaceholder: 'e.g. Ju',
        nicknamePlaceholderChild: 'e.g. Teo',
        customAllergy: { label: 'Anything else?', placeholder: 'Type an allergy…', remove: 'Remove {{name}}' },
      },
      remove: {
        titlePartner: 'Remove the partner?',
        titleChild: 'Remove this child?',
        message:
          '{{name}} will be taken off the RSVP, along with their meal and allergy details. This cannot be undone once saved.',
        fallbackPartner: 'This partner',
        fallbackChild: 'This child',
        keep: 'Keep',
      },
      perspective: {
        owner: { party: 'Your party', primaryHint: 'You', partyMeta: 'Party · dietary & allergies', note: 'A note for us (optional)', notePlaceholder: 'A song to dance to, a memory…', addPartner: '+ Add my partner', addChild: '+ Add a child', declinedHint: 'Your party and meal details are kept — switch back any time and nothing is lost.' },
        couple: { party: 'The party', primaryHint: 'Main guest', partyMeta: 'Participants · dietary & allergies', note: 'Note from guest', notePlaceholder: 'No note left.', addPartner: '+ Add partner', addChild: '+ Add child', declinedHint: 'Party and meal details are kept — switching back changes nothing else.' },
      },
    },
  },
};

const WEDDING_CONFIG: WeddingConfigResponseDto = {
  id: 'config',
  version: 1,
  brideName: 'Sara',
  groomName: 'Christophe',
  tagline: '',
  date: '2027-06-05',
  language: { es: 'Español', en: 'English', fr: 'Français' },
  themeId: WeddingConfigResponseDto.ThemeIdEnum.TERRACOTTA,
  city: 'Granada',
  country: 'Spain',
  rsvpDeadline: '2027-05-01',
  venues: [],
  agenda: { status: 'provisional', items: [] },
  hotels: [],
  dietaryPreferences: [{ id: 'vegetarian', label: { es: 'Vegetariano', en: 'Vegetarian', fr: 'Végétarien' } }],
  allergies: [{ id: 'nuts', label: { es: 'Frutos secos', en: 'Nuts', fr: 'Fruits à coque' } }],
  menus: [],
};

/**
 * An `attending` flag that is **absent**, not `false`.
 *
 * Hub ADR-0040 made `attending` required on every adult, so a member carrying
 * no flag is no longer constructible — but it is still readable (stored RSVPs
 * are not re-validated on read, ADR-0040 §1; and this bundle outlives any
 * single API deploy, CLAUDE.md hard rule 17), and several cases below assert
 * exactly what the editor renders for one. The cast is the fixture.
 */
const NO_FLAG = undefined as unknown as boolean;

/** An adult fixture that may leave `attending` out; `draftWith` fills in
 *  `NO_FLAG` so the omission stays the pre-ADR-0040 shape it always was. */
type AdultFixture = Omit<RsvpDraft['partner1'], 'attending'> & { attending?: boolean };

type DraftOverrides = Partial<Omit<RsvpDraft, 'partner1' | 'partner2'>> & {
  partner1?: AdultFixture;
  partner2?: AdultFixture;
};

function draftWith(overrides: DraftOverrides = {}): RsvpDraft {
  const { partner1, partner2, ...rest } = overrides;
  return {
    status: RsvpDto.StatusEnum.ATTENDING,
    version: 3,
    partner1: partner1
      ? { attending: NO_FLAG, ...partner1 }
      : { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: NO_FLAG },
    partner2: partner2 && { attending: NO_FLAG, ...partner2 },
    children: [],
    ...rest,
  };
}

describe('RsvpEditor', () => {
  let fixture: ComponentFixture<RsvpEditor>;
  /** Every draft the component emitted, oldest first. */
  let emitted: RsvpDraft[];

  async function create(draft: RsvpDraft, inputs: Record<string, unknown> = {}): Promise<void> {
    fixture = TestBed.createComponent(RsvpEditor);
    fixture.componentRef.setInput('draft', draft);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    emitted = [];
    // Controlled component: feed each emitted draft straight back in, the way
    // a host does, so a sequence of edits builds on the previous one.
    fixture.componentInstance.draftChange.subscribe((next: RsvpDraft) => {
      emitted.push(next);
      fixture.componentRef.setInput('draft', next);
    });
    await fixture.whenStable();
  }

  function query<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  function queryAll<T extends HTMLElement>(selector: string): T[] {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)) as T[];
  }

  /** The free-text entry field is the last `app-input` in an expanded card
   *  (after the name fields), so it needs no test-only marker in the markup. */
  function customAllergyInput(): HTMLInputElement {
    const inputs = queryAll<HTMLInputElement>('.card-body input[app-input]');
    return inputs[inputs.length - 1];
  }

  async function type(input: HTMLInputElement, value: string): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function pressEnter(input: HTMLInputElement): Promise<void> {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RsvpEditor],
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
    // Seed the singleton the editor reads its diet/allergy catalogs from.
    TestBed.inject(EntityServices)
      .getEntityCollectionService<WeddingConfigResponseDto>(EntityNamesEnum.WEDDING_CONFIG)
      .addOneToCache(WEDDING_CONFIG);
  });

  it('tracks the participant total from the draft', async () => {
    await create(draftWith());
    expect(query('.total')?.textContent?.trim()).toBe('Total: 1');

    await create(
      draftWith({
        partner2: { firstName: 'Grace', lastName: 'Hopper', options: {} },
        children: [{ firstName: 'Kit', age: '7', options: {} }],
      }),
    );
    expect(query('.total')?.textContent?.trim()).toBe('Total: 3');
    expect(queryAll('.card').length).toBe(3);
  });

  it('emits a draft with the toggled diet id and leaves the original untouched', async () => {
    const draft = draftWith();
    const before = JSON.stringify(draft);
    await create(draft);

    const chip = queryAll<HTMLButtonElement>('.card-body .chip')[0];
    expect(chip.textContent?.trim()).toBe('Vegetarian');
    expect(chip.getAttribute('aria-pressed')).toBe('false');

    chip.click();
    await fixture.whenStable();

    expect(emitted.length).toBe(1);
    expect(emitted[0].partner1.options.dietaryPreferenceIds).toEqual(['vegetarian']);
    expect(JSON.stringify(draft)).toBe(before);
    expect(queryAll<HTMLButtonElement>('.card-body .chip')[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('renders no name input for a partner who has their own guest account', async () => {
    await create(
      draftWith({
        partner2: {
          id: 'guest-2',
          firstName: 'Grace',
          lastName: 'Hopper',
          options: {},
          kind: 'guest',
        },
      }),
    );
    // Expand the partner's card (the first one is open by default).
    queryAll<HTMLButtonElement>('.card-head')[1].click();
    await fixture.whenStable();

    expect(query('.locked-name')?.textContent?.trim()).toBe('Grace Hopper');
    expect(queryAll('.card-body input[app-input]').length).toBe(1); // the allergy entry only
    expect(query('.name-hint')).not.toBeNull();
    // Removing them from the party is still allowed.
    expect(query('.card-body .remove-btn')).not.toBeNull();
  });

  it('keeps a locked partner name unchanged when a setter is called programmatically', async () => {
    await create(
      draftWith({
        partner2: {
          id: 'guest-2',
          firstName: 'Grace',
          lastName: 'Hopper',
          options: {},
          kind: 'guest',
        },
      }),
    );
    // reason: `setAdultFirstName` is `protected` — the guard it backs (ADR
    // W-0002 §Decision.3) exists precisely for callers that bypass the template.
    const editor = fixture.componentInstance as unknown as {
      setAdultFirstName(key: 'partner2', value: string): void;
    };
    editor.setAdultFirstName('partner2', 'Renamed');
    await fixture.whenStable();

    expect(emitted.length).toBe(0);
  });

  describe('nickname (T299)', () => {
    it('renders the primary guest\'s nickname read-only, in quotes — the primary is always nameLocked (ADR W-0007 §Amendment2.6: identity edits go through the profile, never this editor)', async () => {
      await create(draftWith({ partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', nickname: 'Ada', options: {} } }));

      // The header quote is always visible — even before the card opens (DS
      // `RSVPEditor.jsx` L146, the collapsed-header treatment).
      expect(query('.header-nickname')?.textContent?.trim()).toBe('“Ada”');

      // Expanded body (the primary's card is open by default): its own
      // read-only labelled block, not inline with the name (DS
      // `RSVPEditor.jsx` L164) — and no editable input at all.
      expect(query('.locked-nickname-value')?.textContent?.trim()).toBe('“Ada”');
      expect(queryAll('.card-body input[maxlength="30"]').length).toBe(0);
    });

    it('offers an editable nickname field for a child, with the child-specific placeholder', async () => {
      await create(draftWith({ children: [{ firstName: 'Kit', age: '7', options: {} }] }));
      queryAll<HTMLButtonElement>('.card-head')[1].click();
      await fixture.whenStable();

      const nicknameInput = query<HTMLInputElement>('.card-body input[maxlength="30"]');
      expect(nicknameInput).not.toBeNull();
      expect(nicknameInput!.placeholder).toBe('e.g. Teo');

      await type(nicknameInput!, 'AVeryLongNicknameThatExceedsThirtyCharacters');
      expect(emitted[emitted.length - 1].children[0].nickname).toBe('AVeryLongNicknameThatExceedsTh');
    });

    it("renders a locked partner2's nickname read-only, in quotes, beside the name in the collapsed header — no input at all", async () => {
      await create(
        draftWith({
          partner2: {
            id: 'guest-2',
            firstName: 'Grace',
            lastName: 'Hopper',
            nickname: 'Gigi',
            options: {},
            kind: 'guest',
          },
        }),
      );

      // The header quote is always visible — even before the card opens (DS
      // `RSVPEditor.jsx` L146, the collapsed-header treatment). `partner1`
      // has no nickname in this fixture, so this is the only one rendered.
      expect(queryAll('.header-nickname').length).toBe(1);
      expect(query('.header-nickname')?.textContent?.trim()).toBe('“Gigi”');

      queryAll<HTMLButtonElement>('.card-head')[1].click();
      await fixture.whenStable();

      // Expanded body: its own read-only labelled block, not inline with the
      // name (DS `RSVPEditor.jsx` L164) — and no editable input at all.
      expect(query('.locked-nickname-value')?.textContent?.trim()).toBe('“Gigi”');
      expect(queryAll('.card-body input[app-input]').length).toBe(1); // the allergy entry only
      expect(query('.card-body input[maxlength="30"]')).toBeNull();
    });

    it('renders no nickname elements when the locked partner has none', async () => {
      await create(
        draftWith({
          partner2: { id: 'guest-2', firstName: 'Grace', lastName: 'Hopper', options: {}, kind: 'guest' },
        }),
      );

      expect(queryAll('.header-nickname').length).toBe(0); // neither party has one

      queryAll<HTMLButtonElement>('.card-head')[1].click();
      await fixture.whenStable();

      expect(query('.locked-nickname-value')).toBeNull();
      expect(query('.locked-nickname-block')).toBeNull();
    });

    it('keeps a locked partner nickname unchanged when the setter is called programmatically', async () => {
      await create(
        draftWith({
          partner2: {
            id: 'guest-2',
            firstName: 'Grace',
            lastName: 'Hopper',
            nickname: 'Gigi',
            options: {},
            kind: 'guest',
          },
        }),
      );
      // reason: `setAdultNickname` is `protected` — the guard it backs (ADR
      // W-0002 §Decision.3) exists precisely for callers that bypass the template.
      const editor = fixture.componentInstance as unknown as {
        setAdultNickname(key: 'partner2', value: string): void;
      };
      editor.setAdultNickname('partner2', 'Renamed');
      await fixture.whenStable();

      expect(emitted.length).toBe(0);
    });
  });

  describe('"Open their profile" (couple and owner perspectives)', () => {
    const linkedPartner = {
      partner2: {
        id: 'guest-2',
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'guest',
      },
    };
    /** Plus-one: no account, so `kind: 'plus-one'` and no locked name (ADR W-0004). */
    const plusOnePartner = {
      partner2: {
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'plus-one',
      },
    };

    /** Expand the partner's card — the primary one is open by default. */
    async function openPartnerCard(): Promise<void> {
      queryAll<HTMLButtonElement>('.card-head')[1].click();
      await fixture.whenStable();
    }

    it('renders the trigger for a partner with their own account and emits their id', async () => {
      const ids: string[] = [];
      await create(draftWith(linkedPartner), { perspective: 'couple' });
      fixture.componentInstance.openProfile.subscribe((id: string) => ids.push(id));
      await openPartnerCard();

      const trigger = query<HTMLButtonElement>('.name-hint .profile-link');
      expect(trigger).not.toBeNull();
      expect(trigger!.tagName).toBe('BUTTON');
      expect(trigger!.type).toBe('button');
      expect(trigger!.textContent?.trim()).toBe('Open their profile');
      // It sits *inside* the "name managed by their own account" hint and reads
      // as part of that sentence, per the DS — hence the space between them.
      expect(query('.name-hint')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Name managed by their own guest account. Open their profile',
      );

      trigger!.click();
      await fixture.whenStable();
      expect(ids).toEqual(['guest-2']);
      // A jump is not an edit: the draft is untouched.
      expect(emitted.length).toBe(0);
    });

    it('renders no trigger for a plus-one partner', async () => {
      await create(draftWith(plusOnePartner), { perspective: 'couple' });
      await openPartnerCard();

      expect(query('.name-hint')).toBeNull();
      expect(query('.profile-link')).toBeNull();
    });

    it('renders the trigger for a partner with their own account and emits their id, in the owner perspective too', async () => {
      const ids: string[] = [];
      await create(draftWith(linkedPartner), { perspective: 'owner' });
      fixture.componentInstance.openProfile.subscribe((id: string) => ids.push(id));
      await openPartnerCard();

      const trigger = query<HTMLButtonElement>('.name-hint .profile-link');
      expect(trigger).not.toBeNull();
      expect(trigger!.tagName).toBe('BUTTON');
      expect(trigger!.type).toBe('button');
      expect(trigger!.textContent?.trim()).toBe('Open their profile');
      // It sits *inside* the "name managed by their own account" hint and reads
      // as part of that sentence, per the DS — hence the space between them.
      expect(query('.name-hint')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Name managed by their own guest account. Open their profile',
      );

      trigger!.click();
      await fixture.whenStable();
      expect(ids).toEqual(['guest-2']);
      // A jump is not an edit: the draft is untouched.
      expect(emitted.length).toBe(0);
    });
  });

  describe('per-person "Attending" toggle (T322, ADR W-0007 §Amendment)', () => {
    const accountPartner = {
      partner2: {
        id: 'guest-2',
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'guest',
      },
    };
    /** Plus-one: no account, so never eligible itself — but its mere presence
     *  (a party of more than one adult) is what makes the *primary* eligible
     *  (ADR W-0007 §Amendment.1). */
    const plusOnePartner = {
      partner2: {
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'plus-one',
      },
    };

    function toggle(): HTMLButtonElement | null {
      return query<HTMLButtonElement>('.card-body button[app-toggle]');
    }

    it('is absent for the primary card when the party has no partner2', async () => {
      await create(draftWith());
      expect(toggle()).toBeNull();
    });

    it('is absent for a child card, even when a partner2 makes the rest of the party eligible', async () => {
      await create(
        draftWith({ ...accountPartner, children: [{ firstName: 'Kit', age: '7', options: {} }] }),
      );
      // partner1, partner2, child — the child card is index 2.
      queryAll<HTMLButtonElement>('.card-head')[2].click();
      await fixture.whenStable();
      expect(toggle()).toBeNull();
    });

    it('is present for a plus-one partner2, with the hint that does not promise them an account (T339, hub ADR-0040 §4)', async () => {
      await create(draftWith(plusOnePartner));
      queryAll<HTMLButtonElement>('.card-head')[1].click();
      await fixture.whenStable();

      const t = toggle();
      expect(t).not.toBeNull();
      expect(t!.getAttribute('aria-checked')).toBe('true');
      expect(t!.textContent?.trim()).toBe('Grace Hopper will be there');
      // Not the account-holding copy: a plus-one has no account to keep.
      expect(query('.attending-hint')?.textContent?.trim()).toBe(
        'Switch this off if they cannot make it — their name, meal and allergy details stay, so they can be switched back any time.',
      );
    });

    it('clicking a plus-one\'s toggle emits partner2.attending: false and keeps them on the party (T339)', async () => {
      await create(draftWith(plusOnePartner));
      queryAll<HTMLButtonElement>('.card-head')[1].click();
      await fixture.whenStable();

      toggle()!.click();
      await fixture.whenStable();

      const last = emitted[emitted.length - 1];
      expect(last.partner2?.attending).toBe(false);
      expect(last.partner2?.firstName).toBe('Grace');
      expect(toggle()!.getAttribute('aria-checked')).toBe('false');
      expect(query('.attending-hint')?.textContent?.trim()).toBe(
        'They stay on this RSVP and can be switched back to attending right up to the day.',
      );
    });

    it('is present on the primary card whenever a partner2 exists — the ADR W-0007 amendment: partner1 is eligible too, even next to an account-less plus-one', async () => {
      // partner1's card is open by default.
      await create(draftWith(plusOnePartner));
      const t = toggle();
      expect(t).not.toBeNull();
      expect(t!.getAttribute('aria-checked')).toBe('true'); // undefined attending reads as "coming"
    });

    it('is present for an account-holding partner2, defaulting to checked/"coming" when attending is undefined', async () => {
      await create(draftWith(accountPartner));
      queryAll<HTMLButtonElement>('.card-head')[1].click();
      await fixture.whenStable();

      const t = toggle();
      expect(t).not.toBeNull();
      expect(t!.getAttribute('aria-checked')).toBe('true');
      expect(t!.textContent?.trim()).toBe('Grace Hopper will be there');
      expect(query('.attending-hint')?.textContent?.trim()).toBe(
        'Switch this off if they cannot make it — their account, meal and allergy details stay, so they can be switched back any time.',
      );
    });

    it('clicking emits partner2.attending: false and switches the hint to "declined"; clicking again restores true', async () => {
      await create(draftWith(accountPartner));
      queryAll<HTMLButtonElement>('.card-head')[1].click();
      await fixture.whenStable();

      toggle()!.click();
      await fixture.whenStable();

      expect(emitted[emitted.length - 1].partner2?.attending).toBe(false);
      expect(toggle()!.getAttribute('aria-checked')).toBe('false');
      expect(query('.attending-hint')?.textContent?.trim()).toBe(
        'They stay on this RSVP and can be switched back to attending right up to the day.',
      );

      toggle()!.click();
      await fixture.whenStable();

      expect(emitted[emitted.length - 1].partner2?.attending).toBe(true);
      expect(toggle()!.getAttribute('aria-checked')).toBe('true');
    });

    it('writes to partner1, not partner2, when the primary declines alone', async () => {
      await create(draftWith(plusOnePartner)); // partner1's card is open by default
      toggle()!.click();
      await fixture.whenStable();

      expect(emitted[emitted.length - 1].partner1.attending).toBe(false);
      expect(emitted[emitted.length - 1].partner2?.attending).toBeUndefined();
    });
  });

  describe('party-level status control writes the per-adult flags too (T329, ADR W-0007 §Amendment3.7)', () => {
    const accountPartner = {
      partner2: {
        id: 'guest-2',
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'guest',
      },
    };
    const plusOnePartner = {
      partner2: {
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'plus-one',
      },
    };

    function clickStatus(label: string): void {
      const button = queryAll<HTMLButtonElement>('.choice-row button').find(
        (b) => b.textContent?.trim() === label,
      );
      button!.click();
    }

    it('setStatus("declined") sets every eligible adult\'s flag false and leaves a plus-one untouched', async () => {
      await create(draftWith(accountPartner), { showStatus: true });

      clickStatus('Sadly no');
      await fixture.whenStable();

      const last = emitted[emitted.length - 1];
      expect(last.status).toBe('declined');
      expect(last.partner1.attending).toBe(false);
      expect(last.partner2?.attending).toBe(false);
    });

    it('setStatus("declined") writes an account-less plus-one partner2 too — they are eligible now (T339, hub ADR-0040 §4)', async () => {
      await create(draftWith(plusOnePartner), { showStatus: true });

      clickStatus('Sadly no');
      await fixture.whenStable();

      const last = emitted[emitted.length - 1];
      expect(last.status).toBe('declined');
      // Both adults are eligible, so both carry the flag; the wire has an
      // `attending` field for a plus-one since hub ADR-0040.
      expect(last.partner1.attending).toBe(false);
      expect(last.partner2?.attending).toBe(false);
    });

    it('setStatus("declined") leaves a child untouched — children cannot decline', async () => {
      await create(
        draftWith({ ...accountPartner, children: [{ firstName: 'Kit', age: '7', options: {} }] }),
        { showStatus: true },
      );

      clickStatus('Sadly no');
      await fixture.whenStable();

      const last = emitted[emitted.length - 1];
      expect(last.children).toEqual([{ firstName: 'Kit', age: '7', options: {} }]);
    });

    it('setStatus("attending") clears prior declines on every eligible adult', async () => {
      await create(
        draftWith({
          status: RsvpDto.StatusEnum.DECLINED,
          partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: false },
          partner2: { ...accountPartner.partner2, attending: false },
        }),
        { showStatus: true },
      );

      clickStatus('With joy');
      await fixture.whenStable();

      const last = emitted[emitted.length - 1];
      expect(last.status).toBe('attending');
      expect(last.partner1.attending).toBe(true);
      expect(last.partner2?.attending).toBe(true);
    });

    it('setStatus("pending") touches no flags', async () => {
      await create(
        draftWith({
          status: RsvpDto.StatusEnum.DECLINED,
          partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: false },
          partner2: { ...accountPartner.partner2, attending: false },
        }),
        { showStatus: true, statusPending: true },
      );

      clickStatus('Pending');
      await fixture.whenStable();

      const last = emitted[emitted.length - 1];
      expect(last.status).toBe('pending');
      expect(last.partner1.attending).toBe(false);
      expect(last.partner2?.attending).toBe(false);
    });

    it('round-trips a party-level decline through save and reload and it is still declined', async () => {
      await create(draftWith(accountPartner), { showStatus: true });

      clickStatus('Sadly no');
      await fixture.whenStable();

      // "Save": serialise the emitted draft the way the host's PATCH does.
      const saved = fromRsvpDraft(emitted[emitted.length - 1]);
      const dto: RsvpDto = {
        id: 'rsvp-1',
        version: 3,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        submittedBy: 'guest-1',
        status: RsvpDto.StatusEnum.ATTENDING,
        adults: { partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: NO_FLAG } },
        children: [],
        ...saved,
      };

      // "Reload": mount a fresh editor off the round-tripped draft.
      const reloaded = toRsvpDraft(dto);
      expect(reloaded.status).toBe('declined');
      await create(reloaded, { showStatus: true });

      const declinedButton = queryAll<HTMLButtonElement>('.choice-row button').find(
        (b) => b.textContent?.trim() === 'Sadly no',
      );
      expect(declinedButton!.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('"Not attending" pill and summary prefix (T323, ADR W-0007 §Amendment)', () => {
    const accountPartner = {
      partner2: {
        id: 'guest-2',
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'guest',
      },
    };
    const plusOnePartner = {
      partner2: {
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'plus-one',
      },
    };

    it('renders the pill with the exact translated text and leads the summary with it, for an account-holding partner2 who declined', async () => {
      await create(draftWith({ ...accountPartner, partner2: { ...accountPartner.partner2, attending: false } }));
      const heads = queryAll<HTMLButtonElement>('.card-head');
      const partnerPills = heads[1].querySelectorAll('app-pill');

      expect(partnerPills.length).toBe(2);
      expect(partnerPills[1].textContent?.trim()).toBe('Not attending');
      expect(heads[1].querySelector('.summary')?.textContent?.trim()).toBe('Not attending');
    });

    it('omits the pill and the summary prefix for the same partner2 with attending true or undefined', async () => {
      await create(draftWith({ ...accountPartner, partner2: { ...accountPartner.partner2, attending: true } }));
      let heads = queryAll<HTMLButtonElement>('.card-head');
      expect(heads[1].querySelectorAll('app-pill').length).toBe(1);
      expect(heads[1].querySelector('.summary')?.textContent?.trim()).not.toContain('Not attending');

      await create(draftWith(accountPartner)); // attending: undefined
      heads = queryAll<HTMLButtonElement>('.card-head');
      expect(heads[1].querySelectorAll('app-pill').length).toBe(1);
      expect(heads[1].querySelector('.summary')?.textContent?.trim()).not.toContain('Not attending');
    });

    it('renders the pill and summary prefix on the primary card too, when partner1 declines alone', async () => {
      await create(
        draftWith({
          ...plusOnePartner,
          partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: false },
        }),
      );
      const heads = queryAll<HTMLButtonElement>('.card-head');
      const primaryPills = heads[0].querySelectorAll('app-pill');

      expect(primaryPills.length).toBe(2);
      expect(primaryPills[1].textContent?.trim()).toBe('Not attending');
      expect(heads[0].querySelector('.summary')?.textContent?.trim()).toBe('Not attending');
    });

    it('renders the pill and summary prefix for a declined plus-one partner2 (T339, hub ADR-0040 §4)', async () => {
      await create(draftWith({ ...plusOnePartner, partner2: { ...plusOnePartner.partner2, attending: false } }));
      const heads = queryAll<HTMLButtonElement>('.card-head');
      const partnerPills = heads[1].querySelectorAll('app-pill');

      expect(partnerPills.length).toBe(2);
      expect(partnerPills[1].textContent?.trim()).toBe('Not attending');
      expect(heads[1].querySelector('.summary')?.textContent?.trim()).toContain('Not attending');
    });

    it('never renders the pill or summary prefix for a child, or for the primary without a partner2 — regardless of a stale attending value', async () => {
      let heads: HTMLButtonElement[];

      // Child with a stale, structurally-impossible attending-like field — never eligible.
      await create(
        draftWith({
          ...accountPartner,
          partner2: { ...accountPartner.partner2, attending: false },
          children: [{ firstName: 'Kit', age: '7', options: {} }],
        }),
      );
      heads = queryAll<HTMLButtonElement>('.card-head');
      expect(heads[2].querySelectorAll('app-pill').length).toBe(1); // role pill only — no "not attending" pill for a child

      // Primary alone, no partner2 at all — not eligible to decline solo.
      await create(draftWith());
      heads = queryAll<HTMLButtonElement>('.card-head');
      expect(heads[0].querySelectorAll('app-pill').length).toBe(1);
    });
  });

  describe('party total line — "Attending: X of N" vs "Total: N" (T324, ADR W-0007 §Amendment)', () => {
    const accountPartner = {
      partner2: {
        id: 'guest-2',
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'guest',
      },
    };
    const plusOnePartner = {
      partner2: {
        firstName: 'Grace',
        lastName: 'Hopper',
        options: {},
        kind: 'plus-one',
      },
    };

    it('renders "Total: N" for a party with no partner2 — the overwhelmingly common case, no regression', async () => {
      await create(draftWith());
      expect(query('.total')?.textContent?.trim()).toBe('Total: 1');
    });

    it('renders "Total: N" for a party with a plus-one partner2 who has not declined', async () => {
      await create(draftWith(plusOnePartner));
      expect(query('.total')?.textContent?.trim()).toBe('Total: 2');
    });

    it('renders "Attending: N-1 of N" once the plus-one partner2 declines (T339, hub ADR-0040 §4)', async () => {
      await create(
        draftWith({ ...plusOnePartner, partner2: { ...plusOnePartner.partner2, attending: false } }),
      );
      expect(query('.total')?.textContent?.trim()).toBe('Attending: 1 of 2');
    });

    it('renders "Total: N" for an account-holding partner2 with attending true or undefined', async () => {
      await create(draftWith({ ...accountPartner, partner2: { ...accountPartner.partner2, attending: true } }));
      expect(query('.total')?.textContent?.trim()).toBe('Total: 2');

      await create(draftWith(accountPartner)); // attending: undefined
      expect(query('.total')?.textContent?.trim()).toBe('Total: 2');
    });

    it('renders "Attending: N-1 of N" for a party of primary + declined account-holding partner2', async () => {
      await create(
        draftWith({ ...accountPartner, partner2: { ...accountPartner.partner2, attending: false } }),
      );
      expect(query('.total')?.textContent?.trim()).toBe('Attending: 1 of 2');
    });

    it('renders "Attending: N-1 of N" for primary + declined partner2 + children, verifying children are never subtracted', async () => {
      await create(
        draftWith({
          ...accountPartner,
          partner2: { ...accountPartner.partner2, attending: false },
          children: [
            { firstName: 'Kit', age: '7', options: {} },
            { firstName: 'Rex', age: '4', options: {} },
          ],
        }),
      );
      expect(query('.total')?.textContent?.trim()).toBe('Attending: 3 of 4');
    });

    it('renders "Attending: N-2 of N" when both partner1 and partner2 solo-decline, in a party with children (ADR W-0007 §Amendment — attendingCount can subtract twice)', async () => {
      await create(
        draftWith({
          ...accountPartner,
          partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: {}, attending: false },
          partner2: { ...accountPartner.partner2, attending: false },
          children: [
            { firstName: 'Kit', age: '7', options: {} },
            { firstName: 'Rex', age: '4', options: {} },
          ],
        }),
      );
      expect(query('.total')?.textContent?.trim()).toBe('Attending: 2 of 4');
    });
  });

  it('renders the attendance row only when showStatus is set', async () => {
    await create(draftWith());
    expect(query('.status-section')).toBeNull();

    await create(draftWith(), { showStatus: true });
    expect(query('.status-section')).not.toBeNull();
  });

  it('renders two answers without statusPending, three with it', async () => {
    await create(draftWith(), { showStatus: true });
    const twoAnswers = queryAll<HTMLButtonElement>('.choice-row button');
    expect(twoAnswers.length).toBe(2);
    expect(twoAnswers.some((btn) => btn.textContent?.trim() === 'Pending')).toBe(false);

    await create(draftWith(), { showStatus: true, statusPending: true });
    const threeAnswers = queryAll<HTMLButtonElement>('.choice-row button');
    expect(threeAnswers.length).toBe(3);
    expect(threeAnswers.some((btn) => btn.textContent?.trim() === 'Pending')).toBe(true);
  });

  it('renders no answer selected for a pending draft when statusPending is off', async () => {
    await create(draftWith({ status: RsvpDto.StatusEnum.PENDING }), { showStatus: true });
    const selected = queryAll<HTMLButtonElement>('.choice-row button[aria-pressed="true"]');
    expect(selected.length).toBe(0);
  });

  it('renders the declined reassurance line only when showStatus is set and the answer is "no"', async () => {
    await create(draftWith({ status: RsvpDto.StatusEnum.DECLINED }));
    expect(query('.declined-hint')).toBeNull();

    await create(draftWith({ status: RsvpDto.StatusEnum.ATTENDING }), { showStatus: true });
    expect(query('.declined-hint')).toBeNull();

    await create(draftWith({ status: RsvpDto.StatusEnum.PENDING }), {
      showStatus: true,
      statusPending: true,
    });
    expect(query('.declined-hint')).toBeNull();

    await create(draftWith({ status: RsvpDto.StatusEnum.DECLINED }), { showStatus: true });
    expect(query('.declined-hint')).not.toBeNull();
    expect(query('.declined-hint')?.textContent?.trim()).toBe(
      'Your party and meal details are kept — switch back any time and nothing is lost.',
    );

    await create(draftWith({ status: RsvpDto.StatusEnum.DECLINED }), {
      showStatus: true,
      perspective: 'couple',
    });
    expect(query('.declined-hint')?.textContent?.trim()).toBe(
      'Party and meal details are kept — switching back changes nothing else.',
    );
  });

  it('reads its section copy from the perspective namespace', async () => {
    await create(draftWith());
    expect(query('.party-title')?.tagName).toBe('H3');
    expect(query('.party-title')?.textContent?.trim()).toBe('Your party');
    expect(query('.party-meta .label')?.textContent?.trim()).toBe('Party · dietary & allergies');
    expect(query('.card-head app-pill')?.textContent?.trim()).toBe('You');

    await create(draftWith(), { perspective: 'couple' });
    expect(query('.party-title')?.textContent?.trim()).toBe('The party');
    expect(query('.party-meta .label')?.textContent?.trim()).toBe('Participants · dietary & allergies');
    expect(query('.card-head app-pill')?.textContent?.trim()).toBe('Main guest');
  });

  it('renders the note as static text with an empty state when noteReadonly is set', async () => {
    await create(draftWith(), { perspective: 'couple', noteReadonly: true });
    expect(query('textarea')).toBeNull();
    expect(query('.note-text')?.textContent?.trim()).toBe('No note left.');

    await create(
      draftWith({
        partner1: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace', options: { comments: 'See you there' } },
      }),
      { perspective: 'couple', noteReadonly: true },
    );
    expect(query('textarea')).toBeNull();
    expect(query('.note-text')?.textContent?.trim()).toBe('See you there');
  });

  it('offers an editable note when noteReadonly is not set', async () => {
    await create(draftWith());
    const textarea = query<HTMLTextAreaElement>('textarea');
    expect(textarea).not.toBeNull();

    textarea!.value = 'A song to dance to';
    textarea!.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(emitted[0].partner1.options.comments).toBe('A song to dance to');
  });

  it('commits custom allergies as individually removable chips', async () => {
    await create(draftWith());

    await type(customAllergyInput(), 'Kiwi');
    await pressEnter(customAllergyInput());
    await type(customAllergyInput(), 'Celery');
    await pressEnter(customAllergyInput());

    expect(emitted[emitted.length - 1].partner1.options.customAllergies).toEqual(['Kiwi', 'Celery']);
    expect(queryAll('.chip-custom').length).toBe(2);

    // A trimmed, case-insensitive duplicate is dropped rather than added twice.
    const emittedBefore = emitted.length;
    await type(customAllergyInput(), '  kiwi ');
    await pressEnter(customAllergyInput());
    expect(emitted.length).toBe(emittedBefore);
    expect(queryAll('.chip-custom').length).toBe(2);

    // Blank and whitespace-only entries are ignored too.
    await type(customAllergyInput(), '   ');
    await pressEnter(customAllergyInput());
    expect(emitted.length).toBe(emittedBefore);

    queryAll<HTMLButtonElement>('.chip-custom')[0].click();
    await fixture.whenStable();
    expect(emitted[emitted.length - 1].partner1.options.customAllergies).toEqual(['Celery']);
    expect(queryAll('.chip-custom').length).toBe(1);
    expect(queryAll<HTMLButtonElement>('.chip-custom')[0].getAttribute('aria-label')).toBe('Remove Celery');
  });

  it('commits a custom allergy on blur and does not submit a surrounding form', async () => {
    await create(draftWith());

    const input = customAllergyInput();
    await type(input, 'Kiwi');
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(emitted[emitted.length - 1].partner1.options.customAllergies).toEqual(['Kiwi']);

    await type(customAllergyInput(), 'Celery');
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    customAllergyInput().dispatchEvent(enter);
    await fixture.whenStable();
    expect(enter.defaultPrevented).toBe(true);
  });

  describe('confirmed removal (T278)', () => {
    const withPartnerAndChild = (): RsvpDraft =>
      draftWith({
        partner2: { firstName: 'Grace', lastName: 'Hopper', options: {}, kind: 'plus-one' },
        children: [{ firstName: 'Kit', age: '7', options: { allergyIds: ['nuts'] } }],
      });

    /** primary(0), partner(1), child(2) — the accordion's default order. */
    async function openCard(index: number): Promise<void> {
      queryAll<HTMLButtonElement>('.card-head')[index].click();
      await fixture.whenStable();
    }

    function confirmDialogButtons(): HTMLButtonElement[] {
      return queryAll<HTMLButtonElement>('app-confirm-dialog .action');
    }

    it('clicking .remove-btn on a child emits no draftChange and renders app-confirm-dialog', async () => {
      await create(withPartnerAndChild());
      await openCard(2);

      expect(query('app-confirm-dialog [role="dialog"]')).toBeNull();
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();

      expect(emitted.length).toBe(0);
      expect(query('app-confirm-dialog [role="dialog"]')).not.toBeNull();
    });

    it('confirming removes the child, emits exactly one draftChange, and leaves the partner intact', async () => {
      await create(withPartnerAndChild());
      await openCard(2);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();

      const [, confirmBtn] = confirmDialogButtons();
      confirmBtn.click();
      await fixture.whenStable();

      expect(emitted.length).toBe(1);
      expect(emitted[0].children).toEqual([]);
      expect(emitted[0].partner2?.firstName).toBe('Grace');
      expect(query('app-confirm-dialog [role="dialog"]')).toBeNull();
    });

    it('cancelling a child removal emits nothing and leaves the party unchanged', async () => {
      const draft = withPartnerAndChild();
      await create(draft);
      await openCard(2);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();

      const [cancelBtn] = confirmDialogButtons();
      cancelBtn.click();
      await fixture.whenStable();

      expect(emitted.length).toBe(0);
      expect(query('app-confirm-dialog [role="dialog"]')).toBeNull();
      expect(queryAll('.card').length).toBe(3);
    });

    it('clicking .remove-btn on the partner emits no draftChange and renders app-confirm-dialog', async () => {
      await create(withPartnerAndChild());
      await openCard(1);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();

      expect(emitted.length).toBe(0);
      expect(query('app-confirm-dialog [role="dialog"]')).not.toBeNull();
    });

    it('confirming removes the partner, emits exactly one draftChange, and leaves the child intact', async () => {
      await create(withPartnerAndChild());
      await openCard(1);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();

      const [, confirmBtn] = confirmDialogButtons();
      confirmBtn.click();
      await fixture.whenStable();

      expect(emitted.length).toBe(1);
      expect(emitted[0].partner2).toBeUndefined();
      expect(emitted[0].children.length).toBe(1);
      expect(emitted[0].children[0].firstName).toBe('Kit');
    });

    it('cancelling a partner removal emits nothing and leaves the party unchanged', async () => {
      await create(withPartnerAndChild());
      await openCard(1);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();

      const [cancelBtn] = confirmDialogButtons();
      cancelBtn.click();
      await fixture.whenStable();

      expect(emitted.length).toBe(0);
      expect(queryAll('.card').length).toBe(3);
    });

    it('resets openKey when confirming removal of the currently-open card', async () => {
      await create(withPartnerAndChild());
      await openCard(2); // opens the child, closing the primary card
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();

      const [, confirmBtn] = confirmDialogButtons();
      confirmBtn.click();
      await fixture.whenStable();

      expect(queryAll('.card-body').length).toBe(0);
    });

    it('titles the dialog by card kind: titleChild for a child, titlePartner for the partner', async () => {
      await create(withPartnerAndChild());
      await openCard(2);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();
      expect(query('app-confirm-dialog .modal-title')?.textContent?.trim()).toBe('Remove this child?');
      confirmDialogButtons()[0].click(); // cancel, back to a clean state
      await fixture.whenStable();

      await openCard(1);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();
      expect(query('app-confirm-dialog .modal-title')?.textContent?.trim()).toBe('Remove the partner?');
    });

    it('the message carries the full name, or the kind-specific fallback when unnamed', async () => {
      await create(withPartnerAndChild());
      await openCard(2);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();
      expect(query('app-confirm-dialog .message')?.textContent?.trim()).toContain('Kit will be taken off');
      confirmDialogButtons()[0].click(); // cancel
      await fixture.whenStable();

      await create(
        draftWith({ children: [{ firstName: '', age: '', options: {} }] }),
      );
      await openCard(1);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();
      expect(query('app-confirm-dialog .message')?.textContent?.trim()).toContain(
        'This child will be taken off',
      );

      await create(
        draftWith({ partner2: { firstName: '', lastName: '', options: {}, kind: 'plus-one' } }),
      );
      await openCard(1);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();
      expect(query('app-confirm-dialog .message')?.textContent?.trim()).toContain(
        'This partner will be taken off',
      );
    });

    it('binds tone="danger" on the confirm dialog', async () => {
      await create(withPartnerAndChild());
      await openCard(2);
      query<HTMLButtonElement>('.card-body .remove-btn')!.click();
      await fixture.whenStable();

      const [cancelBtn, confirmBtn] = confirmDialogButtons();
      expect(confirmBtn.classList.contains('danger')).toBe(true);
      expect(cancelBtn.classList.contains('danger')).toBe(false);
    });
  });
});
