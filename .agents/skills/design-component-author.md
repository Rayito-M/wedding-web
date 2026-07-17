---
name: design-component-author
description: Guide for implementing Angular components from the wedding design system with style validation
---

# Design-Component Author

You are implementing a component for `wedding-web` (Angular 21, standalone, signals-first, zoneless). Your job is to:

1. **Read the design system** (`../wedding-ui-design/`) to understand the component's visual spec, tokens, and behavior.
2. **Create or update the Angular component** following the project conventions.
3. **Apply design tokens** from the design system — colors, typography, spacing, radii — as scoped CSS or inline styles.
4. **Validate the result** by visual comparison against the design system's reference.

## Step 1: Study the design system

The wedding-ui-design repo contains:

- `tokens/` — CSS custom properties for colors (3 themes), typography, spacing, radii, shadows, motion
- `components/` — reference implementations (JSX + TypeScript `.d.ts` types); each has a `.prompt.md` describing intended behavior
- `guidelines/` — foundation specimens (type scale, color palette, spacing grid)
- `ui_kits/wedding-app/` — full-screen mocks showing real-world layout and interaction

**Before you code:**

1. Read the component's `*.prompt.md` in `../wedding-ui-design/components/` to understand its intent, props, and visual states.
2. Skim the corresponding `.jsx` and `.d.ts` to see the expected interface.
3. Review `guidelines/` for the design foundations (type scale, spacing, color semantics).
4. Check `tokens/` CSS for available custom properties — **never hardcode colors or spacing**.

## Step 2: Create or update the component

**File structure (always separate files, Angular 21 style — no `.component` suffix):**

```
src/app/shared/<name>/
├── <name>.ts      ← Logic only
├── <name>.html    ← Template only
└── <name>.scss    ← Styles only
```

### `<name>.ts`

Logic only — no inline templates or styles. Always standalone, signals-based, OnPush.
For a styled native element (button, input, textarea), use an attribute selector
(`button[app-btn]`, `input[app-input]`) so forms and native semantics keep working.

```typescript
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-<name>',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './<name>.html',
  styleUrl: './<name>.scss',
})
export class MyComponent {
  // Use input() / output() for reactive props
  myProp = input<string>('default');
  myEvent = output<string>();
}
```

### `<name>.html`

Template only — no inline styles via `style` attribute (use CSS classes instead).

```html
<!-- Use design system class names and CSS variables -->
<div class="row">
  <!-- Structure per design spec -->
</div>
```

### `<name>.scss`

Styles only — CSS custom properties from `src/styles/_tokens.scss` (mirrors the DS
tokens), never hardcoded colors/spacing. Prefer the semantic aliases.

```scss
:host {
  color: var(--text-body-color);
  font-family: var(--font-sans);
  border: 1px solid var(--border-hairline);
  /* ... */
}
```

### Conventions

- **Dedicated files only:** always split `<name>.ts`, `<name>.html`, `<name>.scss` into separate files. Never use `template:` or `styles:` inline.
- **No `style` attributes in templates.** Put all styling in the `.scss` file with class selectors. (Exception: SVG illustration components may bind presentation attributes like `[style.stroke]` to inputs.)
- **CSS variables:** All design tokens are CSS custom properties (defined in `src/styles/_tokens.scss`, mirroring the DS `tokens/`). Use them, never inline hex colors or hardcoded px values. Prefer the semantic aliases.
  - Semantic aliases (preferred): `--surface-page`, `--surface-card`, `--surface-chip`, `--text-body-color`, `--text-muted`, `--border-hairline`, `--brand-accent`, `--brand-accent-soft`, `--brand-accent-tertiary`, `--on-accent`
  - Raw color roles: `--ink`, `--sub`, `--accent`, `--accent-2`, `--accent-3`, `--bg`, `--surface`, `--line`, `--chip`
  - Typography: `--font-serif`, `--font-book`, `--font-sans`, `--font-mono`; scale `--text-display-xl` … `--text-label`
  - Spacing: `--space-1` through `--space-7` (4px base)
  - Radii: `--radius-pill`, `--radius-card`, `--radius-md`, `--radius-input`
  - Shadows: `--shadow-knob` (only component shadow in the system; the LanguageDropdown panel additionally uses `0 4px 16px rgba(0,0,0,0.12)` per its DS spec)
  - Motion: `--transition-fast` (0.15s ease)
- **No inline styles or `ngStyle`.** All styling in the `.css` file.
- **No `ngClass` with logic.** Use simple static class bindings or `[class.<name>]="condition"`.
- **No animations except the toggle knob.** The design is deliberately flat and minimal.
- **Hover states:** opacity 0.85 on interactive elements; no color darken/lighten, no shadows.
- **Borders:** 1px hairline using `--line` variable.
- **Responsive:** mobile-first; test on current + prior major iOS Safari and Chrome Android.

## Step 3: Validate against the design system

**Visual comparison checklist:**

1. **Open the design reference:** start `../wedding-ui-design/ui_kits/wedding-app/index.html` in a browser or preview mode.
2. **Run your component:** `pnpm start` in this repo and navigate to the page containing your component.
3. **Side-by-side check** (or alt-tab):
   - [ ] **Colors** — does the component match the accent, ink, and surface colors in the active theme?
   - [ ] **Typography** — does the type scale, font family, and weight match the spec? (DM Sans for UI, DM Serif Display for display, Cormorant Garamond for pull quotes)
   - [ ] **Spacing** — are the padding/margin values consistent with the 4px grid? (4, 8, 12, 16, 20, 24, 28px)
   - [ ] **Radii** — do border-radius values match `--radius-pill` (999px), `--radius-card` (14px), `--radius-md` (12px), or `--radius-input` (10px)?
   - [ ] **Borders** — are dividers 1px hairline using `--line`, never thicker or colored?
   - [ ] **Hover states** — do buttons/interactive rows show opacity 0.85 on hover, nothing else?
   - [ ] **Elevation** — is the component flat (no shadows except the toggle knob)?
   - [ ] **No emoji, no raster images** — decorative elements are inline SVG only, in the accent color.
   - [ ] **i18n ready** — are all user-facing strings in the template marked for translation via `i18n` attribute or `translate` pipe (per TRANSLATION_SETUP.md)?

**Responsive check:**

- [ ] Component reflows correctly on mobile (iPhone SE, 375px width) without horizontal scroll.
- [ ] Touch targets are ≥ 44px (include padding).
- [ ] Text is readable at standard mobile zoom (no <16px sans fonts).

**Theme switching:**

- [ ] If the component is visible in multiple themes, test all three (D · Mauve, E · Terracotta, F · Verde Agua) via the theme switcher in the design kit or via `[data-theme="d|e|f"]` on the root element.

## Step 4: Result comparison report

When your component is ready, provide a **brief validation report** mentioning:

- **File structure:** verify three separate files (`.component.ts`, `.component.html`, `.component.css`) exist and are correctly wired.
- Which design reference screen(s) this component appears in.
- Any tokens or patterns you used (e.g., "Used `--radius-card` and `--font-sans` with `--ink` color").
- Any deviations from the spec and why (e.g., "Omitted the Sun illustration because it's not relevant to this context").
- Responsive and theme-testing results (all pass, or specific notes).

Example:

> **Component:** Button  
> **Files:** ✓ button.ts, button.html, button.scss (separate, wired correctly)  
> **Reference:** All screens (primary CTA)  
> **Tokens used:** `--radius-pill`, `--font-sans`, `--accent` (fill), `--ink` (text), `--space-2` (padding)  
> **Hover state:** opacity 0.85 ✓ (in CSS, no inline styles)  
> **Responsive:** ✓ iPhone/Android tested  
> **Themes:** ✓ D/E/F all match  
> **Deviations:** None.

## Tips

- **The design system's `.prompt.md` files are your spec.** Refer to them first; the JSX is reference, not production code.
- **Never invent new colors, spacing, or radii.** If you think you need one, it's probably a sign to re-read the spec or ask.
- **CSS custom properties cascade.** Set them at the component scope if needed, not globally.
- **Signals and `input()/output()` are the modern Angular way.** Don't use `@Input/@Output`.
- **Standalone components** — no module imports needed; include `CommonModule` if you use `*ngIf` / `*ngFor`.

## Files to read first

- `../wedding-ui-design/readme.md` — design system overview
- `../wedding-ui-design/components/<feature>/<ComponentName>.prompt.md` — intent and behavior
- `../wedding-ui-design/tokens/colors.css` — semantic color aliases
- `../wedding-ui-design/guidelines/type-scale.card.html` — typography scale
- `src/app/shared/` (this repo) — patterns from existing components

## Validation & testing

After implementing:

**File structure:**
- [ ] Three dedicated files exist: `<name>.ts`, `<name>.html`, `<name>.scss`
- [ ] No `template:` or `styles:` inline properties in the component decorator
- [ ] No `style` attributes in the template HTML
- [ ] All styling is in the `.scss` file with class selectors

**Code quality:**
- [ ] Run `pnpm typecheck` — no TypeScript errors.
- [ ] Run `pnpm lint` — no ESLint warnings.
- [ ] Visually compare against the design kit in all three themes.
- [ ] Test on mobile and desktop; both orientations if responsive.
- [ ] i18n strings are marked (no hardcoded user-facing text).

Your component is ready to merge when all checkboxes pass and the visual comparison shows no surprises.
