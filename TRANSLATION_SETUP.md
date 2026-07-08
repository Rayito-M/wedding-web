# Translation Setup Guide

This app uses **ngx-translate** for runtime language switching across English, French, and Spanish.

## Architecture

- **Service**: `I18nService` (`src/app/core/i18n.service.ts`) - Manages language state and initialization
- **Pipe**: `TranslatePipe` (`src/app/shared/pipes/translate.pipe.ts`) - Used in templates with the `t` alias
- **Translations**: JSON files in `src/assets/i18n/` - `en.json`, `fr.json`, `es.json`

## Translation Keys Format

Keys use domain-name format (dot notation) organized by feature/context:

```
welcome.*              - Welcome page
schedule.*             - Timeline/schedule
rsvp.*                 - RSVP form (step1, step2, step3)
dashboard.*            - Couple's dashboard
invitee.*              - Guest view
travel.*               - Travel information
album.*                - Photo album
shared.*               - Common UI text
```

## Using Translations in Templates

Use the `t` pipe to translate any key:

```html
<!-- Simple key -->
<h1>{{ 'welcome.saveDate' | t }}</h1>

<!-- Key with parameters -->
<span>{{ 'rsvp.step' | t: { current: step() + 1 } }}</span>
```

## Using Translations in Components

For complex logic, use the `TranslateService` directly:

```typescript
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export class MyComponent {
  private readonly translateService = inject(TranslateService);

  someMethod() {
    const message = this.translateService.instant('my.key');
    // Use translated message
  }
}
```

For reactive values, use `computed` signals:

```typescript
import { computed, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export class MyComponent {
  private readonly translateService = inject(TranslateService);

  protected readonly title = computed(() => {
    return this.translateService.instant('my.conditional.key');
  });
}
```

## Adding Language Selector

The `LanguageSelector` component (`src/app/shared/language-selector/language-selector.ts`) provides a UI for switching languages:

```html
<app-language-selector />
```

To add it to the top navigation:

1. Import `LanguageSelector` in `top-nav.ts`
2. Add it to the template alongside navigation links
3. Style it to match your design

## Adding New Translations

1. Add keys to all three translation files (`en.json`, `fr.json`, `es.json`)
2. Use the dot-notation format with domain prefix
3. Keep translations organized by feature/domain

Example structure:
```json
{
  "myFeature": {
    "title": "Title text",
    "description": "Description text"
  }
}
```

## Importing TranslatePipe in Components

Every component that uses the `t` pipe in its template must import it:

```typescript
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-my-component',
  imports: [TranslatePipe],
  // ...
})
export class MyComponent {}
```

## Key Rules

1. ✅ All user-visible text must use translation keys
2. ✅ No hardcoded literal text in HTML or TypeScript
3. ✅ Use domain-name format for keys (dot notation)
4. ✅ Keep keys organized by feature/context
5. ✅ Parameters use `{{paramName}}` in JSON and `{ paramName: value }` in templates
6. ✅ Automatically detects browser language on first load (defaults to English)

## Browser Language Detection

The `I18nService` automatically detects the browser's language on initialization and switches to the closest supported language (en, fr, es). Users can manually switch languages using the `LanguageSelector` component.

## Translation Files Location

```
src/
├── assets/
│   └── i18n/
│       ├── en.json
│       ├── fr.json
│       └── es.json
├── app/
│   ├── core/
│   │   └── i18n.service.ts
│   └── shared/
│       ├── pipes/
│       │   └── translate.pipe.ts
│       └── language-selector/
│           └── language-selector.ts
```
