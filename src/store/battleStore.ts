import { create } from 'zustand';
import type { BattleConfig, UnitConfig, HeroConfig, SpellConfig, BattleScenario, PopupConfig, AssetData, EnemyTurnDef, AttackReaction, PlayerTurnDef } from '../types/battle';
import { AUDIO_EVENTS } from '../types/battle';

export interface LibraryAsset extends AssetData { id: string; }
export interface TemplateEntry { id: string; name: string; savedAt: number; config: BattleConfig; }

const LIBRARY_KEY = 'battle-editor-library';
function loadLibrary(): LibraryAsset[] {
  try { const raw = localStorage.getItem(LIBRARY_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
function saveLibrary(lib: LibraryAsset[]) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib)); } catch {}
}

const emptyAudioMap = (): Record<string, AssetData | null> =>
  Object.fromEntries(AUDIO_EVENTS.map(e => [e, null]));

export const DEFAULT_CONFIG: BattleConfig = {
  id: crypto.randomUUID(),
  name: 'My Battle',
  spellbookEnabled: true,
  playerUnits: [
    {
      id: 'knight',
      name: 'Frostwolf',
      type: 'melee',
      hp: 100,
      baseDamage: 100,
      defense: 0,
      damageMultiplier: 1,
      gridCol: 1,
      gridRow: 2,
      displayWidth: 110,
      moveRange: 2,
      resistTo: [],
      flipped: false,
      assets: { idle: null, attack: null },
    },
  ],
  enemyUnits: [
    {
      id: 'valkyrie',
      name: 'Valkyrie',
      type: 'flying',
      hp: 100,
      baseDamage: 100,
      defense: 0,
      damageMultiplier: 1,
      gridCol: 4,
      gridRow: 0,
      displayWidth: 115,
      moveRange: 2,
      resistTo: ['ice'],
      flipped: true,
      assets: { idle: null, attack: null },
    },
    {
      id: 'armored_giant',
      name: 'Armored Giant',
      type: 'ranged',
      hp: 100,
      baseDamage: 85,
      defense: 0,
      damageMultiplier: 1,
      gridCol: 3,
      gridRow: 2,
      displayWidth: 130,
      moveRange: 2,
      resistTo: [],
      flipped: true,
      assets: { idle: null, attack: null },
    },
  ],
  heroLeft: { asset: null, flipped: true, posX: 42, posY: 170 },
  heroRight: { asset: null, flipped: false, posX: 42, posY: 150 },
  spells: [
    {
      id: 'fireball',
      name: 'Fireball',
      element: 'fire',
      asset: null,
      sfxShoot: null,
      sfxHit: null,
    },
    {
      id: 'ice_shard',
      name: 'Ice Shard',
      element: 'ice',
      asset: null,
      sfxShoot: null,
      sfxHit: null,
    },
  ],
  scenario: {
    mode: 'puzzle',
    winningSequence: [
      { order: 0, actorUnitId: 'knight', action: 'cast_spell', spellId: 'fireball', targetUnitId: 'valkyrie' },
      { order: 1, actorUnitId: 'knight', action: 'melee_attack', targetUnitId: 'armored_giant' },
    ],
    failConditions: [
      {
        id: 'A',
        trigger: 'move_to_flying',
        hintLines: ['Frostwolf has limited range.', 'He can only', 'reach the Armored Giant.'],
      },
      {
        id: 'B',
        trigger: 'kill_ranged_first',
        hintLines: ['Valkyrie is Flying type.', 'She can always reach you.', 'Try killing her first.'],
      },
      {
        id: 'C',
        trigger: 'wrong_spell_on_flying',
        hintLines: ['Frostborn Faction', 'is immune to Ice.'],
      },
      {
        id: 'D',
        trigger: 'wasted_spell',
        hintLines: ['Valkyrie is Flying type.', 'She can always reach you.', 'Try killing her first.'],
      },
    ],
    retaliations: [
      {
        killedUnitId: 'valkyrie',
        retaliatorUnitId: 'armored_giant',
        damage: 85,
        speechText: 'Armored Giant retaliates!',
        followUpSpeech: 'Now defeat the Armored Giant!',
      },
    ],
    alternating: {
      firstTurn: 'player',
      playerTurns: [{ id: 'pt1', unitId: 'knight' }],
      enemyTurns: [
        { id: 'et1', attackerUnitId: 'valkyrie',      damage: 30, speechText: 'Valkyrie strikes!' },
        { id: 'et2', attackerUnitId: 'armored_giant', damage: 40, speechText: 'Armored Giant charges!' },
      ],
      attackReactions: [
        { enemyUnitId: 'valkyrie',      retaliates: false, retaliationDamage: 0,  retaliationSpeech: '' },
        { enemyUnitId: 'armored_giant', retaliates: true,  retaliationDamage: 20, retaliationSpeech: 'Armored Giant fights back!' },
      ],
    },
  },
  popups: {
    victory: { bannerAsset: null, boardAsset: null, ctaButtonAsset: null },
    defeat: {
      bannerAsset: null,
      boardAsset: null,
      retryButtonAsset: null,
      storeButtonAsset: null,
      hintTextColor: '#ffe8c0',
    },
  },
  backgrounds: { landscape: null, portrait: null },
  store: {
    iosUrl: 'https://apps.apple.com/us/app/magic-war-legends/id1501316113',
    androidUrl: 'https://play.google.com/store/apps/details?id=vikings.strategy.rpg.tactics.card',
    ctaFailCount: 3,
  },
  audio: { music: null, sfxMap: emptyAudioMap() },
  gridTiles: { walkable: null, active: null },
  uiAssets: { spellbookClosed: null, spellbookOpen: null },
  appIcon: null,
};

interface BattleStore {
  config: BattleConfig;
  undoStack: BattleConfig[];
  redoStack: BattleConfig[];
  library: LibraryAsset[];
  templates: TemplateEntry[];

  // Undo/redo
  undo: () => void;
  redo: () => void;

  // Full replace
  loadConfig: (c: BattleConfig) => void;
  resetToDefault: () => void;

  // Granular updaters
  setName: (name: string) => void;
  updatePlayerUnit: (id: string, patch: Partial<UnitConfig>) => void;
  addPlayerUnit: () => void;
  removePlayerUnit: (id: string) => void;
  updateEnemyUnit: (id: string, patch: Partial<UnitConfig>) => void;
  addEnemyUnit: () => void;
  removeEnemyUnit: (id: string) => void;
  setHeroLeft: (patch: Partial<HeroConfig>) => void;
  setHeroRight: (patch: Partial<HeroConfig>) => void;
  updateSpell: (id: string, patch: Partial<SpellConfig>) => void;
  setScenario: (patch: Partial<BattleScenario>) => void;
  addEnemyTurn: () => void;
  removeEnemyTurn: (id: string) => void;
  updateEnemyTurn: (id: string, patch: Partial<EnemyTurnDef>) => void;
  updateAttackReaction: (enemyUnitId: string, patch: Partial<AttackReaction>) => void;
  addPlayerTurn: () => void;
  removePlayerTurn: (id: string) => void;
  updatePlayerTurn: (id: string, patch: Partial<PlayerTurnDef>) => void;
  setSpellbookEnabled: (enabled: boolean) => void;
  setPopups: (patch: Partial<PopupConfig>) => void;
  setBackground: (key: 'landscape' | 'portrait', asset: AssetData | null) => void;
  setStore: (patch: Partial<BattleConfig['store']>) => void;
  setMusic: (asset: AssetData | null) => void;
  setSfx: (event: string, asset: AssetData | null) => void;
  setGridTile: (key: 'walkable' | 'active', asset: AssetData | null) => void;
  setUiAsset: (key: 'spellbookClosed' | 'spellbookOpen', asset: AssetData | null) => void;
  setAppIcon: (asset: AssetData | null) => void;

  // Library
  addToLibrary: (asset: AssetData) => void;
  removeFromLibrary: (id: string) => void;

  // Templates
  saveTemplate: (name: string) => void;
  loadTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
}

const MAX_UNDO = 50;

function pushUndo(get: () => BattleStore): { undoStack: BattleConfig[]; redoStack: BattleConfig[] } {
  const prev = get().undoStack;
  return {
    undoStack: [...prev.slice(-(MAX_UNDO - 1)), get().config],
    redoStack: [],
  };
}

export const useBattleStore = create<BattleStore>((set, get) => ({
  config: DEFAULT_CONFIG,
  undoStack: [],
  redoStack: [],
  library: loadLibrary(),
  templates: [],

  undo() {
    const { undoStack, config } = get();
    if (!undoStack.length) return;
    const prev = undoStack[undoStack.length - 1];
    set({ config: prev, undoStack: undoStack.slice(0, -1), redoStack: [config, ...get().redoStack] });
  },

  redo() {
    const { redoStack, config } = get();
    if (!redoStack.length) return;
    const next = redoStack[0];
    set({ config: next, redoStack: redoStack.slice(1), undoStack: [...get().undoStack, config] });
  },

  loadConfig: (c) => set({ config: c, undoStack: [], redoStack: [] }),
  resetToDefault: () => set({ config: { ...DEFAULT_CONFIG, id: crypto.randomUUID() }, undoStack: [], redoStack: [] }),

  setName: (name) => set(s => ({ ...pushUndo(get), config: { ...s.config, name } })),

  updatePlayerUnit: (id, patch) =>
    set(s => ({
      ...pushUndo(get),
      config: {
        ...s.config,
        playerUnits: s.config.playerUnits.map(u => u.id === id ? { ...u, ...patch } : u),
      },
    })),

  addPlayerUnit: () => {
    if (get().config.playerUnits.length >= 6) return;
    const unit: UnitConfig = {
      id: crypto.randomUUID(),
      name: 'Unit',
      type: 'melee',
      hp: 100,
      baseDamage: 20,
      defense: 0,
      damageMultiplier: 1,
      gridCol: 0,
      gridRow: 0,
      displayWidth: 110,
      moveRange: 2,
      resistTo: [],
      flipped: false,
      assets: { idle: null, attack: null },
    };
    set(s => ({ ...pushUndo(get), config: { ...s.config, playerUnits: [...s.config.playerUnits, unit] } }));
  },

  removePlayerUnit: (id) => {
    if (get().config.playerUnits.length <= 1) return;
    set(s => ({ ...pushUndo(get), config: { ...s.config, playerUnits: s.config.playerUnits.filter(u => u.id !== id) } }));
  },

  updateEnemyUnit: (id, patch) =>
    set(s => ({
      ...pushUndo(get),
      config: {
        ...s.config,
        enemyUnits: s.config.enemyUnits.map(u => u.id === id ? { ...u, ...patch } : u),
      },
    })),

  addEnemyUnit: () => {
    if (get().config.enemyUnits.length >= 6) return;
    const unit: UnitConfig = {
      id: crypto.randomUUID(),
      name: 'Enemy',
      type: 'ranged',
      hp: 100,
      baseDamage: 20,
      defense: 0,
      damageMultiplier: 1,
      gridCol: 2,
      gridRow: 0,
      displayWidth: 110,
      moveRange: 2,
      resistTo: [],
      flipped: true,
      assets: { idle: null, attack: null },
    };
    set(s => ({ ...pushUndo(get), config: { ...s.config, enemyUnits: [...s.config.enemyUnits, unit] } }));
  },

  removeEnemyUnit: (id) => {
    if (get().config.enemyUnits.length <= 1) return;
    set(s => ({ ...pushUndo(get), config: { ...s.config, enemyUnits: s.config.enemyUnits.filter(u => u.id !== id) } }));
  },

  setHeroLeft: (patch) => set(s => ({ ...pushUndo(get), config: { ...s.config, heroLeft: { ...s.config.heroLeft, ...patch } } })),
  setHeroRight: (patch) => set(s => ({ ...pushUndo(get), config: { ...s.config, heroRight: { ...s.config.heroRight, ...patch } } })),

  updateSpell: (id, patch) =>
    set(s => ({
      ...pushUndo(get),
      config: { ...s.config, spells: s.config.spells.map(sp => sp.id === id ? { ...sp, ...patch } : sp) },
    })),

  setScenario: (patch) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, scenario: { ...s.config.scenario, ...patch } } })),

  addEnemyTurn: () => {
    const enemy = get().config.enemyUnits[0];
    const turn: EnemyTurnDef = { id: crypto.randomUUID(), attackerUnitId: enemy?.id ?? '', damage: 20, speechText: '' };
    const alt = get().config.scenario.alternating;
    set(s => ({ ...pushUndo(get), config: { ...s.config, scenario: { ...s.config.scenario, alternating: { ...alt, enemyTurns: [...alt.enemyTurns, turn] } } } }));
  },

  removeEnemyTurn: (id) => {
    const alt = get().config.scenario.alternating;
    set(s => ({ ...pushUndo(get), config: { ...s.config, scenario: { ...s.config.scenario, alternating: { ...alt, enemyTurns: alt.enemyTurns.filter(t => t.id !== id) } } } }));
  },

  updateEnemyTurn: (id, patch) => {
    const alt = get().config.scenario.alternating;
    set(s => ({ ...pushUndo(get), config: { ...s.config, scenario: { ...s.config.scenario, alternating: { ...alt, enemyTurns: alt.enemyTurns.map(t => t.id === id ? { ...t, ...patch } : t) } } } }));
  },

  updateAttackReaction: (enemyUnitId, patch) => {
    const alt = get().config.scenario.alternating;
    const reactions = alt.attackReactions.some(r => r.enemyUnitId === enemyUnitId)
      ? alt.attackReactions.map(r => r.enemyUnitId === enemyUnitId ? { ...r, ...patch } : r)
      : [...alt.attackReactions, { enemyUnitId, retaliates: false, retaliationDamage: 0, retaliationSpeech: '', ...patch }];
    set(s => ({ ...pushUndo(get), config: { ...s.config, scenario: { ...s.config.scenario, alternating: { ...alt, attackReactions: reactions } } } }));
  },

  addPlayerTurn: () => {
    const alt = get().config.scenario.alternating;
    const turn: PlayerTurnDef = { id: crypto.randomUUID(), unitId: get().config.playerUnits[0]?.id ?? '' };
    set(s => ({ ...pushUndo(get), config: { ...s.config, scenario: { ...s.config.scenario, alternating: { ...alt, playerTurns: [...(alt.playerTurns ?? []), turn] } } } }));
  },

  removePlayerTurn: (id) => {
    const alt = get().config.scenario.alternating;
    const turns = (alt.playerTurns ?? []).filter(t => t.id !== id);
    if (!turns.length) return;
    set(s => ({ ...pushUndo(get), config: { ...s.config, scenario: { ...s.config.scenario, alternating: { ...alt, playerTurns: turns } } } }));
  },

  updatePlayerTurn: (id, patch) => {
    const alt = get().config.scenario.alternating;
    const turns = (alt.playerTurns ?? []).map(t => t.id === id ? { ...t, ...patch } : t);
    set(s => ({ ...pushUndo(get), config: { ...s.config, scenario: { ...s.config.scenario, alternating: { ...alt, playerTurns: turns } } } }));
  },

  setSpellbookEnabled: (enabled) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, spellbookEnabled: enabled } })),

  setPopups: (patch) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, popups: { ...s.config.popups, ...patch } } })),

  setBackground: (key, asset) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, backgrounds: { ...s.config.backgrounds, [key]: asset } } })),

  setStore: (patch) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, store: { ...s.config.store, ...patch } } })),

  setMusic: (asset) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, audio: { ...s.config.audio, music: asset } } })),

  setSfx: (event, asset) =>
    set(s => ({
      ...pushUndo(get),
      config: { ...s.config, audio: { ...s.config.audio, sfxMap: { ...s.config.audio.sfxMap, [event]: asset } } },
    })),

  setGridTile: (key, asset) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, gridTiles: { ...s.config.gridTiles, [key]: asset } } })),

  setUiAsset: (key, asset) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, uiAssets: { ...s.config.uiAssets, [key]: asset } } })),

  setAppIcon: (asset) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, appIcon: asset } })),

  addToLibrary: (asset) =>
    set(s => {
      const library = [...s.library, { ...asset, id: crypto.randomUUID() }];
      saveLibrary(library);
      return { library };
    }),

  removeFromLibrary: (id) =>
    set(s => {
      const library = s.library.filter(a => a.id !== id);
      saveLibrary(library);
      return { library };
    }),

  saveTemplate: (name) => {
    const entry: TemplateEntry = { id: crypto.randomUUID(), name, savedAt: Date.now(), config: get().config };
    set(s => ({ templates: [...s.templates, entry] }));
  },

  loadTemplate: (id) => {
    const entry = get().templates.find(t => t.id === id);
    if (entry) set({ config: { ...entry.config, id: crypto.randomUUID() }, undoStack: [], redoStack: [] });
  },

  deleteTemplate: (id) =>
    set(s => ({ templates: s.templates.filter(t => t.id !== id) })),
}));
