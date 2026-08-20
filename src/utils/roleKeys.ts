function normalizeRoleName(name: string): string {
  return name.trim().toLowerCase();
}

export function unitRoleKey(
  kind: 'idle' | 'attack' | 'projectile',
  name: string
): string | null {
  const key = normalizeRoleName(name);
  return key ? `unit:${kind}:${key}` : null;
}

export function spellRoleKey(
  kind: 'asset' | 'projectileAsset',
  name: string
): string | null {
  const key = normalizeRoleName(name);
  return key ? `spell:${kind}:${key}` : null;
}

export function audioRoleKey(event: string): string {
  return `audio:${event}`;
}

export const FIXED_ROLE_KEYS = {
  heroLeft: 'hero:heroLeft',
  heroRight: 'hero:heroRight',
  popupVictoryBanner: 'popup:victory.banner',
  popupVictoryBoard: 'popup:victory.board',
  popupVictoryCta: 'popup:victory.cta',
  popupDefeatBanner: 'popup:defeat.banner',
  popupDefeatBoard: 'popup:defeat.board',
  popupDefeatRetry: 'popup:defeat.retry',
  popupDefeatStore: 'popup:defeat.store',
  backgroundLandscape: 'background:landscape',
  backgroundPortrait: 'background:portrait',
  gridTileWalkable: 'gridTile:walkable',
  gridTileActive: 'gridTile:active',
  uiMeleeIcon: 'ui:meleeIcon',
  uiRangedIcon: 'ui:rangedIcon',
  uiFlyingIcon: 'ui:flyingIcon',
  uiRangedProjectile: 'ui:rangedProjectile',
  uiSpellbookClosed: 'ui:spellbookClosed',
  uiSpellbookOpen: 'ui:spellbookOpen',
  appIcon: 'appIcon',
  audioMusic: 'audio:music',
} as const;
