import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(__dirname, '..', 'public', 'templates');
const outDir = join(__dirname, '..', 'public', 'library');

function normalize(name) {
  return name.trim().toLowerCase();
}

const library = []; // { id, dataUri, mimeType, fileName }
const roleDefaults = {}; // roleKey -> id

function addAsset(roleKey, asset) {
  if (!asset || !asset.dataUri) return;
  if (roleDefaults[roleKey]) return; // first template to define a role wins
  const entry = { id: randomUUID(), dataUri: asset.dataUri, mimeType: asset.mimeType, fileName: asset.fileName };
  library.push(entry);
  roleDefaults[roleKey] = entry.id;
}

const files = readdirSync(templatesDir).filter(f => f.endsWith('.json'));
for (const file of files) {
  const config = JSON.parse(readFileSync(join(templatesDir, file), 'utf-8'));

  for (const unit of [...config.playerUnits, ...config.enemyUnits]) {
    const key = normalize(unit.name);
    if (!key) continue;
    addAsset(`unit:idle:${key}`, unit.assets?.idle);
    addAsset(`unit:attack:${key}`, unit.assets?.attack);
    addAsset(`unit:projectile:${key}`, unit.assets?.projectile);
  }

  for (const spell of config.spells ?? []) {
    const key = normalize(spell.name);
    if (!key) continue;
    addAsset(`spell:asset:${key}`, spell.asset);
    addAsset(`spell:projectileAsset:${key}`, spell.projectileAsset);
  }

  addAsset('hero:heroLeft', config.heroLeft?.asset);
  addAsset('hero:heroRight', config.heroRight?.asset);
  addAsset('popup:victory.banner', config.popups?.victory?.bannerAsset);
  addAsset('popup:victory.board', config.popups?.victory?.boardAsset);
  addAsset('popup:victory.cta', config.popups?.victory?.ctaButtonAsset);
  addAsset('popup:defeat.banner', config.popups?.defeat?.bannerAsset);
  addAsset('popup:defeat.board', config.popups?.defeat?.boardAsset);
  addAsset('popup:defeat.retry', config.popups?.defeat?.retryButtonAsset);
  addAsset('popup:defeat.store', config.popups?.defeat?.storeButtonAsset);
  addAsset('background:landscape', config.backgrounds?.landscape);
  addAsset('background:portrait', config.backgrounds?.portrait);
  addAsset('gridTile:walkable', config.gridTiles?.walkable);
  addAsset('gridTile:active', config.gridTiles?.active);
  addAsset('ui:meleeIcon', config.uiAssets?.meleeIcon);
  addAsset('ui:rangedIcon', config.uiAssets?.rangedIcon);
  addAsset('ui:flyingIcon', config.uiAssets?.flyingIcon);
  addAsset('ui:rangedProjectile', config.uiAssets?.rangedProjectile);
  addAsset('ui:spellbookClosed', config.uiAssets?.spellbookClosed);
  addAsset('ui:spellbookOpen', config.uiAssets?.spellbookOpen);
  addAsset('appIcon', config.appIcon);
  addAsset('audio:music', config.audio?.music);
  for (const [event, asset] of Object.entries(config.audio?.sfxMap ?? {})) {
    addAsset(`audio:${event}`, asset);
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'library.json'), JSON.stringify(library, null, 2));
writeFileSync(join(outDir, 'role-defaults.json'), JSON.stringify(roleDefaults, null, 2));

console.log(`Seeded ${library.length} library assets, ${Object.keys(roleDefaults).length} role defaults.`);
