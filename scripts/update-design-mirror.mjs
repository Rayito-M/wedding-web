#!/usr/bin/env node
// Maintains design-mirror.json — this repo's index of which files mirror each
// design-system component, stamped with the DS hash they were last aligned to.
// It turns "what does this DS change touch?" from a repo search into a lookup,
// and lets verify-fidelity (in wedding-ui-design) know what is mirrored.
//
// Usage: node scripts/update-design-mirror.mjs   (after aligning to a contract)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const DS = join(WEB, '..', 'wedding-ui-design');
const contract = JSON.parse(readFileSync(join(DS, 'contract/ds-contract.json'), 'utf8'));

// DS component → mirror directory (under src/app/shared) or explicit files.
const MIRRORS = {
  Avatar: 'avatar', Button: 'button', ChoiceCard: 'choice-card', ConsentBanner: 'consent-banner',
  DelegationField: 'delegate-chips', Icon: 'icons', Input: 'input', Monogram: 'monogram',
  Pill: 'pill', ProfileFields: 'profile-fields', RelationFields: 'relation-fields',
  Textarea: 'textarea', Toggle: 'toggle',
  PhotoPlaceholder: 'photo-placeholder', ProgressBar: 'progress-bar', StatTile: 'stat-tile',
  StayCard: 'stay-card', TimelineItem: 'timeline-item',
  AlhambraIllustration: 'decor', FishIllustration: 'decor', FishPairIllustration: 'decor',
  SunIllustration: 'decor', WaveIllustration: 'decor',
  AlhambraScene: 'decor/alhambra-scene', BrideAtTower: 'bride-animation',
  MotorcycleRider: 'decor/motorcycle-rider',
  AppHeader: 'screen-header', LanguageDropdown: 'language-selector',
  NotificationBell: 'notification-bell', TabBar: 'tab-bar',
  ConfirmDialog: 'confirm-dialog', NotificationDialog: 'notification-dialog',
  Toast: 'toast', ToastStack: 'toast-stack',
  PlanRail: 'plan-rail',
  // Unported (no mirror yet): AccountMenu, ProfileCard.
  // Out of scope (never mirrored): TaskRow.
};

const base = (dir, name) => {
  const stem = `src/app/shared/${dir}/${name}`;
  return ['.ts', '.html', '.scss'].map((e) => stem + e).filter((f) => existsSync(join(WEB, f)));
};

const mirrors = {};
for (const [comp, dir] of Object.entries(MIRRORS)) {
  const leaf = dir.split('/').pop();
  const files = base(dir, leaf);
  if (!files.length) continue;
  mirrors[comp] = { dsHash: contract.components[comp]?.hash ?? null, files };
}

const out = { contractVersion: contract.version, updated: new Date().toISOString().slice(0, 10), mirrors };
writeFileSync(join(WEB, 'design-mirror.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`design-mirror.json: ${Object.keys(mirrors).length} mirrors @ contract ${contract.version}`);
