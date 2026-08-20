import { create } from 'zustand';
import type { BattleConfig, UnitConfig, HeroConfig, SpellConfig, BattleScenario, PopupConfig, AssetData, EnemyTurnDef, AttackReaction, PlayerTurnDef, LibraryAsset, RoleDefaults } from '../types/battle';
import { AUDIO_EVENTS } from '../types/battle';
import { resolveDefaults, lookupRoleDefault } from '../utils/resolveDefaults';
import { unitRoleKey, spellRoleKey } from '../utils/roleKeys';

export interface TemplateEntry { id: string; name: string; savedAt: number; config: BattleConfig; }

const LIBRARY_KEY = 'battle-editor-library';
function loadLibrary(): LibraryAsset[] {
  try { const raw = localStorage.getItem(LIBRARY_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
function saveLibrary(lib: LibraryAsset[]) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib)); } catch {}
}
function saveLocalLibrary(library: LibraryAsset[], remoteLibraryIds: string[]) {
  const remoteSet = new Set(remoteLibraryIds);
  saveLibrary(library.filter(a => !remoteSet.has(a.id)));
}

const ROLE_DEFAULTS_KEY = 'battle-editor-role-defaults';
function loadRoleDefaults(): RoleDefaults {
  try { const raw = localStorage.getItem(ROLE_DEFAULTS_KEY); if (raw) return JSON.parse(raw); } catch {}
  return {};
}
function saveRoleDefaults(defaults: RoleDefaults) {
  try { localStorage.setItem(ROLE_DEFAULTS_KEY, JSON.stringify(defaults)); } catch {}
}

const PENDING_KEY = 'battle-editor-pending-publishes';
type PendingPublish = { roleKey: string | null; asset: LibraryAsset; status: 'syncing' | 'failed' };
function loadPending(): Record<string, PendingPublish> {
  try { const raw = localStorage.getItem(PENDING_KEY); if (raw) return JSON.parse(raw); } catch {}
  return {};
}
function savePending(pending: Record<string, PendingPublish>) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(pending)); } catch {}
}

async function publishAsset(roleKey: string | null, asset: LibraryAsset): Promise<boolean> {
  const url = import.meta.env.VITE_LIBRARY_WORKER_URL as string | undefined;
  if (!url) return true; // no Worker configured yet — treat as a harmless local-only success
  const passphrase = import.meta.env.VITE_LIBRARY_PUBLISH_PASSPHRASE as string | undefined;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passphrase,
        roleKey,
        asset: { id: asset.id, dataUri: asset.dataUri, mimeType: asset.mimeType, fileName: asset.fileName },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchSharedLibrary(): Promise<{ library: LibraryAsset[]; roleDefaults: RoleDefaults }> {
  try {
    const [libRes, defRes] = await Promise.all([
      fetch('library/library.json'),
      fetch('library/role-defaults.json'),
    ]);
    const library = libRes.ok ? await libRes.json() : [];
    const roleDefaults = defRes.ok ? await defRes.json() : {};
    return { library, roleDefaults };
  } catch {
    return { library: [], roleDefaults: {} };
  }
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
      projectileSize: 60,
      resistTo: [],
      flipped: false,
      assets: { idle: null, attack: null, projectile: null },
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
      projectileSize: 60,
      resistTo: ['ice'],
      flipped: true,
      assets: { idle: null, attack: null, projectile: null },
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
      projectileSize: 60,
      resistTo: [],
      flipped: true,
      assets: { idle: null, attack: null, projectile: null },
    },
  ],
  heroLeft: { asset: null, flipped: true, posX: 42, posY: 170, displayWidth: 128 },
  heroRight: { asset: null, flipped: false, posX: 42, posY: 150, displayWidth: 128 },
  spells: [
    {
      id: 'fireball',
      name: 'Fireball',
      element: 'fire',
      asset: null,
      projectileAsset: null,
      projectileSize: 60,
      sfxShoot: null,
      sfxHit: null,
    },
    {
      id: 'ice_shard',
      name: 'Ice Shard',
      element: 'ice',
      asset: null,
      projectileAsset: null,
      projectileSize: 60,
      sfxShoot: null,
      sfxHit: null,
    },
  ],
  scenario: {
    mode: 'puzzle',
    introSpeech: '',
    winningSequence: [
      { order: 0, actorUnitId: 'knight', action: 'cast_spell', spellId: 'fireball', targetUnitId: 'valkyrie', tooltipText: 'Cast Fireball on the Valkyrie first — she flies and can always reach you, and only fire hurts her.' },
      { order: 1, actorUnitId: 'knight', action: 'melee_attack', targetUnitId: 'armored_giant', tooltipText: 'Now finish off the Armored Giant with a melee strike.' },
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
        { id: 'et1', attackerUnitId: 'valkyrie',      action: 'attack' as const, targetUnitId: '', damage: 30, speechText: 'Valkyrie strikes!',       moveTargetCol: 0, moveTargetRow: 0 },
        { id: 'et2', attackerUnitId: 'armored_giant', action: 'attack' as const, targetUnitId: '', damage: 10, speechText: 'Armored Giant charges!', moveTargetCol: 0, moveTargetRow: 0 },
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
  uiAssets: { spellbookClosed: null, spellbookOpen: null, meleeIcon: null, rangedIcon: null, flyingIcon: null, rangedProjectile: null },
  appIcon: null,
  grid: { cols: 5, rows: 4 },
  gridOffset: { landscape: 0, portrait: 0 },
  hintLayout: { landscapeY: 265, portraitY: 265, landscapeFontSize: 13.5, portraitFontSize: 13.5 },
  speechLayout: { landscapeX: 160, landscapeY: 14, landscapeFontSize: 13, portraitX: 14, portraitY: 14, portraitFontSize: 13 },
};

interface BattleStore {
  config: BattleConfig;
  undoStack: BattleConfig[];
  redoStack: BattleConfig[];
  library: LibraryAsset[];
  templates: TemplateEntry[];
  roleDefaults: RoleDefaults;
  pendingPublishes: Record<string, PendingPublish>;
  remoteLibraryIds: string[];

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
  setGridSize: (patch: Partial<{ cols: number; rows: number }>) => void;
  setUiAsset: (key: keyof BattleConfig['uiAssets'], asset: AssetData | null) => void;
  setAppIcon: (asset: AssetData | null) => void;
  setGridOffset: (key: 'landscape' | 'portrait', value: number) => void;
  setHintLayout: (patch: Partial<BattleConfig['hintLayout']>) => void;
  setSpeechLayout: (patch: Partial<BattleConfig['speechLayout']>) => void;

  // Library
  addToLibrary: (asset: AssetData) => void;
  removeFromLibrary: (id: string) => void;
  recordUpload: (roleKey: string | null, asset: AssetData) => LibraryAsset;
  setRoleDefault: (roleKey: string, assetId: string) => void;
  retryPublish: (assetId: string) => void;
  initLibrary: () => Promise<void>;

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
  config: resolveDefaults(DEFAULT_CONFIG, loadRoleDefaults(), loadLibrary()),
  undoStack: [],
  redoStack: [],
  library: loadLibrary(),
  templates: [],
  roleDefaults: loadRoleDefaults(),
  pendingPublishes: loadPending(),
  remoteLibraryIds: [],

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

  loadConfig: (c) => {
    // Merge with DEFAULT_CONFIG so fields added after an export still get safe defaults
    const normalized: BattleConfig = {
      ...DEFAULT_CONFIG,
      ...c,
      audio: {
        music: c.audio?.music ?? null,
        sfxMap: { ...emptyAudioMap(), ...(c.audio?.sfxMap ?? {}) },
      },
      store: { ...DEFAULT_CONFIG.store, ...(c.store ?? {}) },
      backgrounds: { ...DEFAULT_CONFIG.backgrounds, ...(c.backgrounds ?? {}) },
      heroLeft: { ...DEFAULT_CONFIG.heroLeft, ...(c.heroLeft ?? {}) },
      heroRight: { ...DEFAULT_CONFIG.heroRight, ...(c.heroRight ?? {}) },
      grid: { ...DEFAULT_CONFIG.grid, ...(c.grid ?? {}) },
      gridOffset: { ...DEFAULT_CONFIG.gridOffset, ...(c.gridOffset ?? {}) },
      hintLayout: { ...DEFAULT_CONFIG.hintLayout, ...(c.hintLayout ?? {}) },
      speechLayout: { ...DEFAULT_CONFIG.speechLayout, ...(c.speechLayout ?? {}) },
      uiAssets: { ...DEFAULT_CONFIG.uiAssets, ...(c.uiAssets ?? {}) },
    };
    set(s => ({ config: resolveDefaults(normalized, s.roleDefaults, s.library), undoStack: [], redoStack: [] }));
  },
  resetToDefault: () =>
    set(s => ({
      config: resolveDefaults({ ...DEFAULT_CONFIG, id: crypto.randomUUID() }, s.roleDefaults, s.library),
      undoStack: [],
      redoStack: [],
    })),

  setName: (name) => set(s => ({ ...pushUndo(get), config: { ...s.config, name } })),

  updatePlayerUnit: (id, patch) =>
    set(s => ({
      ...pushUndo(get),
      config: {
        ...s.config,
        playerUnits: s.config.playerUnits.map(u => {
          if (u.id !== id) return u;
          const updated: UnitConfig = { ...u, ...patch };
          if (!('name' in patch)) return updated;
          return {
            ...updated,
            assets: {
              idle: updated.assets.idle ?? lookupRoleDefault(unitRoleKey('idle', updated.name), s.roleDefaults, s.library),
              attack: updated.assets.attack ?? lookupRoleDefault(unitRoleKey('attack', updated.name), s.roleDefaults, s.library),
              projectile: updated.assets.projectile ?? lookupRoleDefault(unitRoleKey('projectile', updated.name), s.roleDefaults, s.library),
            },
          };
        }),
      },
    })),

  addPlayerUnit: () => {
    if (get().config.playerUnits.length >= 6) return;
    set(s => {
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
        projectileSize: 60,
        resistTo: [],
        flipped: false,
        assets: {
          idle: lookupRoleDefault(unitRoleKey('idle', 'Unit'), s.roleDefaults, s.library),
          attack: lookupRoleDefault(unitRoleKey('attack', 'Unit'), s.roleDefaults, s.library),
          projectile: lookupRoleDefault(unitRoleKey('projectile', 'Unit'), s.roleDefaults, s.library),
        },
      };
      return { ...pushUndo(get), config: { ...s.config, playerUnits: [...s.config.playerUnits, unit] } };
    });
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
        enemyUnits: s.config.enemyUnits.map(u => {
          if (u.id !== id) return u;
          const updated: UnitConfig = { ...u, ...patch };
          if (!('name' in patch)) return updated;
          return {
            ...updated,
            assets: {
              idle: updated.assets.idle ?? lookupRoleDefault(unitRoleKey('idle', updated.name), s.roleDefaults, s.library),
              attack: updated.assets.attack ?? lookupRoleDefault(unitRoleKey('attack', updated.name), s.roleDefaults, s.library),
              projectile: updated.assets.projectile ?? lookupRoleDefault(unitRoleKey('projectile', updated.name), s.roleDefaults, s.library),
            },
          };
        }),
      },
    })),

  addEnemyUnit: () => {
    if (get().config.enemyUnits.length >= 6) return;
    set(s => {
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
        projectileSize: 60,
        resistTo: [],
        flipped: true,
        assets: {
          idle: lookupRoleDefault(unitRoleKey('idle', 'Enemy'), s.roleDefaults, s.library),
          attack: lookupRoleDefault(unitRoleKey('attack', 'Enemy'), s.roleDefaults, s.library),
          projectile: lookupRoleDefault(unitRoleKey('projectile', 'Enemy'), s.roleDefaults, s.library),
        },
      };
      return { ...pushUndo(get), config: { ...s.config, enemyUnits: [...s.config.enemyUnits, unit] } };
    });
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
      config: {
        ...s.config,
        spells: s.config.spells.map(sp => {
          if (sp.id !== id) return sp;
          const updated: SpellConfig = { ...sp, ...patch };
          if (!('name' in patch)) return updated;
          return {
            ...updated,
            asset: updated.asset ?? lookupRoleDefault(spellRoleKey('asset', updated.name), s.roleDefaults, s.library),
            projectileAsset: updated.projectileAsset ?? lookupRoleDefault(spellRoleKey('projectileAsset', updated.name), s.roleDefaults, s.library),
          };
        }),
      },
    })),

  setScenario: (patch) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, scenario: { ...s.config.scenario, ...patch } } })),

  addEnemyTurn: () => {
    const enemy = get().config.enemyUnits[0];
    const turn: EnemyTurnDef = { id: crypto.randomUUID(), attackerUnitId: enemy?.id ?? '', action: 'attack', targetUnitId: '', damage: 20, speechText: '', moveTargetCol: 0, moveTargetRow: 0 };
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

  setGridSize: (patch) => {
    const clamp = (v: number, lo: number, hi: number, dflt: number) =>
      Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : dflt;
    set(s => {
      const next = { ...s.config.grid, ...patch };
      return {
        ...pushUndo(get),
        config: { ...s.config, grid: { cols: clamp(next.cols, 2, 10, 5), rows: clamp(next.rows, 2, 8, 4) } },
      };
    });
  },

  setUiAsset: (key, asset) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, uiAssets: { ...s.config.uiAssets, [key]: asset } } })),

  setAppIcon: (asset) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, appIcon: asset } })),

  setGridOffset: (key, value) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, gridOffset: { ...s.config.gridOffset, [key]: value } } })),

  setHintLayout: (patch) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, hintLayout: { ...s.config.hintLayout, ...patch } } })),

  setSpeechLayout: (patch) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, speechLayout: { ...s.config.speechLayout, ...patch } } })),

  addToLibrary: (asset) => { get().recordUpload(null, asset); },

  removeFromLibrary: (id) =>
    set(s => {
      const library = s.library.filter(a => a.id !== id);
      const roleDefaults = Object.fromEntries(
        Object.entries(s.roleDefaults).filter(([, assetId]) => assetId !== id)
      );
      saveLocalLibrary(library, s.remoteLibraryIds);
      saveRoleDefaults(roleDefaults);
      return { library, roleDefaults };
    }),

  recordUpload: (roleKey, asset) => {
    const libraryAsset: LibraryAsset = { ...asset, id: crypto.randomUUID() };
    set(s => {
      const library = [...s.library, libraryAsset];
      const roleDefaults = roleKey ? { ...s.roleDefaults, [roleKey]: libraryAsset.id } : s.roleDefaults;
      const pendingPublishes = { ...s.pendingPublishes, [libraryAsset.id]: { roleKey, asset: libraryAsset, status: 'syncing' as const } };
      saveLocalLibrary(library, s.remoteLibraryIds);
      if (roleKey) saveRoleDefaults(roleDefaults);
      savePending(pendingPublishes);
      return { library, roleDefaults, pendingPublishes };
    });
    publishAsset(roleKey, libraryAsset).then(ok => {
      set(s => {
        const pendingPublishes = { ...s.pendingPublishes };
        if (ok) delete pendingPublishes[libraryAsset.id];
        else pendingPublishes[libraryAsset.id] = { roleKey, asset: libraryAsset, status: 'failed' };
        savePending(pendingPublishes);
        return { pendingPublishes };
      });
    });
    return libraryAsset;
  },

  setRoleDefault: (roleKey, assetId) => {
    const asset = get().library.find(a => a.id === assetId);
    if (!asset) return;
    set(s => {
      const roleDefaults = { ...s.roleDefaults, [roleKey]: assetId };
      const pendingPublishes = { ...s.pendingPublishes, [assetId]: { roleKey, asset, status: 'syncing' as const } };
      saveRoleDefaults(roleDefaults);
      savePending(pendingPublishes);
      return { roleDefaults, pendingPublishes };
    });
    publishAsset(roleKey, asset).then(ok => {
      set(s => {
        const pendingPublishes = { ...s.pendingPublishes };
        if (ok) delete pendingPublishes[assetId];
        else pendingPublishes[assetId] = { roleKey, asset, status: 'failed' };
        savePending(pendingPublishes);
        return { pendingPublishes };
      });
    });
  },

  retryPublish: (assetId) => {
    const entry = get().pendingPublishes[assetId];
    if (!entry) return;
    set(s => ({ pendingPublishes: { ...s.pendingPublishes, [assetId]: { ...entry, status: 'syncing' } } }));
    publishAsset(entry.roleKey, entry.asset).then(ok => {
      set(s => {
        const pendingPublishes = { ...s.pendingPublishes };
        if (ok) delete pendingPublishes[assetId];
        else pendingPublishes[assetId] = { ...entry, status: 'failed' };
        savePending(pendingPublishes);
        return { pendingPublishes };
      });
    });
  },

  initLibrary: async () => {
    const { library: remoteLib, roleDefaults: remoteDefaults } = await fetchSharedLibrary();
    set(s => {
      const localIds = new Set(s.library.map(a => a.id));
      const library = [...remoteLib.filter(a => !localIds.has(a.id)), ...s.library];
      const roleDefaults = { ...remoteDefaults, ...s.roleDefaults };
      const remoteLibraryIds = remoteLib.map(a => a.id);
      saveLocalLibrary(library, remoteLibraryIds);
      saveRoleDefaults(roleDefaults);
      return { library, roleDefaults, remoteLibraryIds, config: resolveDefaults(s.config, roleDefaults, library) };
    });
    Object.keys(get().pendingPublishes).forEach(id => get().retryPublish(id));
  },

  saveTemplate: (name) => {
    const entry: TemplateEntry = { id: crypto.randomUUID(), name, savedAt: Date.now(), config: get().config };
    set(s => ({ templates: [...s.templates, entry] }));
  },

  loadTemplate: (id) => {
    const entry = get().templates.find(t => t.id === id);
    if (entry) {
      set(s => ({
        config: resolveDefaults({ ...entry.config, id: crypto.randomUUID() }, s.roleDefaults, s.library),
        undoStack: [],
        redoStack: [],
      }));
    }
  },

  deleteTemplate: (id) =>
    set(s => ({ templates: s.templates.filter(t => t.id !== id) })),
}));
