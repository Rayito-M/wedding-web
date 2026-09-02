import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { RsvpDto, RsvpListResponseDtoItemsInner } from '@app/core';

import { RsvpHub } from './rsvp-hub';

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

const TRANSLATIONS = {
  rsvp: {
    header: 'RSVP',
    hub: {
      title: 'Replies you look after',
      own: { title: 'Your own reply' },
      ownCardTitle: 'You and your party',
      delegatesTitle: 'You answer for',
      outstanding: {
        none: 'Everything answered.',
        singular: '{{count}} reply still needs an answer.',
        plural: '{{count}} replies still need an answer.',
      },
      state: { attending: 'Confirmed', declined: 'Declined', pending: 'Not answered yet' },
      seats: { singular: '{{count}} person', plural: '{{count}} people' },
    },
  },
};

function rsvp(overrides: Partial<RsvpListResponseDtoItemsInner> = {}): RsvpListResponseDtoItemsInner {
  return {
    id: 'subject-1',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: RsvpDto.StatusEnum.PENDING,
    adults: { partner1: { id: 'subject-1', firstName: 'Ana', lastName: 'Ruiz', options: {}, attending: NO_FLAG } },
    children: [],
    submittedBy: 'subject-1',
    ...overrides,
  };
}

describe('RsvpHub (hub ADR-0039 §6, T337)', () => {
  let fixture: ComponentFixture<RsvpHub>;
  let opened: string[];

  async function create(inputs: {
    myReply?: RsvpDto;
    delegations?: RsvpListResponseDtoItemsInner[];
  }): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [RsvpHub],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', TRANSLATIONS, true);

    fixture = TestBed.createComponent(RsvpHub);
    if (inputs.myReply) fixture.componentRef.setInput('myReply', inputs.myReply);
    fixture.componentRef.setInput('delegations', inputs.delegations ?? []);
    opened = [];
    fixture.componentInstance.open.subscribe((key) => opened.push(key));
    fixture.detectChanges();
  }

  it('always renders the own-reply card first, even before it has loaded', async () => {
    await create({ delegations: [rsvp()] });

    const cards = fixture.nativeElement.querySelectorAll('.card');
    expect(cards[0].classList.contains('mine')).toBe(true);
    expect(cards[0].textContent).toContain('You and your party');
  });

  it('renders one card per delegation, titled with the party label (hub ADR-0039 §7)', async () => {
    await create({
      delegations: [
        rsvp({ id: 'a', adults: { partner1: { id: 'a', firstName: 'Ana', lastName: 'Ruiz', options: {}, attending: NO_FLAG } } }),
        rsvp({
          id: 'b',
          adults: {
            partner1: { id: 'b', firstName: 'Ramón', lastName: 'Mendoza', options: {}, attending: NO_FLAG },
            partner2: { kind: 'guest', id: 'b2', firstName: 'Pilar', lastName: 'Mendoza', options: {}, attending: NO_FLAG },
          },
        }),
      ],
    });

    const titles = Array.from(fixture.nativeElement.querySelectorAll('.card:not(.mine) .title')).map(
      (el) => (el as HTMLElement).textContent?.trim(),
    );
    expect(titles).toEqual(['Ana Ruiz', 'Ramón Mendoza & Pilar Mendoza']);
  });

  it('never renders a relation line — no card carries a kind/relation field at all (hard rule 18(c))', async () => {
    await create({ delegations: [rsvp()] });

    expect(fixture.nativeElement.textContent).not.toMatch(/sister|brother|father|mother|hermana|hermano/i);
  });

  it('shows state and, once answered, the party size — nothing for a still-pending reply', async () => {
    await create({
      delegations: [
        rsvp({ id: 'a', status: RsvpDto.StatusEnum.PENDING }),
        rsvp({
          id: 'b',
          status: RsvpDto.StatusEnum.ATTENDING,
          adults: {
            partner1: { id: 'b', firstName: 'B', lastName: 'B', options: {}, attending: NO_FLAG },
            partner2: { kind: 'guest', id: 'b2', firstName: 'B2', lastName: 'B2', options: {}, attending: NO_FLAG },
          },
          children: [{ firstName: 'Kid', age: 5, options: {} }],
        }),
      ],
    });

    const cards = Array.from(
      fixture.nativeElement.querySelectorAll('.card:not(.mine)'),
    ) as HTMLElement[];
    expect(cards[0].querySelector('.state')?.textContent?.trim()).toBe('Not answered yet');
    expect(cards[0].querySelector('.meta')).toBeNull();
    expect(cards[1].querySelector('.state')?.textContent?.trim()).toBe('Confirmed');
    expect(cards[1].querySelector('.meta')?.textContent?.trim()).toBe('3 people');
  });

  it('the header outstanding count includes a still-pending own reply and pluralises correctly', async () => {
    await create({
      myReply: {
        id: 'me',
        version: 1,
        createdAt: '',
        updatedAt: '',
        status: RsvpDto.StatusEnum.PENDING,
        adults: { partner1: { id: 'me', firstName: 'Me', lastName: 'Self', options: {}, attending: NO_FLAG } },
        children: [],
        submittedBy: 'me',
      },
      delegations: [rsvp({ id: 'a', status: RsvpDto.StatusEnum.PENDING }), rsvp({ id: 'b', status: RsvpDto.StatusEnum.ATTENDING })],
    });

    // Own reply (pending) + subject "a" (pending) = 2.
    expect(fixture.nativeElement.querySelector('.sub')?.textContent?.trim()).toBe(
      '2 replies still need an answer.',
    );
  });

  it('emits "me" for the own-reply card and the subject id for a delegation card', async () => {
    await create({ delegations: [rsvp({ id: 'subject-1' })] });

    (fixture.nativeElement.querySelector('.card.mine') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('.card:not(.mine)') as HTMLButtonElement).click();

    expect(opened).toEqual(['me', 'subject-1']);
  });
});
