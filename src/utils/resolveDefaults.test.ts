import { describe, it, expect } from 'vitest';
import { resolveDefaults } from './resolveDefaults';
import { AUDIO_EVENTS } from '../types/battle';
import type { BattleConfig, LibraryAsset } from '../types/battle';
import { PLACEHOLDER_UNIT_IDLE } from './placeholderAssets';

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

describe('resolveDefaults', () => {
  it('fills a null unit slot from a matching name-based role default', () => {
    const result = resolveDefaults(baseConfig(), { 'unit:idle:archer': 'lib1' }, [archerIdle]);
    expect(result.playerUnits[0].assets.idle).toEqual({ dataUri: archerIdle.dataUri, mimeType: archerIdle.mimeType, fileName: archerIdle.fileName, libraryAssetId: archerIdle.id });
  });

  it('leaves a slot untouched if it already has an asset', () => {
    const cfg = baseConfig();
    const existing = { dataUri: 'data:image/png;base64,existing', mimeType: 'image/png', fileName: 'existing.png' };
    cfg.playerUnits[0].assets.idle = existing;
    const result = resolveDefaults(cfg, { 'unit:idle:archer': 'lib1' }, [archerIdle]);
    expect(result.playerUnits[0].assets.idle).toEqual(existing);
  });

  it('fills a fixed-slot role default (hero portrait)', () => {
    const result = resolveDefaults(baseConfig(), { 'hero:heroLeft': 'lib2' }, [heroImg]);
    expect(result.heroLeft.asset).toEqual({ dataUri: heroImg.dataUri, mimeType: heroImg.mimeType, fileName: heroImg.fileName, libraryAssetId: heroImg.id });
  });

  it('fills an audio slot by event id', () => {
    const music: LibraryAsset = { id: 'lib3', dataUri: 'data:audio/mp3;base64,x', mimeType: 'audio/mp3', fileName: 'walk.mp3' };
    const result = resolveDefaults(baseConfig(), { 'audio:walk': 'lib3' }, [music]);
    expect(result.audio.sfxMap.walk).toEqual({ dataUri: music.dataUri, mimeType: music.mimeType, fileName: music.fileName, libraryAssetId: music.id });
  });

  it('does not mutate the input config', () => {
    const cfg = baseConfig();
    resolveDefaults(cfg, { 'unit:idle:archer': 'lib1' }, [archerIdle]);
    expect(cfg.playerUnits[0].assets.idle).toBeNull();
  });

  it('falls back to the bundled placeholder when no role default exists', () => {
    const result = resolveDefaults(baseConfig(), {}, [], true);
    expect(result.playerUnits[0].assets.idle).toEqual(PLACEHOLDER_UNIT_IDLE);
  });

  it('leaves a placeholder-eligible slot null when includePlaceholders is not set', () => {
    const result = resolveDefaults(baseConfig(), {}, []);
    expect(result.playerUnits[0].assets.idle).toBeNull();
  });

  it('does not apply a placeholder to audio slots', () => {
    const result = resolveDefaults(baseConfig(), {}, []);
    expect(result.audio.music).toBeNull();
    expect(result.audio.sfxMap.walk).toBeNull();
  });

  it('tags a filled slot with the library asset id it came from', () => {
    const result = resolveDefaults(baseConfig(), { 'unit:idle:archer': 'lib1' }, [archerIdle]);
    expect(result.playerUnits[0].assets.idle?.libraryAssetId).toBe('lib1');
  });
});
