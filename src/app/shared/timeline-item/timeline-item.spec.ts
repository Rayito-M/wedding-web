import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { TranslateLanguageService } from '@app/core';

import { TimelineItem } from './timeline-item';

describe('TimelineItem — venue line (T295)', () => {
  let fixture: ComponentFixture<TimelineItem>;

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TimelineItem],
      providers: [
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: TranslateLanguageService, useValue: { currentLang: signal('en') } },
      ],
    }).compileComponents();
    TestBed.inject(TranslateService).setTranslation(
      'en',
      {
        shared: {
          agendaStatus: { confirmed: 'Confirmed', planned: 'Planned', cancelled: 'Cancelled' },
          venueOnMap: '{{name}} — see it on the map',
        },
      },
      true,
    );

    fixture = TestBed.createComponent(TimelineItem);
  }

  function query<T extends HTMLElement>(selector: string): T | null {
    return fixture.nativeElement.querySelector(selector) as T | null;
  }

  it('renders the venue line when venue is set', async () => {
    await create();
    fixture.componentRef.setInput('time', '10:00');
    fixture.componentRef.setInput('heading', 'Ceremony');
    fixture.componentRef.setInput('venue', "St. Anne's Church");
    fixture.detectChanges();

    expect(query('.item-venue')?.textContent?.trim()).toBe("St. Anne's Church");
  });

  it('renders no venue line when venue is empty (default)', async () => {
    await create();
    fixture.componentRef.setInput('time', '10:00');
    fixture.componentRef.setInput('heading', 'Ceremony');
    fixture.detectChanges();

    expect(query('.item-venue')).toBeNull();
  });

  it('renders sub and venue together, sub first, when both are set', async () => {
    await create();
    fixture.componentRef.setInput('time', '10:00');
    fixture.componentRef.setInput('heading', 'Ceremony');
    fixture.componentRef.setInput('sub', 'Outdoor ceremony');
    fixture.componentRef.setInput('venue', 'Riverside Gardens');
    fixture.detectChanges();

    const sub = query('.item-sub');
    const venue = query('.item-venue');
    expect(sub?.textContent?.trim()).toBe('Outdoor ceremony');
    expect(venue?.textContent?.trim()).toBe('Riverside Gardens');
    expect(sub!.compareDocumentPosition(venue!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('links the venue line to the Travel map when venueId is set', async () => {
    await create();
    fixture.componentRef.setInput('time', '10:00');
    fixture.componentRef.setInput('heading', 'Ceremony');
    fixture.componentRef.setInput('venue', 'Iglesia de San Pedro');
    fixture.componentRef.setInput('venueId', 'venue-1');
    fixture.detectChanges();

    const link = query<HTMLAnchorElement>('a.item-venue');
    expect(link?.textContent?.trim()).toBe('Iglesia de San Pedro');
    expect(link?.getAttribute('href')).toBe('/travel?place=venue-1');
    expect(link?.getAttribute('aria-label')).toBe('Iglesia de San Pedro — see it on the map');
  });

  it('leaves the venue line as plain text when venueId is absent', async () => {
    await create();
    fixture.componentRef.setInput('time', '10:00');
    fixture.componentRef.setInput('heading', 'Ceremony');
    fixture.componentRef.setInput('venue', 'Iglesia de San Pedro');
    fixture.detectChanges();

    expect(query('a.item-venue')).toBeNull();
    expect(query('.item-venue')?.textContent?.trim()).toBe('Iglesia de San Pedro');
  });

  it('renders neither line when both sub and venue are empty', async () => {
    await create();
    fixture.componentRef.setInput('time', '10:00');
    fixture.componentRef.setInput('heading', 'Ceremony');
    fixture.detectChanges();

    expect(query('.item-sub')).toBeNull();
    expect(query('.item-venue')).toBeNull();
  });
});
