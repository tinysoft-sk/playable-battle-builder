import type { AssetData, BattleConfig, LibraryAsset, RoleDefaults } from '../types/battle';
import { resolveDefaults } from './resolveDefaults';

export type SlimAssetSlot = { libraryAssetId: string } | AssetData | null;

function slimAsset(asset: AssetData | null | undefined, library: LibraryAsset[]): SlimAssetSlot {
  if (!asset) return null;
  if (asset.libraryAssetId && library.some(a => a.id === asset.libraryAssetId)) {
    return { libraryAssetId: asset.libraryAssetId };
  }
  return asset;
}

function hydrateAsset(slot: SlimAssetSlot, library: LibraryAsset[]): AssetData | null {
  if (!slot) return null;
  if (!('dataUri' in slot)) {
    const found = library.find(a => a.id === slot.libraryAssetId);
    return found ? { dataUri: found.dataUri, mimeType: found.mimeType, fileName: found.fileName, libraryAssetId: found.id } : null;
  }
  return slot;
}

export function slimTemplate(config: BattleConfig, library: LibraryAsset[]): unknown {
  return {
    ...config,
    playerUnits: config.playerUnits.map(u => ({
      ...u,
      assets: {
        idle: slimAsset(u.assets.idle, library),
        attack: slimAsset(u.assets.attack, library),
        projectile: slimAsset(u.assets.projectile, library),
      },
    })),
    enemyUnits: config.enemyUnits.map(u => ({
      ...u,
      assets: {
        idle: slimAsset(u.assets.idle, library),
        attack: slimAsset(u.assets.attack, library),
        projectile: slimAsset(u.assets.projectile, library),
      },
    })),
    heroLeft: { ...config.heroLeft, asset: slimAsset(config.heroLeft.asset, library) },
    heroRight: { ...config.heroRight, asset: slimAsset(config.heroRight.asset, library) },
    spells: config.spells.map(s => ({
      ...s,
      asset: slimAsset(s.asset, library),
      projectileAsset: slimAsset(s.projectileAsset, library),
    })),
    popups: {
      victory: {
        bannerAsset: slimAsset(config.popups.victory.bannerAsset, library),
        boardAsset: slimAsset(config.popups.victory.boardAsset, library),
        ctaButtonAsset: slimAsset(config.popups.victory.ctaButtonAsset, library),
      },
      defeat: {
        ...config.popups.defeat,
        bannerAsset: slimAsset(config.popups.defeat.bannerAsset, library),
        boardAsset: slimAsset(config.popups.defeat.boardAsset, library),
        retryButtonAsset: slimAsset(config.popups.defeat.retryButtonAsset, library),
        storeButtonAsset: slimAsset(config.popups.defeat.storeButtonAsset, library),
      },
    },
    backgrounds: {
      landscape: slimAsset(config.backgrounds.landscape, library),
      portrait: slimAsset(config.backgrounds.portrait, library),
    },
    gridTiles: {
      walkable: slimAsset(config.gridTiles.walkable, library),
      active: slimAsset(config.gridTiles.active, library),
    },
    uiAssets: {
      spellbookClosed: slimAsset(config.uiAssets?.spellbookClosed ?? null, library),
      spellbookOpen: slimAsset(config.uiAssets?.spellbookOpen ?? null, library),
      meleeIcon: slimAsset(config.uiAssets?.meleeIcon ?? null, library),
      rangedIcon: slimAsset(config.uiAssets?.rangedIcon ?? null, library),
      flyingIcon: slimAsset(config.uiAssets?.flyingIcon ?? null, library),
      rangedProjectile: slimAsset(config.uiAssets?.rangedProjectile ?? null, library),
    },
    appIcon: slimAsset(config.appIcon ?? null, library),
    audio: {
      music: slimAsset(config.audio.music, library),
      sfxMap: Object.fromEntries(
        Object.entries(config.audio.sfxMap).map(([ev, a]) => [ev, slimAsset(a, library)])
      ),
    },
  };
}

export function hydrateTemplate(slim: unknown, library: LibraryAsset[], roleDefaults: RoleDefaults): BattleConfig {
  const s = slim as BattleConfig;
  const asSlot = (v: unknown): SlimAssetSlot => v as SlimAssetSlot;
  const hydrated: BattleConfig = {
    ...s,
    playerUnits: s.playerUnits.map(u => ({
      ...u,
      assets: {
        idle: hydrateAsset(asSlot(u.assets.idle), library),
        attack: hydrateAsset(asSlot(u.assets.attack), library),
        projectile: hydrateAsset(asSlot(u.assets.projectile), library),
      },
    })),
    enemyUnits: s.enemyUnits.map(u => ({
      ...u,
      assets: {
        idle: hydrateAsset(asSlot(u.assets.idle), library),
        attack: hydrateAsset(asSlot(u.assets.attack), library),
        projectile: hydrateAsset(asSlot(u.assets.projectile), library),
      },
    })),
    heroLeft: { ...s.heroLeft, asset: hydrateAsset(asSlot(s.heroLeft.asset), library) },
    heroRight: { ...s.heroRight, asset: hydrateAsset(asSlot(s.heroRight.asset), library) },
    spells: s.spells.map(sp => ({
      ...sp,
      asset: hydrateAsset(asSlot(sp.asset), library),
      projectileAsset: hydrateAsset(asSlot(sp.projectileAsset), library),
    })),
    popups: {
      victory: {
        bannerAsset: hydrateAsset(asSlot(s.popups.victory.bannerAsset), library),
        boardAsset: hydrateAsset(asSlot(s.popups.victory.boardAsset), library),
        ctaButtonAsset: hydrateAsset(asSlot(s.popups.victory.ctaButtonAsset), library),
      },
      defeat: {
        ...s.popups.defeat,
        bannerAsset: hydrateAsset(asSlot(s.popups.defeat.bannerAsset), library),
        boardAsset: hydrateAsset(asSlot(s.popups.defeat.boardAsset), library),
        retryButtonAsset: hydrateAsset(asSlot(s.popups.defeat.retryButtonAsset), library),
        storeButtonAsset: hydrateAsset(asSlot(s.popups.defeat.storeButtonAsset), library),
      },
    },
    backgrounds: {
      landscape: hydrateAsset(asSlot(s.backgrounds.landscape), library),
      portrait: hydrateAsset(asSlot(s.backgrounds.portrait), library),
    },
    gridTiles: {
      walkable: hydrateAsset(asSlot(s.gridTiles.walkable), library),
      active: hydrateAsset(asSlot(s.gridTiles.active), library),
    },
    uiAssets: {
      spellbookClosed: hydrateAsset(asSlot(s.uiAssets?.spellbookClosed ?? null), library),
      spellbookOpen: hydrateAsset(asSlot(s.uiAssets?.spellbookOpen ?? null), library),
      meleeIcon: hydrateAsset(asSlot(s.uiAssets?.meleeIcon ?? null), library),
      rangedIcon: hydrateAsset(asSlot(s.uiAssets?.rangedIcon ?? null), library),
      flyingIcon: hydrateAsset(asSlot(s.uiAssets?.flyingIcon ?? null), library),
      rangedProjectile: hydrateAsset(asSlot(s.uiAssets?.rangedProjectile ?? null), library),
    },
    appIcon: hydrateAsset(asSlot(s.appIcon ?? null), library),
    audio: {
      music: hydrateAsset(asSlot(s.audio.music), library),
      sfxMap: Object.fromEntries(
        Object.entries(s.audio.sfxMap).map(([ev, a]) => [ev, hydrateAsset(asSlot(a), library)])
      ),
    },
  };
  return resolveDefaults(hydrated, roleDefaults, library);
}
