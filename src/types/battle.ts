export type UnitType = 'melee' | 'ranged' | 'flying';
export type SpellElement = 'fire' | 'ice';
export type NetworkTarget = 'facebook' | 'google' | 'unity' | 'mintegral';

export interface AssetData {
  dataUri: string;
  mimeType: string;
  fileName: string;
}

export interface UnitConfig {
  id: string;
  name: string;
  type: UnitType;
  hp: number;
  baseDamage: number;
  defense: number;
  damageMultiplier: number;
  gridCol: number;
  gridRow: number;
  displayWidth: number;
  moveRange: number;
  resistTo: SpellElement[];
  flipped: boolean;
  assets: {
    idle: AssetData | null;
    attack: AssetData | null;
  };
}

export interface HeroConfig {
  asset: AssetData | null;
  flipped: boolean;
  posX: number;
  posY: number;
}

export interface SpellConfig {
  id: string;
  name: string;
  element: SpellElement;
  asset: AssetData | null;
  sfxShoot: AssetData | null;
  sfxHit: AssetData | null;
}

export interface FailCondition {
  id: 'A' | 'B' | 'C' | 'D';
  trigger: 'move_to_flying' | 'kill_ranged_first' | 'wrong_spell_on_flying' | 'wasted_spell';
  hintLines: string[];
}

export interface WinStep {
  order: number;
  actorUnitId: string;
  action: 'cast_spell' | 'melee_attack' | 'ranged_attack';
  spellId?: string;
  targetUnitId: string;
}

export interface PostKillRetaliation {
  killedUnitId: string;
  retaliatorUnitId: string;
  damage: number;
  speechText: string;
  followUpSpeech: string;
}

export interface EnemyTurnDef {
  id: string;
  attackerUnitId: string;
  damage: number;
  speechText: string;
}

export interface AttackReaction {
  enemyUnitId: string;
  retaliates: boolean;
  retaliationDamage: number;
  retaliationSpeech: string;
}

export interface PlayerTurnDef {
  id: string;
  unitId: string;
}

export interface AlternatingConfig {
  firstTurn: 'player' | 'enemy';
  playerTurns: PlayerTurnDef[];
  enemyTurns: EnemyTurnDef[];
  attackReactions: AttackReaction[];
}

export interface BattleScenario {
  mode: 'puzzle' | 'alternating';
  winningSequence: WinStep[];
  failConditions: FailCondition[];
  retaliations: PostKillRetaliation[];
  alternating: AlternatingConfig;
}

export interface PopupConfig {
  victory: {
    bannerAsset: AssetData | null;
    boardAsset: AssetData | null;
    ctaButtonAsset: AssetData | null;
  };
  defeat: {
    bannerAsset: AssetData | null;
    boardAsset: AssetData | null;
    retryButtonAsset: AssetData | null;
    storeButtonAsset: AssetData | null;
    hintTextColor: string;
  };
}

export interface BattleConfig {
  id: string;
  name: string;
  spellbookEnabled: boolean;
  playerUnits: UnitConfig[];
  enemyUnits: UnitConfig[];
  heroLeft: HeroConfig;
  heroRight: HeroConfig;
  spells: SpellConfig[];
  scenario: BattleScenario;
  popups: PopupConfig;
  backgrounds: {
    landscape: AssetData | null;
    portrait: AssetData | null;
  };
  store: {
    iosUrl: string;
    androidUrl: string;
    ctaFailCount: number;
  };
  audio: {
    music: AssetData | null;
    sfxMap: Record<string, AssetData | null>;
  };
  gridTiles: {
    walkable: AssetData | null;
    active: AssetData | null;
  };
  uiAssets: {
    spellbookClosed: AssetData | null;
    spellbookOpen: AssetData | null;
    meleeIcon: AssetData | null;
    rangedIcon: AssetData | null;
    flyingIcon: AssetData | null;
  };
  appIcon: AssetData | null;
}

export const AUDIO_EVENTS = [
  'spellbook_open',
  'spell_select',
  'walk',
  'grid_select',
  'spell1_shoot',
  'spell1_hit',
  'spell2_shoot',
  'spell2_hit',
  'player_attack',
  'player_death',
  'flying_attack',
  'flying_death',
  'ranged_attack',
  'ranged_death',
  'fail',
] as const;

export type AudioEvent = typeof AUDIO_EVENTS[number];
