import type { AssetData, BattleConfig, LibraryAsset, RoleDefaults } from '../types/battle';
import { AUDIO_EVENTS } from '../types/battle';
import { audioRoleKey, FIXED_ROLE_KEYS, spellRoleKey, unitRoleKey } from './roleKeys';
import { PLACEHOLDER_ICON, PLACEHOLDER_PROJECTILE, PLACEHOLDER_UNIT_ATTACK, PLACEHOLDER_UNIT_IDLE } from './placeholderAssets';

export function lookupRoleDefault(
  roleKey: string | null,
  roleDefaults: RoleDefaults,
  library: LibraryAsset[]
): AssetData | null {
  if (!roleKey) return null;
  const assetId = roleDefaults[roleKey];
  if (!assetId) return null;
  const found = library.find(a => a.id === assetId);
  if (!found) return null;
  return { dataUri: found.dataUri, mimeType: found.mimeType, fileName: found.fileName, libraryAssetId: found.id };
}

export function resolveDefaults(
  config: BattleConfig,
  roleDefaults: RoleDefaults,
  library: LibraryAsset[],
  includePlaceholders = false
): BattleConfig {
  const fill = (current: AssetData | null | undefined, roleKey: string | null): AssetData | null =>
    current ?? lookupRoleDefault(roleKey, roleDefaults, library);

  const fillWithPlaceholder = (
    current: AssetData | null | undefined,
    roleKey: string | null,
    placeholder: AssetData
  ): AssetData | null =>
    current ?? lookupRoleDefault(roleKey, roleDefaults, library) ?? (includePlaceholders ? placeholder : null);

  return {
    ...config,
    playerUnits: config.playerUnits.map(u => ({
      ...u,
      assets: {
        idle: fillWithPlaceholder(u.assets.idle, unitRoleKey('idle', u.name), PLACEHOLDER_UNIT_IDLE),
        attack: fillWithPlaceholder(u.assets.attack, unitRoleKey('attack', u.name), PLACEHOLDER_UNIT_ATTACK),
        projectile: fill(u.assets.projectile, unitRoleKey('projectile', u.name)),
      },
    })),
    enemyUnits: config.enemyUnits.map(u => ({
      ...u,
      assets: {
        idle: fillWithPlaceholder(u.assets.idle, unitRoleKey('idle', u.name), PLACEHOLDER_UNIT_IDLE),
        attack: fillWithPlaceholder(u.assets.attack, unitRoleKey('attack', u.name), PLACEHOLDER_UNIT_ATTACK),
        projectile: fill(u.assets.projectile, unitRoleKey('projectile', u.name)),
      },
    })),
    heroLeft: { ...config.heroLeft, asset: fill(config.heroLeft.asset, FIXED_ROLE_KEYS.heroLeft) },
    heroRight: { ...config.heroRight, asset: fill(config.heroRight.asset, FIXED_ROLE_KEYS.heroRight) },
    spells: config.spells.map(s => ({
      ...s,
      asset: fill(s.asset, spellRoleKey('asset', s.name)),
      projectileAsset: fillWithPlaceholder(s.projectileAsset, spellRoleKey('projectileAsset', s.name), PLACEHOLDER_PROJECTILE),
    })),
    popups: {
      victory: {
        bannerAsset: fill(config.popups.victory.bannerAsset, FIXED_ROLE_KEYS.popupVictoryBanner),
        boardAsset: fill(config.popups.victory.boardAsset, FIXED_ROLE_KEYS.popupVictoryBoard),
        ctaButtonAsset: fill(config.popups.victory.ctaButtonAsset, FIXED_ROLE_KEYS.popupVictoryCta),
      },
      defeat: {
        ...config.popups.defeat,
        bannerAsset: fill(config.popups.defeat.bannerAsset, FIXED_ROLE_KEYS.popupDefeatBanner),
        boardAsset: fill(config.popups.defeat.boardAsset, FIXED_ROLE_KEYS.popupDefeatBoard),
        retryButtonAsset: fill(config.popups.defeat.retryButtonAsset, FIXED_ROLE_KEYS.popupDefeatRetry),
        storeButtonAsset: fill(config.popups.defeat.storeButtonAsset, FIXED_ROLE_KEYS.popupDefeatStore),
      },
    },
    backgrounds: {
      landscape: fill(config.backgrounds.landscape, FIXED_ROLE_KEYS.backgroundLandscape),
      portrait: fill(config.backgrounds.portrait, FIXED_ROLE_KEYS.backgroundPortrait),
    },
    gridTiles: {
      walkable: fill(config.gridTiles.walkable, FIXED_ROLE_KEYS.gridTileWalkable),
      active: fill(config.gridTiles.active, FIXED_ROLE_KEYS.gridTileActive),
    },
    uiAssets: {
      spellbookClosed: fill(config.uiAssets?.spellbookClosed ?? null, FIXED_ROLE_KEYS.uiSpellbookClosed),
      spellbookOpen: fill(config.uiAssets?.spellbookOpen ?? null, FIXED_ROLE_KEYS.uiSpellbookOpen),
      meleeIcon: fill(config.uiAssets?.meleeIcon ?? null, FIXED_ROLE_KEYS.uiMeleeIcon),
      rangedIcon: fill(config.uiAssets?.rangedIcon ?? null, FIXED_ROLE_KEYS.uiRangedIcon),
      flyingIcon: fill(config.uiAssets?.flyingIcon ?? null, FIXED_ROLE_KEYS.uiFlyingIcon),
      rangedProjectile: fillWithPlaceholder(config.uiAssets?.rangedProjectile ?? null, FIXED_ROLE_KEYS.uiRangedProjectile, PLACEHOLDER_PROJECTILE),
    },
    appIcon: fillWithPlaceholder(config.appIcon ?? null, FIXED_ROLE_KEYS.appIcon, PLACEHOLDER_ICON),
    audio: {
      music: fill(config.audio.music, FIXED_ROLE_KEYS.audioMusic),
      sfxMap: Object.fromEntries(
        AUDIO_EVENTS.map(ev => [ev, fill(config.audio.sfxMap[ev] ?? null, audioRoleKey(ev))])
      ),
    },
  };
}
