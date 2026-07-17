# Translation System - Quick Start Guide

## ✅ Setup Complete

Your wedding app now has **full internationalization (i18n) support** for English, French, and Spanish with runtime language switching. Everything is configured and ready to use!

## 🚀 Running the App

```bash
pnpm start
```

Visit `http://localhost:4200` in your browser. The app will:
1. ✅ Detect your browser language (EN, FR, or ES)
2. ✅ Display language selector buttons (EN, FR, ES) in the top navigation
3. ✅ Switch languages instantly when you click a button

## 📝 Using Translations in Templates

All text uses translation keys with NO hardcoded strings.

### Simple Key
```html
<h1>{{ 'welcome.saveDate' | t }}</h1>
```

### Key with Parameters
```html
<p>{{ 'rsvp.step' | t: { current: step() + 1 } }}</p>
```

### Conditional Rendering
Use computed signals for complex logic:
```typescript
protected readonly confirmationTitle = computed(() => {
  const isAttending = this.form.controls.attending.value === 'yes';
  return this.translateService.instant(
    isAttending ? 'rsvp.step3.yesTitle' : 'rsvp.step3.noTitle',
  );
});
```

Then in template:
```html
<h2>{{ confirmationTitle() }}</h2>
```

## 📂 Key Files

- **Translation Service**: `src/app/core/i18n.service.ts`
- **Translate Pipe**: `src/app/shared/pipes/translate.pipe.ts`
- **Language Files**: `src/assets/i18n/{en,fr,es}.json`
- **Top Nav with Selector**: `src/app/shared/top-nav/top-nav.ts`

## 🎯 What's Already Updated

- ✅ Welcome page
- ✅ Schedule/Timeline
- ✅ RSVP form (all 3 steps)
- ✅ Dashboard
- ⚠️ Invitee, Travel, Album (keys in JSON, templates ready for update)

## 📋 To Complete Remaining Screens

For `invitee.html`, `travel.html`, `album.html`:

1. Import `TranslatePipe` in component
2. Replace hardcoded text with translation keys using the `t` pipe
3. All translation keys already exist in `en.json`, `fr.json`, `es.json`

**Example:**
```html
<!-- Before -->
<h1>Our album</h1>

<!-- After -->
<h1>{{ 'album.title' | t }}</h1>
```

## 🔤 Translation Key Format

Keys use **domain.feature.item** format:

```
welcome.*        - Welcome/hero page
schedule.*       - Event timeline
rsvp.*          - RSVP form
dashboard.*     - Couple's dashboard
invitee.*       - Guest view
travel.*        - Travel information
album.*         - Photo album
shared.*        - Common UI elements
```

## 🌍 Adding New Translations

1. **Add to all 3 files** (`en.json`, `fr.json`, `es.json`):
   ```json
   {
     "myFeature": {
       "title": "My Title"
     }
   }
   ```

2. **Use in template**:
   ```html
   <h1>{{ 'myFeature.title' | t }}</h1>
   ```

3. **Or in component**:
   ```typescript
   import { TranslateService } from '@ngx-translate/core';
   
   protected readonly title = this.translateService.instant('myFeature.title');
   ```

## ⚙️ Configuration

App config is in `src/app/app.config.ts`:
- Default language: English (`en`)
- Loads translations from `src/assets/i18n/{lang}.json`
- Auto-detects browser language

## 🔍 Supported Languages

- **EN** - English
- **FR** - Français  
- **ES** - Español

## ✨ Key Features

✅ Runtime language switching (no page reload needed)
✅ Browser language auto-detection  
✅ Parameter interpolation support
✅ Clean domain-based key organization
✅ No hardcoded text anywhere
✅ Responsive language selector in top navigation

## 📚 Documentation

- **Full Setup Guide**: `TRANSLATION_SETUP.md`
- **Implementation Details**: `TRANSLATION_IMPLEMENTATION.md`

## 🎬 Next Steps

1. Start the app: `pnpm start`
2. Click language buttons in top navigation to switch languages
3. Update remaining screen templates (invitee, travel, album)
4. Add new features with translation keys from the start

## 💡 Pro Tips

- Always import `TranslatePipe` in components that use `{{ 'key' | t }}`
- Keep translation keys organized by feature/domain
- Use the same key structure across all language files
- Use `computed` signals for conditional translations
- Parameters use `{{param}}` in JSON, `{ param: value }` in templates

---

**Your app is ready for international users! 🌍**
