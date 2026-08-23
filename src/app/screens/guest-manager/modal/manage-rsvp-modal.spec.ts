import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  RsvpDto,
  WeddingConfigResponseDto,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { ManageRsvpModal } from './manage-rsvp-modal';

/**
 * Copy fixture — the shipped English for the keys these tests read back out
 * of the DOM. Kept local so a copy change in `public/i18n/*.json` cannot
 * silently turn these assertions red; what is under test is that the modal
 * asks for the *right key*, and that the party heading now comes from the
 * shared editor rather than from this host (T267, ADR W-0003 §Decision.9).
 */
const TRANSLATIONS = {
  shared: { remove: 'Remove', partner: { nameManaged: 'Name managed by their own guest account.' } },
  guest_manager: {
    modal: { manageRsvp: 'Manage RSVP', guestPlaceholder: 'Guest' },
    action: { back: 'Back', saveChanges: 'Save changes' },
    rsvp: {
      none: 'No RSVP yet.',
      saveFailed: "Couldn't save.",
      children: 'Children',
    },
  },
  rsvp: {
    editor: {
      total: 'Total: {{count}}',
      person: { openProfile: 'Open their profile' },
      kind: { partner: 'Partner', child: 'Child' },
      unnamed: {
        none: 'No guest needs a first and last name',
        singular: '{{count}} guest needs a first and last name',
        plural: '{{count}} guests need a first and last name',
      },
      perspective: {
        couple: {
          party: 'The party',
          primaryHint: 'Main guest',
          partyMeta: 'Participants · dietary & allergies',
          note: 'Note from guest',
          notePlaceholder: 'No note left.',
          addPartner: '+ Add partner',
          addChild: '+ Add child',
        },
      },
    },
  },
};

function rsvpWith(lastName = 'Lovelace'): RsvpDto {
  return {
    id: 'guest-1',
    version: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    status: RsvpDto.StatusEnum.ATTENDING,
    adults: {
      partner1: { id: 'guest-1', firstName: 'Ada', lastName, options: {} },
    },
    children: [],
    submittedBy: 'guest-1',
  };
}

/** The same reply, with a partner who has their own guest account (`id`). */
function rsvpWithLinkedPartner(): RsvpDto {
  const rsvp = rsvpWith();
  return {
    ...rsvp,
    adults: {
      ...rsvp.adults,
      partner2: { id: 'guest-2', firstName: 'Grace', lastName: 'Hopper', options: {} },
    },
  };
}

describe('ManageRsvpModal', () => {
  let fixture: ComponentFixture<ManageRsvpModal>;

  async function open(rsvp: RsvpDto): Promise<void> {
    TestBed.inject(EntityServices)
      .getEntityCollectionService<RsvpDto>(EntityNamesEnum.RSVP)
      .addOneToCache(rsvp);
    fixture = TestBed.createComponent(ManageRsvpModal);
    fixture.componentInstance.open(rsvp.id);
    await fixture.whenStable();
  }

  function text(selector: string): string {
    return (fixture.nativeElement.querySelector(selector)?.textContent ?? '').trim();
  }

  /** Every occurrence of a string in the rendered overlay — the modal's own
   *  title must not be echoed by a section heading. */
  function occurrences(needle: string): number {
    const rendered: string = fixture.nativeElement.textContent ?? '';
    return rendered.split(needle).length - 1;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageRsvpModal],
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
    // The editor reads its diet/allergy catalogs from this singleton.
    TestBed.inject(EntityServices)
      .getEntityCollectionService<WeddingConfigResponseDto>(EntityNamesEnum.WEDDING_CONFIG)
      .clearCache();
  });

  it('lets the shared editor own the party heading, in the couple perspective', async () => {
    await open(rsvpWith());

    expect(text('app-rsvp-editor .party-title')).toBe('The party');
    expect(occurrences('The party')).toBe(1);
    expect(text('app-rsvp-editor .card-head app-pill')).toBe('Main guest');
    // The old group headings are gone — the per-card role pill replaces them.
    expect(occurrences('Participants ·')).toBe(1);
    expect(fixture.nativeElement.querySelector('.group-label')).toBeNull();
  });

  it('renders the attendance row and a read-only note', async () => {
    await open(rsvpWith());

    expect(fixture.nativeElement.querySelector('app-rsvp-editor .status-section')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-rsvp-editor textarea')).toBeNull();
    expect(text('app-rsvp-editor .note-text')).toBe('No note left.');
  });

  it('gates the save on the shared unnamed-adult count', async () => {
    await open(rsvpWith(''));

    expect(text('.footer-note')).toBe('1 guest needs a first and last name');
    const save = fixture.nativeElement.querySelectorAll('button[app-btn]')[1] as HTMLButtonElement;
    expect(save.textContent?.trim()).toBe('Save changes');
    expect(save.disabled).toBe(true);
  });

  it('clears the footer note and enables the save once every adult is named', async () => {
    await open(rsvpWith());

    expect(text('.footer-note')).toBe('');
    const save = fixture.nativeElement.querySelectorAll('button[app-btn]')[1] as HTMLButtonElement;
    expect(save.disabled).toBe(false);
  });

  it('re-emits the linked partner id from "Open their profile" and closes itself', async () => {
    const ids: string[] = [];
    await open(rsvpWithLinkedPartner());
    fixture.componentInstance.openProfile.subscribe((id: string) => ids.push(id));

    // Expand the partner's card — the primary guest's is open by default.
    const heads = fixture.nativeElement.querySelectorAll('app-rsvp-editor .card-head');
    (heads[1] as HTMLButtonElement).click();
    await fixture.whenStable();

    const trigger = fixture.nativeElement.querySelector(
      'app-rsvp-editor .name-hint .profile-link',
    ) as HTMLButtonElement | null;
    expect(trigger?.textContent?.trim()).toBe('Open their profile');

    trigger!.click();
    await fixture.whenStable();

    // The partner's id, not the primary guest's — the parent opens *their*
    // profile. The overlay closes so the two dialogs swap rather than stack.
    expect(ids).toEqual(['guest-2']);
    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('discards unsaved edits when the couple jumps to the partner profile', async () => {
    await open(rsvpWithLinkedPartner());

    // Edit the note-less draft through the editor: toggle nothing, rename the
    // primary guest, which is the cheapest observable dirty edit.
    const firstName = fixture.nativeElement.querySelector(
      'app-rsvp-editor .card-body input[app-input]',
    ) as HTMLInputElement;
    firstName.value = 'Edited';
    firstName.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(
      (fixture.nativeElement.querySelector('app-rsvp-editor .card-head .name') as HTMLElement)
        .textContent,
    ).toContain('Edited');

    const heads = fixture.nativeElement.querySelectorAll('app-rsvp-editor .card-head');
    (heads[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    (
      fixture.nativeElement.querySelector(
        'app-rsvp-editor .name-hint .profile-link',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();

    // Deliberate: the jump discards, exactly as "Back" does. Reopening shows
    // the stored reply, not the abandoned edit.
    fixture.componentInstance.open('guest-1');
    await fixture.whenStable();
    expect(
      (fixture.nativeElement.querySelector('app-rsvp-editor .card-head .name') as HTMLElement)
        .textContent,
    ).toContain('Ada');
  });
});
