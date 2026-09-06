import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';

import { LoginService, RouteConfigService } from '@app/core';
import { environment } from '@env/environment';

import { TabBar } from './tab-bar';

/**
 * Hub ADR-0045 §3, T363 — the couple's Manage door renders as the last tab,
 * at ink strength rather than muted, and reads active while the route is
 * any member of its group (`MANAGE_GROUP_TABS`), not only its own door
 * route (`guests`) — the risk T362 carried forward for this task to close.
 */
describe('TabBar — the standout (Manage) tab and its group-aware active state (hub ADR-0045 §3)', () => {
  let fixture: ComponentFixture<TabBar>;

  async function create(role: 'guest' | 'bride' | 'groom', active: string): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TabBar],
      providers: [
        provideRouter([]),
        provideTranslateService({ lang: 'en', fallbackLang: 'en' }),
        { provide: LoginService, useValue: { role: () => role } },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation(
      'en',
      {
        nav: {
          home: 'Home',
          schedule: 'Schedule',
          rsvp: 'RSVP',
          people: 'People',
          manage: 'Manage',
        },
      },
      true,
    );

    TestBed.inject(RouteConfigService).setRouteConfig(environment.enabledRoutes);

    fixture = TestBed.createComponent(TabBar);
    fixture.componentRef.setInput('active', active);
    fixture.detectChanges();
  }

  function primaryTabEls(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.bar > .tab'));
  }

  it("renders the couple's Manage tab last among the primary tabs", async () => {
    await create('bride', 'home');

    const tabs = primaryTabEls();
    const last = tabs.at(-1);
    expect(last?.classList.contains('standout')).toBe(true);
    expect(last?.textContent?.trim()).toBe('Manage');
  });

  it('a guest — who has no Manage group — gets no standout tab at all', async () => {
    await create('guest', 'home');

    expect(fixture.nativeElement.querySelector('.tab.standout')).toBeNull();
  });

  it('the standout tab is inactive-but-ink (not muted) while elsewhere in the app', async () => {
    await create('bride', 'home');

    const standout = fixture.nativeElement.querySelector('.tab.standout') as HTMLElement;
    expect(standout.classList.contains('on')).toBe(false);
  });

  it('the standout tab is active on its own door route (guests)', async () => {
    await create('bride', 'guests');

    const standout = fixture.nativeElement.querySelector('.tab.standout') as HTMLElement;
    expect(standout.classList.contains('on')).toBe(true);
  });

  it.each(['milestones', 'config'])(
    'the standout tab is active on the other Manage-group route %s too, via MANAGE_GROUP_TABS',
    async (activeId) => {
      await create('bride', activeId);

      const standout = fixture.nativeElement.querySelector('.tab.standout') as HTMLElement;
      expect(standout.classList.contains('on')).toBe(true);
    },
  );

  it('a plain tab (not the standout, not the active route) never reads active while inside Manage', async () => {
    await create('bride', 'milestones');

    const onTabs = fixture.nativeElement.querySelectorAll('.tab.on:not(.standout)');
    expect(onTabs.length).toBe(0);
  });
});
