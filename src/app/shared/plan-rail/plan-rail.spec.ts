import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { PlanRail, PlanRailItem } from './plan-rail';

const SETTINGS_SECTIONS = [
  { id: 'basics', labelKey: 'config.sections.basics' },
  { id: 'couple', labelKey: 'config.sections.couple' },
];

const ITEMS: PlanRailItem[] = [
  { id: 'overview', labelKey: 'manage.overview' },
  { id: 'guests', labelKey: 'manage.guests', count: '142 / 172' },
  { id: 'milestones', labelKey: 'manage.milestones' },
];

const FOOTER: PlanRailItem[] = [
  { id: 'config', labelKey: 'manage.settings', sections: SETTINGS_SECTIONS },
];

describe('PlanRail (T361 — DS components/navigation/PlanRail.jsx port)', () => {
  let fixture: ComponentFixture<PlanRail>;

  async function create(inputs: Record<string, unknown> = {}): Promise<void> {
    // A couple of tests call `create()` twice to compare two states — reset
    // first so the second call can configure a fresh module rather than
    // erroring on an already-instantiated one.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PlanRail],
      providers: [provideTranslateService({ lang: 'en', fallbackLang: 'en' })],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation(
      'en',
      {
        nav: { manage: 'Manage' },
        manage: {
          overview: 'Overview',
          guests: 'Guests',
          milestones: 'Milestones',
          settings: 'Settings',
        },
        config: { sections: { basics: 'Basics', couple: 'The couple' } },
      },
      true,
    );

    fixture = TestBed.createComponent(PlanRail);
    fixture.componentRef.setInput('items', ITEMS);
    fixture.componentRef.setInput('footer', FOOTER);
    fixture.componentRef.setInput('label', 'nav.manage');
    for (const [name, val] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, val);
    }
    fixture.detectChanges();
  }

  function railItemLabels(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.rail-item')).map(
      (el) => (el as HTMLElement).querySelector('.rail-item-label')?.textContent?.trim() ?? '',
    );
  }

  it('renders every top-level item and the footer item, none of them active by default', async () => {
    await create();

    expect(railItemLabels()).toEqual(['Overview', 'Guests', 'Milestones', 'Settings']);
    expect(fixture.nativeElement.querySelector('.rail-item.on')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sections')).toBeNull();
  });

  it('renders the eyebrow label translated', async () => {
    await create();

    expect(fixture.nativeElement.querySelector('.eyebrow')?.textContent?.trim()).toBe('Manage');
  });

  it('shows a live count only on the item that carries one', async () => {
    await create();

    const items = Array.from(fixture.nativeElement.querySelectorAll('.rail-item')) as HTMLElement[];
    const guests = items.find((el) => el.textContent?.includes('Guests'))!;
    const overview = items.find((el) => el.textContent?.includes('Overview'))!;
    expect(guests.querySelector('.count')?.textContent?.trim()).toBe('142 / 172');
    expect(overview.querySelector('.count')).toBeNull();
  });

  it('marks the active item with the "on" class and aria-current="page"', async () => {
    await create({ active: 'guests' });

    const items = Array.from(fixture.nativeElement.querySelectorAll('.rail-item')) as HTMLElement[];
    const active = items.find((el) => el.classList.contains('on'))!;
    expect(active.textContent).toContain('Guests');
    expect(active.getAttribute('aria-current')).toBe('page');

    const inactive = items.find((el) => el.textContent?.includes('Overview'))!;
    expect(inactive.classList.contains('on')).toBe(false);
    expect(inactive.getAttribute('aria-current')).toBeNull();
  });

  it('nests sections one level deep, and only under the active item that declares them', async () => {
    await create({ active: 'overview' });
    // "overview" has no sections, and is not the footer item, so nothing nests.
    expect(fixture.nativeElement.querySelector('.sections')).toBeNull();

    await create({ active: 'config' });
    const sections = Array.from(
      fixture.nativeElement.querySelectorAll('.sections .section-item'),
    ) as HTMLElement[];
    expect(sections.map((el) => el.querySelector('.section-item-label')?.textContent?.trim())).toEqual([
      'Basics',
      'The couple',
    ]);
  });

  it('numbers nested sections 01, 02, … regardless of which section is active', async () => {
    await create({ active: 'config', activeSection: 'couple' });

    const numbers = Array.from(fixture.nativeElement.querySelectorAll('.number')) as HTMLElement[];
    expect(numbers.map((el) => el.textContent?.trim())).toEqual(['01', '02']);
  });

  it('marks the active section with "on" and aria-current="true", independent of the parent dot', async () => {
    await create({ active: 'config', activeSection: 'couple' });

    const sections = Array.from(
      fixture.nativeElement.querySelectorAll('.section-item'),
    ) as HTMLElement[];
    const active = sections.find((el) => el.textContent?.includes('The couple'))!;
    const other = sections.find((el) => el.textContent?.includes('Basics'))!;

    expect(active.classList.contains('on')).toBe(true);
    expect(active.getAttribute('aria-current')).toBe('true');
    expect(other.classList.contains('on')).toBe(false);
    expect(other.getAttribute('aria-current')).toBeNull();
  });

  it('emits navSelect with the clicked item id, top-level or footer', async () => {
    await create();
    const emitted: string[] = [];
    fixture.componentInstance.navSelect.subscribe((id) => emitted.push(id));

    const items = Array.from(fixture.nativeElement.querySelectorAll('.rail-item')) as HTMLElement[];
    items.find((el) => el.textContent?.includes('Guests'))!.click();
    items.find((el) => el.textContent?.includes('Settings'))!.click();

    expect(emitted).toEqual(['guests', 'config']);
  });

  it('emits sectionSelect with the clicked section id, leaving navSelect untouched', async () => {
    await create({ active: 'config' });
    const navEmitted: string[] = [];
    const sectionEmitted: string[] = [];
    fixture.componentInstance.navSelect.subscribe((id) => navEmitted.push(id));
    fixture.componentInstance.sectionSelect.subscribe((id) => sectionEmitted.push(id));

    const sections = Array.from(
      fixture.nativeElement.querySelectorAll('.section-item'),
    ) as HTMLElement[];
    sections.find((el) => el.textContent?.includes('The couple'))!.click();

    expect(sectionEmitted).toEqual(['couple']);
    expect(navEmitted).toEqual([]);
  });

  it('omits the eyebrow entirely when no label is supplied, rather than falling back to hardcoded text', async () => {
    await create({ label: undefined });

    expect(fixture.nativeElement.querySelector('.eyebrow')).toBeNull();
  });

  it('renders the decorative fish illustration by default, and can be told to omit it', async () => {
    await create();
    expect(fixture.nativeElement.querySelector('.illustration app-decor-fish')).not.toBeNull();

    await create({ showIllustration: false });
    expect(fixture.nativeElement.querySelector('.illustration')).toBeNull();
  });
});
