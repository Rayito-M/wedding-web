import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
import { RsvpEditor } from '@app/shared/rsvp-editor/rsvp-editor';

import { RsvpEdit } from './rsvp-edit';

/**
 * Copy fixture — the shipped English for the keys these tests read back out
 * of the DOM. Kept local so a copy change in `public/i18n/*.json` cannot
 * silently turn these assertions red; what is under test is that the screen
 * asks for the *right key*, and that the party heading now comes from the
 * shared editor rather than from this host (T266, ADR W-0003 §Decision.9).
 */
const TRANSLATIONS = {
  shared: { save: 'Save', remove: 'Remove' },
  rsvp: {
    header: 'RSVP',
    edit: {
      eyebrow: { confirmed: 'CONFIRMED', declined: 'DECLINED' },
      title: 'Your reply',
      seatsHeld: { singular: '{{count}} seat held.', plural: '{{count}} seats held.' },
      declinedSub: "You told us you can't make it.",
      footer: { saved: 'Changes saved ✓', unsaved: 'Unsaved changes' },
      error: "Couldn't save.",
    },
    editor: {
      attendingLabel: 'Attending?',
      choice: { attending: 'With joy', pending: 'Pending', declined: 'Sadly no' },
      total: 'Total: {{count}}',
      unnamed: {
        none: 'No guest needs a first and last name',
        singular: '{{count}} guest needs a first and last name',
        plural: '{{count}} guests need a first and last name',
      },
      perspective: {
        owner: {
          party: 'Your party',
          primaryHint: 'You',
          partyMeta: 'Party · dietary & allergies',
          note: 'A note for us (optional)',
          notePlaceholder: 'A song to dance to, a memory…',
          addPartner: '+ Add my partner',
          addChild: '+ Add a child',
          declinedHint: 'Your party and meal details are kept.',
        },
      },
    },
  },
};

function rsvpWith(status: RsvpDto.StatusEnum, lastName = 'Lovelace'): RsvpDto {
  return {
    id: 'rsvp-1',
    version: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    status,
    adults: {
      partner1: { id: 'guest-1', firstName: 'Ada', lastName, options: {} },
    },
    children: [],
    submittedBy: 'guest-1',
  };
}

describe('RsvpEdit', () => {
  let fixture: ComponentFixture<RsvpEdit>;

  async function create(rsvp: RsvpDto): Promise<void> {
    fixture = TestBed.createComponent(RsvpEdit);
    fixture.componentRef.setInput('rsvp', rsvp);
    await fixture.whenStable();
  }

  function text(selector: string): string {
    return (fixture.nativeElement.querySelector(selector)?.textContent ?? '').trim();
  }

  /** Every occurrence of a string in the rendered screen — the "Your party"
   *  heading must appear exactly once now that the editor owns it. */
  function occurrences(needle: string): number {
    const html: string = fixture.nativeElement.textContent ?? '';
    return html.split(needle).length - 1;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RsvpEdit],
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

  it('renders the screen title "Your reply" and lets the editor own "Your party"', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));

    expect(text('h2')).toBe('Your reply');
    expect(text('app-rsvp-editor .party-title')).toBe('Your party');
    expect(occurrences('Your party')).toBe(1);
    expect(text('.sub')).toBe('1 seat held.');
  });

  it('uses the same title when the RSVP is declined, and still renders the editor with the party visible', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.DECLINED));

    expect(text('h2')).toBe('Your reply');
    expect(text('.sub')).toBe("You told us you can't make it.");
    // A declined RSVP no longer hides the editor — the party stays visible
    // (T273; the party itself is never pruned, T274).
    expect(fixture.nativeElement.querySelector('app-rsvp-editor')).not.toBeNull();
    expect(text('app-rsvp-editor .party-title')).toBe('Your party');
  });

  it('gates the save on the shared unnamed-adult count', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING, ''));

    expect(text('.status')).toBe('1 guest needs a first and last name');
    expect(fixture.nativeElement.querySelector('button[app-btn]').disabled).toBe(true);
  });

  it('shows a status-driven eyebrow: CONFIRMED while attending, DECLINED while declined', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));
    expect(text('.eyebrow')).toBe('RSVP · CONFIRMED');

    await create(rsvpWith(RsvpDto.StatusEnum.DECLINED));
    expect(text('.eyebrow')).toBe('RSVP · DECLINED');
  });

  it('shows the accent check glyph while attending and the muted dash while declined', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));
    let glyph = fixture.nativeElement.querySelector('.check');
    expect(glyph.textContent.trim()).toBe('✓');
    expect(glyph.classList.contains('declined')).toBe(false);

    await create(rsvpWith(RsvpDto.StatusEnum.DECLINED));
    glyph = fixture.nativeElement.querySelector('.check');
    expect(glyph.textContent.trim()).toBe('—');
    expect(glyph.classList.contains('declined')).toBe(true);
  });

  it('gives the guest exactly two answers ("With joy" / "Sadly no") and no "Change my answer" control', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));

    const choiceLabels = Array.from(
      fixture.nativeElement.querySelectorAll('app-rsvp-editor [app-choice-card]'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(choiceLabels).toEqual(['With joy', 'Sadly no']);
    expect(fixture.nativeElement.textContent).not.toContain('Pending');
    expect(fixture.nativeElement.querySelector('.change-answer')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Change my answer');
  });

  it('renders the reassurance line when the guest is declined', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.DECLINED));

    expect(text('app-rsvp-editor .declined-hint')).toBe('Your party and meal details are kept.');
  });

  it('passes showStatus true and leaves statusPending unset on the shared editor', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));

    const editor = fixture.debugElement.query(By.directive(RsvpEditor))
      .componentInstance as RsvpEditor;
    expect(editor.showStatus()).toBe(true);
    expect(editor.statusPending()).toBe(false);
  });
});
