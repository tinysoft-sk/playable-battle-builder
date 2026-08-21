import { describe, it, expect } from 'vitest';
import { slimTemplate, hydrateTemplate } from './templateSlim';
import { AUDIO_EVENTS } from '../types/battle';
import type { BattleConfig, LibraryAsset } from '../types/battle';

function baseConfig(): BattleConfig {
  return {
    id: 'cfg1', name: 'Test', spellbookEnabled: true,
    playerUnits: [{
      id: 'u1', name: 'Archer', type: 'ranged', hp: 100, baseDamage: 10,
      defense: 0, damageMultiplier: 1, gridCol: 0, gridRow: 0,
      displayWidth: 100, moveRange: 2, projectileSize: 60, resistTo: [],
      flipped: false, assets: { idle: null, attack: null, projectile: null },
    }],
    enemyUnits: [],
    heroLeft: { asset: null, flipped: false, posX: 0, posY: 0, displayWidth: 100 },
    heroRight: { asset: null, flipped: false, posX: 0, posY: 0, displayWidth: 100 },
    spells: [{
      id: 's1', name: 'Fireball', element: 'fire', asset: null,
      projectileAsset: null, projectileSize: 60, sfxShoot: null, sfxHit: null,
    }],
    scenario: {
      mode: 'puzzle', introSpeech: '', winningSequence: [], failConditions: [],
      retaliations: [], alternating: { firstTurn: 'player', playerTurns: [], enemyTurns: [], attackReactions: [] },
    },
    popups: {
      victory: { bannerAsset: null, boardAsset: null, ctaButtonAsset: null },
      defeat: { bannerAsset: null, boardAsset: null, retryButtonAsset: null, storeButtonAsset: null, hintTextColor: '#fff' },
    },
    backgrounds: { landscape: null, portrait: null },
    store: { iosUrl: '', androidUrl: '', ctaFailCount: 2 },
    audio: { music: null, sfxMap: Object.fromEntries(AUDIO_EVENTS.map(e => [e, null])) },
    gridTiles: { walkable: null, active: null },
    uiAssets: { spellbookClosed: null, spellbookOpen: null, meleeIcon: null, rangedIcon: null, flyingIcon: null, rangedProjectile: null },
    appIcon: null,
    grid: { cols: 5, rows: 4 },
    gridOffset: { landscape: 0, portrait: 0 },
    hintLayout: { landscapeY: 265, portraitY: 265, landscapeFontSize: 13.5, portraitFontSize: 13.5 },
    speechLayout: { landscapeX: 160, landscapeY: 14, landscapeFontSize: 13, portraitX: 14, portraitY: 14, portraitFontSize: 13 },
  };
}

const archerIdle: LibraryAsset = { id: 'lib1', dataUri: 'data:image/png;base64,archer-idle', mimeType: 'image/png', fileName: 'archer-idle.png' };
const heroImg: LibraryAsset = { id: 'lib2', dataUri: 'data:image/png;base64,hero', mimeType: 'image/png', fileName: 'hero.png' };

describe('slimTemplate', () => {
  it('replaces a slot whose asset is a known library asset with a small id reference', () => {
    const cfg = baseConfig();
    cfg.playerUnits[0].assets.idle = { dataUri: archerIdle.dataUri, mimeType: archerIdle.mimeType, fileName: archerIdle.fileName, libraryAssetId: 'lib1' };
    const result = slimTemplate(cfg, [archerIdle]) as { playerUnits: { assets: { idle: unknown } }[] };
    expect(result.playerUnits[0].assets.idle).toEqual({ libraryAssetId: 'lib1' });
  });

  it('keeps the full asset data when libraryAssetId is missing (a one-off, not-yet-synced asset)', () => {
    const cfg = baseConfig();
    const raw = { dataUri: 'data:image/png;base64,oneoff', mimeType: 'image/png', fileName: 'oneoff.png' };
    cfg.playerUnits[0].assets.idle = raw;
    const result = slimTemplate(cfg, [archerIdle]) as { playerUnits: { assets: { idle: unknown } }[] };
    expect(result.playerUnits[0].assets.idle).toEqual(raw);
  });

  it('keeps the full asset data when libraryAssetId points at an id no longer in the library', () => {
    const cfg = baseConfig();
    const stale = { dataUri: 'data:image/png;base64,stale', mimeType: 'image/png', fileName: 'stale.png', libraryAssetId: 'not-in-library' };
    cfg.playerUnits[0].assets.idle = stale;
    const result = slimTemplate(cfg, [archerIdle]) as { playerUnits: { assets: { idle: unknown } }[] };
    expect(result.playerUnits[0].assets.idle).toEqual(stale);
  });

  it('leaves a null slot as null', () => {
    const result = slimTemplate(baseConfig(), []) as { heroLeft: { asset: unknown } };
    expect(result.heroLeft.asset).toBeNull();
  });

  it('slims a fixed-slot asset (hero portrait)', () => {
    const cfg = baseConfig();
    cfg.heroLeft.asset = { dataUri: heroImg.dataUri, mimeType: heroImg.mimeType, fileName: heroImg.fileName, libraryAssetId: 'lib2' };
    const result = slimTemplate(cfg, [heroImg]) as { heroLeft: { asset: unknown } };
    expect(result.heroLeft.asset).toEqual({ libraryAssetId: 'lib2' });
  });
});

describe('hydrateTemplate', () => {
  it('resolves a slim id-reference slot back to the full asset data', () => {
    const cfg = baseConfig();
    cfg.playerUnits[0].assets.idle = { libraryAssetId: 'lib1' } as unknown as null;
    const result = hydrateTemplate(cfg, [archerIdle], {});
    expect(result.playerUnits[0].assets.idle).toEqual({ dataUri: archerIdle.dataUri, mimeType: archerIdle.mimeType, fileName: archerIdle.fileName, libraryAssetId: archerIdle.id });
  });

  it('leaves an already-full asset slot unchanged', () => {
    const cfg = baseConfig();
    const full = { dataUri: 'data:image/png;base64,oneoff', mimeType: 'image/png', fileName: 'oneoff.png' };
    cfg.playerUnits[0].assets.idle = full;
    const result = hydrateTemplate(cfg, [archerIdle], {});
    expect(result.playerUnits[0].assets.idle).toEqual(full);
  });

  it('falls back through resolveDefaults gap-filling when a referenced id is missing from the library', () => {
    const cfg = baseConfig();
    cfg.playerUnits[0].assets.idle = { libraryAssetId: 'gone' } as unknown as null;
    const result = hydrateTemplate(cfg, [archerIdle], { 'unit:idle:archer': 'lib1' });
    expect(result.playerUnits[0].assets.idle).toEqual({ dataUri: archerIdle.dataUri, mimeType: archerIdle.mimeType, fileName: archerIdle.fileName, libraryAssetId: archerIdle.id });
  });

  it('round-trips through slimTemplate and hydrateTemplate without changing the resolved asset data', () => {
    const cfg = baseConfig();
    cfg.playerUnits[0].assets.idle = { dataUri: archerIdle.dataUri, mimeType: archerIdle.mimeType, fileName: archerIdle.fileName, libraryAssetId: 'lib1' };
    const slim = slimTemplate(cfg, [archerIdle]);
    const result = hydrateTemplate(slim, [archerIdle], {});
    expect(result.playerUnits[0].assets.idle).toEqual(cfg.playerUnits[0].assets.idle);
  });
});
