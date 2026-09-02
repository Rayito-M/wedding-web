import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideEffects } from '@ngrx/effects';
import { EntityServices, provideEntityData, withEffects } from '@ngrx/data';
import { provideStore } from '@ngrx/store';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import {
  EntityNamesEnum,
  RsvpDto,
  WeddingConfigResponseDto,
  WeddingRsvpService,
  entityConfig,
  provideEntityDataServices,
} from '@app/core';

import { DelegateEdit } from './delegate-edit';

/** Copy fixture, same rationale as `rsvp-edit.spec.ts`'s own: a copy change
 *  in `public/i18n/*.json` must not silently turn these assertions red. */
const TRANSLATIONS = {
  shared: { save: 'Save' },
  rsvp: {
    header: 'RSVP',
    hub: { back: 'Back to your replies', detail: { declinedSub: "They can't make it." } },
    edit: {
      eyebrow: { confirmed: 'CONFIRMED', declined: 'DECLINED' },
      seatsHeld: { singular: '{{count}} seat held.', plural: '{{count}} seats held.' },
      footer: { saved: 'Changes saved ✓', unsaved: 'Unsaved changes' },
      error: "Couldn't save.",
    },
    editor: {
      choice: { attending: 'With joy', pending: 'Pending', declined: 'Sadly no' },
      total: 'Total: {{count}}',
      unnamed: {
        none: 'No guest needs a first and last name',
        singular: '{{count}} guest needs a first and last name',
        plural: '{{count}} guests need a first and last name',
      },
      perspective: {
        delegate: {
          party: 'Their party',
          primaryHint: 'They',
          partyMeta: 'Participants · dietary & allergies',
          note: 'Note from them',
          notePlaceholder: 'No note left.',
          addPartner: '+ Add their partner',
          addChild: '+ Add a child',
          declinedHint: 'Their party and meal details are kept.',
        },
      },
    },
  },
};

function rsvpWith(status: RsvpDto.StatusEnum): RsvpDto {
  return {
    id: 'subject-1',
    version: 5,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    status,
    adults: { partner1: { id: 'subject-1', firstName: 'Ana', lastName: 'Ruiz', options: {} } },
    children: [],
    submittedBy: 'subject-1',
  };
}

describe('DelegateEdit (hub ADR-0039 §6, T337)', () => {
  let fixture: ComponentFixture<DelegateEdit>;
  let updateSpy: ReturnType<typeof vi.fn>;

  async function create(rsvp: RsvpDto, subjectName = 'Ana Ruiz'): Promise<void> {
    updateSpy = vi.fn((params: { guestId: string; updateRsvpDto: Partial<RsvpDto> }) =>
      of({ ...rsvp, ...params.updateRsvpDto, id: params.guestId } as RsvpDto),
    );

    await TestBed.configureTestingModule({
      imports: [DelegateEdit],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        provideStore(),
        provideEffects(),
        provideEntityData(entityConfig, withEffects()),
        provideEntityDataServices(),
        { provide: WeddingRsvpService, useValue: { rsvpControllerUpdateV1: updateSpy } },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', TRANSLATIONS, true);
    TestBed.inject(EntityServices)
      .getEntityCollectionService<WeddingConfigResponseDto>(EntityNamesEnum.WEDDING_CONFIG)
      .clearCache();

    fixture = TestBed.createComponent(DelegateEdit);
    fixture.componentRef.setInput('rsvp', rsvp);
    fixture.componentRef.setInput('subjectName', subjectName);
    await fixture.whenStable();
  }

  function text(selector: string): string {
    return (fixture.nativeElement.querySelector(selector)?.textContent ?? '').trim();
  }

  it('heads the screen with the subject\'s name, not "Your reply" — the DS mock draws no such heading here', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));

    expect(text('h2')).toBe('Ana Ruiz');
    expect(fixture.nativeElement.textContent).not.toContain('Your reply');
  });

  it('uses the delegate perspective, never owner — third-person copy throughout', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));

    // This fixture only defines `perspective.delegate.*` (no `owner`/
    // `couple` keys) — an untranslated raw key would surface here instead
    // if the editor were ever handed the wrong perspective.
    expect(text('app-rsvp-editor .party-title')).toBe('Their party');
  });

  it('a declined subject renders third-person copy ("They can\'t make it"), not the guest\'s own first-person copy', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.DECLINED));

    expect(text('.sub')).toBe("They can't make it.");
  });

  it('offers Pending as a status option — a delegate may open a subject who has not answered yet', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.PENDING));

    // `statusPending` is on: the shared editor's three-way status row
    // renders, same shape as the couple's `app-manage-rsvp-modal` — its own
    // spec covers the exact markup, this only asserts the choice is offered.
    expect(fixture.nativeElement.textContent).toContain('Pending');
  });

  it('renders a back link that emits (back)', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));
    let backEmitted = false;
    fixture.componentInstance.back.subscribe(() => (backEmitted = true));

    (fixture.nativeElement.querySelector('.back-link') as HTMLButtonElement).click();

    expect(backEmitted).toBe(true);
  });

  // `partner1`'s name/nickname render locked (`app-rsvp-editor`'s own
  // `nameLocked: true` for that slot, reachable from every perspective —
  // a pre-existing bug this task found but does not fix, matching CLAUDE.md
  // hard rule 9's "read-only" precedent for stumbled-on bugs outside a
  // task's own blast radius). These specs mark the draft dirty through the
  // one adult-editable control that isn't gated by it — the free-text
  // custom-allergy chip entry — rather than through the locked name field.
  function addCustomAllergy(text: string): void {
    const entry = fixture.nativeElement.querySelector(
      'input[app-input][placeholder="rsvp.editor.person.customAllergy.placeholder"]',
    ) as HTMLInputElement;
    entry.value = text;
    entry.dispatchEvent(new Event('input'));
    entry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
  }

  it('saves through PATCH /v1/rsvp/{subjectId} — the subject\'s id, never the delegate\'s', async () => {
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));

    addCustomAllergy('Peanuts');

    const saveBtn = fixture.nativeElement.querySelector('footer button[app-btn]') as HTMLButtonElement;
    saveBtn.click();
    await fixture.whenStable();

    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ guestId: 'subject-1' }));
  });

  it('a save failure surfaces the same generic error the guest\'s own editor shows — no special-cased 410 copy', async () => {
    updateSpy.mockImplementation(() => throwError(() => new Error('410')));
    await create(rsvpWith(RsvpDto.StatusEnum.ATTENDING));

    addCustomAllergy('Peanuts');

    const saveBtn = fixture.nativeElement.querySelector('footer button[app-btn]') as HTMLButtonElement;
    saveBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text('.status')).toBe("Couldn't save.");
  });
});
