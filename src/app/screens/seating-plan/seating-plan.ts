import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

/**
 * Presentational scaffold only (T229). Per design reference
 * `ScreenSeatingPlan.jsx` / `ScreenSeatingPlanMobile.jsx` — desktop two-panel
 * layout (unassigned column + tables grid) and mobile segmented `Unseated` /
 * `Tables` layout, in one component switched purely by CSS (`@media
 * (min-width: 900px)`), same approach as `config-manager`'s rail/pills split.
 *
 * All data below is a small hardcoded fixture mirroring the shape of the
 * reference's `SP_SEED` / `SP_TABLES_INIT` — not a service, not wired to any
 * API. Local signals only drive the visual states already shown in the
 * reference (selected/unselected unit, full/not-full table, editing table
 * name, active mobile tab); there is no persistence layer.
 */

type Group = 'Family' | 'Friends' | 'Colleague';

interface Child {
  readonly name: string;
  readonly age: number;
}

interface Party {
  readonly id: number;
  readonly name: string;
  readonly group: Group;
  readonly partner: string | null;
  readonly children: readonly Child[];
  readonly table: string | null;
}

interface TableDef {
  readonly name: string;
  readonly cap: number;
}

interface Selection {
  readonly kind: 'adult' | 'child';
  readonly id: number | string;
}

interface AdultUnit {
  readonly kind: 'adult';
  readonly id: number;
  readonly party: Party;
  readonly seats: number;
}

interface ChildUnit {
  readonly kind: 'child';
  readonly id: string;
  readonly party: Party;
  readonly child: Child;
}

// Small representative subset of the reference's SP_SEED fixture — enough to
// show every visual state (unassigned/assigned adults & children, a party
// with a partner, an empty table, a partially-full table) without mirroring
// all 14 entries.
const SEED_PARTIES: readonly Party[] = [
  {
    id: 1,
    name: 'Laura Mendoza',
    group: 'Family',
    partner: 'Diego Ferrer',
    children: [{ name: 'Mateo', age: 4 }],
    table: 'Table 1',
  },
  {
    id: 2,
    name: 'Marc Dubois',
    group: 'Friends',
    partner: null,
    children: [{ name: 'Hugo', age: 5 }],
    table: null,
  },
  {
    id: 3,
    name: 'Aisha Karimi',
    group: 'Friends',
    partner: 'Omar Karimi',
    children: [],
    table: null,
  },
  {
    id: 4,
    name: 'Pablo Castro',
    group: 'Family',
    partner: 'Elena Castro',
    children: [],
    table: 'Table 2',
  },
  {
    id: 5,
    name: 'Nadia Belkacem',
    group: 'Colleague',
    partner: null,
    children: [],
    table: 'Table 1',
  },
  {
    id: 6,
    name: 'Sofia Bianchi',
    group: 'Friends',
    partner: null,
    children: [
      { name: 'Emma', age: 7 },
      { name: 'Leo', age: 4 },
    ],
    table: null,
  },
];

const SEED_TABLES: readonly TableDef[] = [
  { name: 'Table 1', cap: 8 },
  { name: 'Table 2', cap: 6 },
  { name: 'Table 3', cap: 8 },
];

// Group indicator color — reference's GROUP_DOT, mapped to this repo's
// semantic aliases (Hard Rule #3).
const GROUP_DOT: Record<Group, string> = {
  Family: 'var(--brand-accent)',
  Friends: 'var(--brand-accent-tertiary)',
  Colleague: 'var(--text-muted)',
};

const adultSeats = (party: Party): number => 1 + (party.partner ? 1 : 0);

function initialChildTables(parties: readonly Party[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  parties.forEach((party) => {
    party.children.forEach((_child, index) => {
      map[`${party.id}-${index}`] = party.table;
    });
  });
  return map;
}

@Component({
  selector: 'app-seating-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seating-plan.html',
  styleUrl: './seating-plan.scss',
})
export class SeatingPlan {
  protected readonly parties = signal<readonly Party[]>(SEED_PARTIES);
  protected readonly childTables = signal<Record<string, string | null>>(
    initialChildTables(SEED_PARTIES),
  );
  protected readonly tables = signal<readonly TableDef[]>(SEED_TABLES);

  protected readonly selection = signal<Selection | null>(null);
  protected readonly query = signal('');
  protected readonly editingIndex = signal<number | null>(null);
  protected readonly mobileTab = signal<'unseated' | 'tables'>('unseated');

  protected readonly adultUnits = computed<readonly AdultUnit[]>(() =>
    this.parties().map((party) => ({
      kind: 'adult' as const,
      id: party.id,
      party,
      seats: adultSeats(party),
    })),
  );

  protected readonly childUnits = computed<readonly ChildUnit[]>(() =>
    this.parties().flatMap((party) =>
      party.children.map((child, index) => ({
        kind: 'child' as const,
        id: `${party.id}-${index}`,
        party,
        child,
      })),
    ),
  );

  private matchesQuery(name: string): boolean {
    const query = this.query().trim().toLowerCase();
    return query === '' || name.toLowerCase().includes(query);
  }

  protected readonly unassignedAdults = computed(() =>
    this.adultUnits().filter(
      (unit) =>
        unit.party.table === null &&
        (this.matchesQuery(unit.party.name) ||
          (unit.party.partner !== null && this.matchesQuery(unit.party.partner))),
    ),
  );

  protected readonly unassignedChildren = computed(() => {
    const childTables = this.childTables();
    return this.childUnits().filter(
      (unit) => (childTables[unit.id] ?? null) === null && this.matchesQuery(unit.child.name),
    );
  });

  protected readonly unassignedSeatCount = computed(
    () =>
      this.unassignedAdults().reduce((sum, unit) => sum + unit.seats, 0) +
      this.unassignedChildren().length,
  );

  protected readonly unassignedAdultSeatCount = computed(() =>
    this.unassignedAdults().reduce((sum, unit) => sum + unit.seats, 0),
  );

  protected readonly totalSeats = computed(
    () =>
      this.parties().reduce((sum, party) => sum + adultSeats(party), 0) +
      this.childUnits().length,
  );

  protected readonly seatedSeats = computed(() => {
    const childTables = this.childTables();
    const seatedChildren = Object.values(childTables).filter((table) => table !== null).length;
    const seatedAdults = this.parties()
      .filter((party) => party.table !== null)
      .reduce((sum, party) => sum + adultSeats(party), 0);
    return seatedAdults + seatedChildren;
  });

  protected readonly selectedUnit = computed<AdultUnit | ChildUnit | null>(() => {
    const selection = this.selection();
    if (!selection) return null;
    if (selection.kind === 'adult') {
      return this.adultUnits().find((unit) => unit.id === selection.id) ?? null;
    }
    return this.childUnits().find((unit) => unit.id === selection.id) ?? null;
  });

  protected readonly selectedSeats = computed(() => {
    const unit = this.selectedUnit();
    if (!unit) return 0;
    return unit.kind === 'adult' ? unit.seats : 1;
  });

  protected readonly selectedName = computed(() => {
    const unit = this.selectedUnit();
    if (!unit) return '';
    return unit.kind === 'adult' ? unit.party.name : unit.child.name;
  });

  protected groupDot(group: Group): string {
    return GROUP_DOT[group];
  }

  protected isSelected(kind: 'adult' | 'child', id: number | string): boolean {
    const selection = this.selection();
    return !!selection && selection.kind === kind && selection.id === id;
  }

  protected toggleSelect(kind: 'adult' | 'child', id: number | string): void {
    this.selection.update((current) =>
      current && current.kind === kind && current.id === id ? null : { kind, id },
    );
    if (this.selection()) {
      this.mobileTab.set('tables');
    }
  }

  protected clearSelection(): void {
    this.selection.set(null);
  }

  protected setQuery(value: string): void {
    this.query.set(value);
  }

  protected setMobileTab(tab: 'unseated' | 'tables'): void {
    this.mobileTab.set(tab);
  }

  /** Total seats currently occupied at a table (adults + partner + children). */
  protected seatsAt(tableName: string): number {
    const childTables = this.childTables();
    const seatedAdults = this.parties()
      .filter((party) => party.table === tableName)
      .reduce((sum, party) => sum + adultSeats(party), 0);
    const seatedChildren = Object.values(childTables).filter(
      (table) => table === tableName,
    ).length;
    return seatedAdults + seatedChildren;
  }

  protected seatedAdultsAt(tableName: string): readonly Party[] {
    return this.parties().filter((party) => party.table === tableName);
  }

  protected seatedChildrenAt(tableName: string): readonly ChildUnit[] {
    const childTables = this.childTables();
    return this.childUnits().filter((unit) => childTables[unit.id] === tableName);
  }

  protected isFull(table: TableDef): boolean {
    return this.seatsAt(table.name) >= table.cap;
  }

  protected fillRatio(table: TableDef): number {
    return Math.min(100, (this.seatsAt(table.name) / table.cap) * 100);
  }

  protected canAssign(table: TableDef): boolean {
    const selection = this.selection();
    if (!selection) return false;
    return this.seatsAt(table.name) + this.selectedSeats() <= table.cap;
  }

  protected assignToTable(table: TableDef): void {
    if (!this.canAssign(table)) return;
    const selection = this.selection();
    if (!selection) return;
    if (selection.kind === 'adult') {
      this.parties.update((parties) =>
        parties.map((party) =>
          party.id === selection.id ? { ...party, table: table.name } : party,
        ),
      );
    } else {
      this.childTables.update((map) => ({ ...map, [selection.id]: table.name }));
    }
    this.selection.set(null);
  }

  protected unassignAdult(partyId: number): void {
    this.parties.update((parties) =>
      parties.map((party) => (party.id === partyId ? { ...party, table: null } : party)),
    );
  }

  protected unassignChild(childId: string): void {
    this.childTables.update((map) => ({ ...map, [childId]: null }));
  }

  protected startEditing(index: number): void {
    this.editingIndex.set(index);
  }

  protected stopEditing(): void {
    this.editingIndex.set(null);
  }

  protected renameTable(index: number, name: string): void {
    const oldName = this.tables()[index]?.name;
    if (oldName === undefined) return;
    this.tables.update((tables) =>
      tables.map((table, i) => (i === index ? { ...table, name } : table)),
    );
    this.parties.update((parties) =>
      parties.map((party) => (party.table === oldName ? { ...party, table: name } : party)),
    );
    this.childTables.update((map) => {
      const next = { ...map };
      Object.keys(next).forEach((key) => {
        if (next[key] === oldName) next[key] = name;
      });
      return next;
    });
  }

  protected setCapacity(index: number, cap: number): void {
    const nextCap = Math.max(1, cap);
    this.tables.update((tables) =>
      tables.map((table, i) => (i === index ? { ...table, cap: nextCap } : table)),
    );
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
