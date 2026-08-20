# Shared Asset Library (App Side) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every unit/spell/hero/popup/background/UI/audio asset slot a
stable "role key," auto-save whatever gets uploaded into a role-eligible
slot as that role's shared default, and fill gaps (new projects, exports)
from those defaults — with a bundled placeholder as the absolute last
resort — using only local/static-file storage, no external services.

**Architecture:** A pure `resolveDefaults(config, roleDefaults, library)`
function fills `null` asset slots from a `roleDefaults` map (role key →
library asset id) resolved against the existing `library` list. Role keys
are derived from a unit/spell's own `name` field, or from a fixed schema
path for everything without a user-editable name. `AssetUpload` calls a
new store action on every fresh upload that saves the asset, updates its
role's default, and fire-and-forgets a publish call (a no-op until the
Cloudflare Worker from the companion plan is deployed and its URL is
configured).

**Tech Stack:** Existing stack (React 18, Zustand 5, TypeScript, Vite 6).
Adds Vitest as a dev-only test runner for the new pure utility functions —
this repo has no test infrastructure today, so this is a new but minimal,
Vite-native addition, not full component testing.

## Global Constraints

- `resolveDefaults` must never overwrite a slot that already has an asset
  — it only fills `null`. This is what makes it safe to call unconditionally
  at any point (startup, after a library re-fetch, at export) without risk
  of clobbering in-progress edits.
- Role keys for units/spells are derived from `name.trim().toLowerCase()`;
  a blank/whitespace-only name resolves to no role key (`null`) — no
  auto-save, no auto-fill for unnamed units.
- All new localStorage-backed state follows the existing pattern in
  `battleStore.ts` (`loadX`/`saveX` helper pair, wrapped in `try {} catch {}`).
- This plan does **not** stand up the Cloudflare Worker — `publishAsset`
  is written to call it via an env var that doesn't exist yet, so every
  publish call is a harmless local no-op until the companion Worker plan
  is implemented and deployed. Nothing here should assume the Worker exists.

---

### Task 1: Add Vitest for the new pure-function utilities

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `npm test` script for later tasks' unit tests.

- [ ] **Step 1: Install Vitest as a dev dependency**

Run: `npm install -D vitest`

- [ ] **Step 2: Add a Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add the `test` script**

In `package.json`, inside `"scripts"`, add:

```json
"test": "vitest run"
```

- [ ] **Step 4: Verify the runner works with no tests yet**

Run: `npm test`
Expected: exits 0, reports "No test files found" (or similar) — confirms
the runner and config are wired correctly before any real tests exist.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add vitest for pure-function unit tests"
```

---

### Task 2: Data model — `RoleDefaults` type and relocate `LibraryAsset`

**Files:**
- Modify: `src/types/battle.ts`
- Modify: `src/store/battleStore.ts:1-6`

**Interfaces:**
- Produces: `RoleDefaults` type and `LibraryAsset` interface, both exported
  from `src/types/battle.ts`, for use by every later task.

- [ ] **Step 1: Add `RoleDefaults` and move `LibraryAsset` into `types/battle.ts`**

In `src/types/battle.ts`, add near `AssetData`:

```ts
export interface LibraryAsset extends AssetData { id: string; }

// Maps a role key (see src/utils/roleKeys.ts) to the id of the
// LibraryAsset currently used as that role's default.
export type RoleDefaults = Record<string, string>;
```

- [ ] **Step 2: Update `battleStore.ts` to import instead of declare `LibraryAsset`**

In `src/store/battleStore.ts`, change line 2's import and remove the local
declaration on line 5:

```ts
import type { BattleConfig, UnitConfig, HeroConfig, SpellConfig, BattleScenario, PopupConfig, AssetData, EnemyTurnDef, AttackReaction, PlayerTurnDef, LibraryAsset, RoleDefaults } from '../types/battle';
import { AUDIO_EVENTS } from '../types/battle';

export interface TemplateEntry { id: string; name: string; savedAt: number; config: BattleConfig; }
```

(Delete the old `export interface LibraryAsset extends AssetData { id: string; }` line entirely — it now lives in `types/battle.ts`.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (this is a pure relocation; every existing consumer of
`LibraryAsset` imports it from `battleStore.ts`, which still re-exports it
transitively via the type-only import — confirm this compiles as-is; if
`isolatedModules`/`verbatimModuleSyntax` blocks re-export-by-import, add an
explicit `export type { LibraryAsset } from '../types/battle';` line in
`battleStore.ts` and re-run this step).

- [ ] **Step 4: Commit**

```bash
git add src/types/battle.ts src/store/battleStore.ts
git commit -m "refactor: move LibraryAsset to types/battle.ts, add RoleDefaults"
```

---

### Task 3: Role-key resolution utility

**Files:**
- Create: `src/utils/roleKeys.ts`
- Test: `src/utils/roleKeys.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no dependencies beyond string handling).
- Produces:
  - `unitRoleKey(kind: 'idle' | 'attack' | 'projectile', name: string): string | null`
  - `spellRoleKey(kind: 'asset' | 'projectileAsset', name: string): string | null`
  - `audioRoleKey(event: string): string`
  - `FIXED_ROLE_KEYS` — object of every non-name-based role key, used
    identically by both the UI wiring tasks and `resolveDefaults`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/roleKeys.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { unitRoleKey, spellRoleKey, audioRoleKey, FIXED_ROLE_KEYS } from './roleKeys';

describe('unitRoleKey', () => {
  it('builds a lowercase, trimmed key', () => {
    expect(unitRoleKey('idle', '  Archer  ')).toBe('unit:idle:archer');
    expect(unitRoleKey('attack', 'Archer')).toBe('unit:attack:archer');
    expect(unitRoleKey('projectile', 'Archer')).toBe('unit:projectile:archer');
  });

  it('returns null for a blank name', () => {
    expect(unitRoleKey('idle', '')).toBeNull();
    expect(unitRoleKey('idle', '   ')).toBeNull();
  });
});

describe('spellRoleKey', () => {
  it('builds a lowercase, trimmed key', () => {
    expect(spellRoleKey('asset', 'Fireball')).toBe('spell:asset:fireball');
    expect(spellRoleKey('projectileAsset', 'Fireball')).toBe('spell:projectileAsset:fireball');
  });

  it('returns null for a blank name', () => {
    expect(spellRoleKey('asset', '')).toBeNull();
  });
});

describe('audioRoleKey', () => {
  it('namespaces the event id', () => {
    expect(audioRoleKey('player_attack')).toBe('audio:player_attack');
  });
});

describe('FIXED_ROLE_KEYS', () => {
  it('has no duplicate values', () => {
    const values = Object.values(FIXED_ROLE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './roleKeys'`.

- [ ] **Step 3: Implement `src/utils/roleKeys.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/roleKeys.ts src/utils/roleKeys.test.ts
git commit -m "feat: add role-key resolution for shared default assets"
```

---

### Task 4: `resolveDefaults` — fill gaps from role defaults

**Files:**
- Create: `src/utils/resolveDefaults.ts`
- Test: `src/utils/resolveDefaults.test.ts`

**Interfaces:**
- Consumes: `RoleDefaults`, `LibraryAsset` from `src/types/battle.ts`;
  `unitRoleKey`, `spellRoleKey`, `audioRoleKey`, `FIXED_ROLE_KEYS` from
  `src/utils/roleKeys.ts`.
- Produces: `resolveDefaults(config: BattleConfig, roleDefaults: RoleDefaults, library: LibraryAsset[]): BattleConfig`
  — pure, returns a new object, never mutates `config`.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/resolveDefaults.test.ts`. This uses a minimal but
complete `BattleConfig` fixture — build it from `DEFAULT_CONFIG`'s shape
directly rather than importing the store (keeps this test independent of
Task 5/6's store changes):

```ts
import { describe, it, expect } from 'vitest';
import { resolveDefaults } from './resolveDefaults';
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

describe('resolveDefaults', () => {
  it('fills a null unit slot from a matching name-based role default', () => {
    const result = resolveDefaults(baseConfig(), { 'unit:idle:archer': 'lib1' }, [archerIdle]);
    expect(result.playerUnits[0].assets.idle).toEqual({ dataUri: archerIdle.dataUri, mimeType: archerIdle.mimeType, fileName: archerIdle.fileName });
  });

  it('leaves a slot untouched if it already has an asset', () => {
    const cfg = baseConfig();
    const existing = { dataUri: 'data:image/png;base64,existing', mimeType: 'image/png', fileName: 'existing.png' };
    cfg.playerUnits[0].assets.idle = existing;
    const result = resolveDefaults(cfg, { 'unit:idle:archer': 'lib1' }, [archerIdle]);
    expect(result.playerUnits[0].assets.idle).toEqual(existing);
  });

  it('leaves a slot null if no role default matches', () => {
    const result = resolveDefaults(baseConfig(), {}, []);
    expect(result.playerUnits[0].assets.idle).toBeNull();
  });

  it('fills a fixed-slot role default (hero portrait)', () => {
    const result = resolveDefaults(baseConfig(), { 'hero:heroLeft': 'lib2' }, [heroImg]);
    expect(result.heroLeft.asset).toEqual({ dataUri: heroImg.dataUri, mimeType: heroImg.mimeType, fileName: heroImg.fileName });
  });

  it('fills an audio slot by event id', () => {
    const music: LibraryAsset = { id: 'lib3', dataUri: 'data:audio/mp3;base64,x', mimeType: 'audio/mp3', fileName: 'walk.mp3' };
    const result = resolveDefaults(baseConfig(), { 'audio:walk': 'lib3' }, [music]);
    expect(result.audio.sfxMap.walk).toEqual({ dataUri: music.dataUri, mimeType: music.mimeType, fileName: music.fileName });
  });

  it('does not mutate the input config', () => {
    const cfg = baseConfig();
    resolveDefaults(cfg, { 'unit:idle:archer': 'lib1' }, [archerIdle]);
    expect(cfg.playerUnits[0].assets.idle).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './resolveDefaults'`.

- [ ] **Step 3: Implement `src/utils/resolveDefaults.ts`**

```ts
import type { AssetData, BattleConfig, LibraryAsset, RoleDefaults } from '../types/battle';
import { AUDIO_EVENTS } from '../types/battle';
import { audioRoleKey, FIXED_ROLE_KEYS, spellRoleKey, unitRoleKey } from './roleKeys';

function lookup(
  roleKey: string | null,
  roleDefaults: RoleDefaults,
  library: LibraryAsset[]
): AssetData | null {
  if (!roleKey) return null;
  const assetId = roleDefaults[roleKey];
  if (!assetId) return null;
  const found = library.find(a => a.id === assetId);
  if (!found) return null;
  return { dataUri: found.dataUri, mimeType: found.mimeType, fileName: found.fileName };
}

export function resolveDefaults(
  config: BattleConfig,
  roleDefaults: RoleDefaults,
  library: LibraryAsset[]
): BattleConfig {
  const fill = (current: AssetData | null | undefined, roleKey: string | null): AssetData | null =>
    current ?? lookup(roleKey, roleDefaults, library);

  return {
    ...config,
    playerUnits: config.playerUnits.map(u => ({
      ...u,
      assets: {
        idle: fill(u.assets.idle, unitRoleKey('idle', u.name)),
        attack: fill(u.assets.attack, unitRoleKey('attack', u.name)),
        projectile: fill(u.assets.projectile, unitRoleKey('projectile', u.name)),
      },
    })),
    enemyUnits: config.enemyUnits.map(u => ({
      ...u,
      assets: {
        idle: fill(u.assets.idle, unitRoleKey('idle', u.name)),
        attack: fill(u.assets.attack, unitRoleKey('attack', u.name)),
        projectile: fill(u.assets.projectile, unitRoleKey('projectile', u.name)),
      },
    })),
    heroLeft: { ...config.heroLeft, asset: fill(config.heroLeft.asset, FIXED_ROLE_KEYS.heroLeft) },
    heroRight: { ...config.heroRight, asset: fill(config.heroRight.asset, FIXED_ROLE_KEYS.heroRight) },
    spells: config.spells.map(s => ({
      ...s,
      asset: fill(s.asset, spellRoleKey('asset', s.name)),
      projectileAsset: fill(s.projectileAsset, spellRoleKey('projectileAsset', s.name)),
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
      rangedProjectile: fill(config.uiAssets?.rangedProjectile ?? null, FIXED_ROLE_KEYS.uiRangedProjectile),
    },
    appIcon: fill(config.appIcon ?? null, FIXED_ROLE_KEYS.appIcon),
    audio: {
      music: fill(config.audio.music, FIXED_ROLE_KEYS.audioMusic),
      sfxMap: Object.fromEntries(
        AUDIO_EVENTS.map(ev => [ev, fill(config.audio.sfxMap[ev] ?? null, audioRoleKey(ev))])
      ),
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/resolveDefaults.ts src/utils/resolveDefaults.test.ts
git commit -m "feat: add resolveDefaults to gap-fill asset slots from role defaults"
```

---

### Task 5: Bundled placeholder assets (last-resort fallback)

**Files:**
- Create: `src/utils/placeholderAssets.ts`
- Modify: `src/utils/resolveDefaults.ts`
- Test: `src/utils/resolveDefaults.test.ts`

**Interfaces:**
- Produces: `PLACEHOLDER_UNIT_IDLE`, `PLACEHOLDER_UNIT_ATTACK`,
  `PLACEHOLDER_PROJECTILE`, `PLACEHOLDER_ICON` — each an `AssetData`,
  exported from `src/utils/placeholderAssets.ts`.
- `resolveDefaults` gains a third-tier fallback for unit idle/attack and
  projectile-shaped slots (unit projectile, spell projectile/asset, ui
  ranged projectile) only when no role default exists at all.

- [ ] **Step 1: Extend the failing test**

Append to `src/utils/resolveDefaults.test.ts`:

```ts
import { PLACEHOLDER_UNIT_IDLE } from './placeholderAssets';

// ...inside the existing describe('resolveDefaults', ...) block:
it('falls back to the bundled placeholder when no role default exists', () => {
  const result = resolveDefaults(baseConfig(), {}, []);
  expect(result.playerUnits[0].assets.idle).toEqual(PLACEHOLDER_UNIT_IDLE);
});

it('does not apply a placeholder to audio slots', () => {
  const result = resolveDefaults(baseConfig(), {}, []);
  expect(result.audio.music).toBeNull();
  expect(result.audio.sfxMap.walk).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './placeholderAssets'`, and the
existing "leaves a slot null if no role default matches" test now
conflicts with the new placeholder expectation for `idle`.

- [ ] **Step 3: Update the pre-existing "no match" test to reflect the new tier**

In `src/utils/resolveDefaults.test.ts`, replace the earlier
`'leaves a slot null if no role default matches'` test (from Task 4) with
one that checks a slot that has no placeholder tier — audio is the
cleanest example, already covered by the new
`'does not apply a placeholder to audio slots'` test above. Delete the old
test entirely (it's superseded).

- [ ] **Step 4: Implement `src/utils/placeholderAssets.ts`**

Plain inline SVGs as data URIs — no binary files to manage or commit.

```ts
import type { AssetData } from '../types/battle';

function svgAsset(fileName: string, svg: string): AssetData {
  return {
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    mimeType: 'image/svg+xml',
    fileName,
  };
}

export const PLACEHOLDER_UNIT_IDLE: AssetData = svgAsset(
  'placeholder-unit-idle.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="#3a3a4a"/>
    <circle cx="64" cy="48" r="24" fill="#6a6a80"/>
    <rect x="32" y="76" width="64" height="44" rx="10" fill="#6a6a80"/>
    <text x="64" y="122" font-size="10" fill="#ffffff" text-anchor="middle" font-family="sans-serif">no sprite</text>
  </svg>`
);

export const PLACEHOLDER_UNIT_ATTACK: AssetData = svgAsset(
  'placeholder-unit-attack.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" fill="#4a3a3a"/>
    <circle cx="64" cy="48" r="24" fill="#a06a6a"/>
    <rect x="32" y="76" width="64" height="44" rx="10" fill="#a06a6a"/>
    <text x="64" y="122" font-size="10" fill="#ffffff" text-anchor="middle" font-family="sans-serif">no sprite</text>
  </svg>`
);

export const PLACEHOLDER_PROJECTILE: AssetData = svgAsset(
  'placeholder-projectile.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="12" fill="#ffcc55"/>
  </svg>`
);

export const PLACEHOLDER_ICON: AssetData = svgAsset(
  'placeholder-icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <rect width="48" height="48" rx="8" fill="#555566"/>
    <text x="24" y="30" font-size="22" fill="#ffffff" text-anchor="middle" font-family="sans-serif">?</text>
  </svg>`
);
```

- [ ] **Step 5: Wire the fallback tier into `resolveDefaults`**

In `src/utils/resolveDefaults.ts`, add the import and a second-tier `fill`
variant used only for slots that should get a placeholder:

```ts
import { PLACEHOLDER_ICON, PLACEHOLDER_PROJECTILE, PLACEHOLDER_UNIT_ATTACK, PLACEHOLDER_UNIT_IDLE } from './placeholderAssets';
```

Change the unit mapping (both `playerUnits` and `enemyUnits`) to use the
placeholder as a third argument:

```ts
const fillWithPlaceholder = (
  current: AssetData | null | undefined,
  roleKey: string | null,
  placeholder: AssetData
): AssetData => current ?? lookup(roleKey, roleDefaults, library) ?? placeholder;
```

and update the two unit-mapping blocks to:

```ts
assets: {
  idle: fillWithPlaceholder(u.assets.idle, unitRoleKey('idle', u.name), PLACEHOLDER_UNIT_IDLE),
  attack: fillWithPlaceholder(u.assets.attack, unitRoleKey('attack', u.name), PLACEHOLDER_UNIT_ATTACK),
  projectile: fill(u.assets.projectile, unitRoleKey('projectile', u.name)),
},
```

(Unit `projectile` intentionally stays on the plain `fill` — a melee/flying
unit's `projectile` slot is meaningless and should stay `null`; only
`ranged`-relevant projectile slots get the projectile placeholder, added
next.) Update `uiAssets.rangedProjectile` and both spell `projectileAsset`
fields to use `fillWithPlaceholder(..., PLACEHOLDER_PROJECTILE)`, and
`appIcon` to use `fillWithPlaceholder(..., PLACEHOLDER_ICON)`. Leave every
other slot (heroes, popups, backgrounds, grid tiles, spellbook/attack-type
icons, audio) on the plain `fill` — a missing hero portrait or popup board
should stay blank rather than show an unrelated generic placeholder;
audio explicitly has no fallback per the design doc.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests green.

- [ ] **Step 7: Commit**

```bash
git add src/utils/placeholderAssets.ts src/utils/resolveDefaults.ts src/utils/resolveDefaults.test.ts
git commit -m "feat: fall back to bundled placeholders when no role default exists"
```

---

### Task 6: Store — role defaults state, upload recording, publish stub

**Files:**
- Modify: `src/store/battleStore.ts`

**Interfaces:**
- Consumes: `resolveDefaults` (Task 4/5), `RoleDefaults`/`LibraryAsset`
  (Task 2).
- Produces (new store state/actions, added to the `BattleStore` interface
  and its `create<BattleStore>()` implementation):
  - `roleDefaults: RoleDefaults`
  - `pendingPublishes: Record<string, { roleKey: string | null; asset: LibraryAsset; status: 'syncing' | 'failed' }>`
  - `recordUpload(roleKey: string | null, asset: AssetData): LibraryAsset`
  - `setRoleDefault(roleKey: string, assetId: string): void`
  - `retryPublish(assetId: string): void`
  - `initLibrary(): Promise<void>`
  - `addToLibrary` (existing) becomes a thin wrapper over `recordUpload`.

- [ ] **Step 1: Add localStorage helpers for role defaults and pending publishes**

Near the existing `LIBRARY_KEY`/`loadLibrary`/`saveLibrary` in
`src/store/battleStore.ts`, add:

```ts
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
```

- [ ] **Step 2: Add the publish + shared-library-fetch network helpers**

Add below the localStorage helpers:

```ts
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
```

- [ ] **Step 3: Resolve `DEFAULT_CONFIG` at module init time**

Immediately before `export const DEFAULT_CONFIG: BattleConfig = { ... }`,
there is nothing to change in the literal itself. Instead, find where
the store's initial `config` field is set inside `create<BattleStore>()`
(search for `config: DEFAULT_CONFIG` — it's in the initial state object
alongside `library: loadLibrary()` around line 252) and change it to
resolve against whatever is already cached locally:

```ts
config: resolveDefaults(DEFAULT_CONFIG, loadRoleDefaults(), loadLibrary()),
```

Add the import at the top of the file: `import { resolveDefaults } from '../utils/resolveDefaults';`

- [ ] **Step 4: Add the new state fields to the initial store object**

In the same initial-state object (alongside `library: loadLibrary()`),
add:

```ts
roleDefaults: loadRoleDefaults(),
pendingPublishes: loadPending(),
```

- [ ] **Step 5: Add the new fields/actions to the `BattleStore` interface**

Find the `BattleStore` interface (it declares `library: LibraryAsset[];`
around line 184 and `addToLibrary: (asset: AssetData) => void;` around
line 229) and add alongside them:

```ts
roleDefaults: RoleDefaults;
pendingPublishes: Record<string, PendingPublish>;
recordUpload: (roleKey: string | null, asset: AssetData) => LibraryAsset;
setRoleDefault: (roleKey: string, assetId: string) => void;
retryPublish: (assetId: string) => void;
initLibrary: () => Promise<void>;
```

- [ ] **Step 6: Implement `recordUpload`**

Near the existing `addToLibrary` implementation (around line 473), add:

```ts
recordUpload: (roleKey, asset) => {
  const libraryAsset: LibraryAsset = { ...asset, id: crypto.randomUUID() };
  set(s => {
    const library = [...s.library, libraryAsset];
    const roleDefaults = roleKey ? { ...s.roleDefaults, [roleKey]: libraryAsset.id } : s.roleDefaults;
    const pendingPublishes = { ...s.pendingPublishes, [libraryAsset.id]: { roleKey, asset: libraryAsset, status: 'syncing' as const } };
    saveLibrary(library);
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
```

- [ ] **Step 7: Implement `setRoleDefault` and `retryPublish`**

```ts
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
```

- [ ] **Step 8: Implement `initLibrary`**

```ts
initLibrary: async () => {
  const { library: remoteLib, roleDefaults: remoteDefaults } = await fetchSharedLibrary();
  set(s => {
    const localIds = new Set(s.library.map(a => a.id));
    const library = [...remoteLib.filter(a => !localIds.has(a.id)), ...s.library];
    const roleDefaults = { ...remoteDefaults, ...s.roleDefaults };
    saveLibrary(library);
    saveRoleDefaults(roleDefaults);
    return { library, roleDefaults, config: resolveDefaults(s.config, roleDefaults, library) };
  });
  Object.keys(get().pendingPublishes).forEach(id => get().retryPublish(id));
},
```

- [ ] **Step 9: Make `addToLibrary` a thin wrapper over `recordUpload`**

Replace the existing `addToLibrary` implementation (around line 473):

```ts
addToLibrary: (asset) => { get().recordUpload(null, asset); },
```

- [ ] **Step 10: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 11: Run existing unit tests**

Run: `npm test`
Expected: PASS (this task adds no new `.test.ts` files — it's store
wiring, covered by Task 9's manual browser verification instead of unit
tests, consistent with this codebase having no component-test setup).

- [ ] **Step 12: Commit**

```bash
git add src/store/battleStore.ts
git commit -m "feat: add role-default store state, upload recording, and publish stub"
```

---

### Task 7: `AssetUpload` — role-key-aware upload and library picking

**Files:**
- Modify: `src/components/AssetUpload.tsx`
- Modify: `src/components/LibraryPickerModal.tsx`

**Interfaces:**
- Consumes: `recordUpload`, `setRoleDefault` from the store (Task 6).
- Produces: `AssetUpload` gains an optional `roleKey?: string | null` prop,
  consumed by every panel wired in Tasks 8–10.

- [ ] **Step 1: Type the picker's asset by `LibraryAsset`, not bare `AssetData`**

In `src/components/LibraryPickerModal.tsx`, change the import and prop
type so the picked asset's `id` is available to the caller:

```ts
import type { LibraryAsset } from '../types/battle';

interface Props {
  accept: string;
  onSelect: (a: LibraryAsset) => void;
  onClose: () => void;
}
```

- [ ] **Step 2: Add `roleKey` prop and wire it into both upload paths**

In `src/components/AssetUpload.tsx`, update the props and store usage:

```ts
import { useRef, useState } from 'react';
import type { AssetData } from '../types/battle';
import { encodeFile } from '../utils/assetEncoder';
import { useBattleStore } from '../store/battleStore';
import LibraryPickerModal from './LibraryPickerModal';

interface Props {
  label: string;
  asset: AssetData | null;
  accept?: string;
  roleKey?: string | null;
  onChange: (a: AssetData | null) => void;
}

export default function AssetUpload({ label, asset, accept = 'image/*', roleKey = null, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPicker, setShowPicker] = useState(false);
  const { addToLibrary, recordUpload, setRoleDefault } = useBattleStore();
  const isAudio = accept.includes('audio');

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await encodeFile(file);
    onChange(data);
    if (roleKey) recordUpload(roleKey, data);
    e.target.value = '';
  }
```

- [ ] **Step 3: Wire `roleKey` into the library-picker selection**

Replace the `LibraryPickerModal` usage at the bottom of the same file:

```tsx
{showPicker && (
  <LibraryPickerModal
    accept={accept}
    onSelect={a => {
      onChange(a);
      if (roleKey) setRoleDefault(roleKey, a.id);
      setShowPicker(false);
    }}
    onClose={() => setShowPicker(false)}
  />
)}
```

Leave the manual 💾 button (`onClick={... addToLibrary(asset)}`) as-is —
it still works unchanged, now routing through `recordUpload(null, asset)`
internally per Task 6 Step 9.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual smoke check**

Correction (caught during task review): the `onFile` handler in Step 2
gates the call — `if (roleKey) recordUpload(roleKey, data);` — so a plain
upload with no `roleKey` (the case at every panel today, since Tasks 8-11
haven't wired any panel yet) does **not** call `recordUpload` at all. The
original wording of this step ("upload in Units, confirm it appears in
the Library automatically") is not achievable until Task 8 lands. Verify
the wiring itself instead: run `npm run dev`, open the browser devtools
console, and call `useBattleStore.getState().recordUpload('test:manual-check', { dataUri: 'data:image/png;base64,', mimeType: 'image/png', fileName: 'test.png' })`
directly — confirm the returned object has an `id`, and that opening the
📚 Library panel shows a new entry for it. This proves `recordUpload`
itself works correctly when given a real `roleKey`, which is what Task 8
will exercise end-to-end through the UI once `UnitsPanel` actually passes
one.

- [ ] **Step 6: Commit**

```bash
git add src/components/AssetUpload.tsx src/components/LibraryPickerModal.tsx
git commit -m "feat: make AssetUpload role-key aware for auto-defaulting"
```

---

### Task 8: Wire role keys into `UnitsPanel`

**Files:**
- Modify: `src/utils/resolveDefaults.ts`, `src/utils/resolveDefaults.test.ts`
  (add an `includePlaceholders` parameter — see Step 3, added after a
  SECOND gap found while re-verifying this task's first fix)
- Modify: `src/components/panels/UnitsPanel.tsx:1-4,108-140`
- Modify: `src/store/battleStore.ts` (`updatePlayerUnit`, `addPlayerUnit`,
  `updateEnemyUnit`, `addEnemyUnit`, `updateSpell` — see Step 4, added
  after a gap found during this task's own manual verification)

**Interfaces:**
- Consumes: `unitRoleKey` from `src/utils/roleKeys.ts`; `roleKey` prop on
  `AssetUpload` (Task 7); `resolveDefaults` (already imported in
  `battleStore.ts` since Task 6).

**Addendum 1 (found live, during this task's manual verification):**
Task 6 only calls `resolveDefaults` at store-init time and inside
`initLibrary`. Nothing re-runs it when a unit/spell is renamed or a new
one is created — so renaming a second unit to a name that already has a
role default (the plan's own headline scenario: upload once, every unit
sharing that name benefits) silently does **not** auto-fill, even though
`roleDefaults` itself is set correctly. Confirmed by direct browser
testing: renaming a unit to "Archer" after uploading art for a
first "Archer" left the second unit's asset slots on "Click to upload".
Since `resolveDefaults` only ever fills `null` slots and never overwrites
an existing asset, it's safe to call unconditionally after every unit/
spell patch or creation — Step 4 below wires that in. This also covers
Task 9's spell-renaming case, so Task 9 does not need to repeat this fix.

**Addendum 2 (found live, while re-verifying Addendum 1's fix):** After
implementing Addendum 1, the second-"Archer"-unit still didn't auto-fill.
Direct debugging (calling `resolveDefaults` manually against live state
via the browser console) isolated the real cause: `resolveDefaults`
already includes Task 5's placeholder-fallback tier, and that same
function is called at **app startup** on `DEFAULT_CONFIG` (Task 6) and
now, per Addendum 1, on **every** unit/spell create or update. Since the
placeholder tier fills idle/attack slots with a real (non-null)
`AssetData` the moment nothing else matches, every unit's asset slots get
"poisoned" with a placeholder immediately — at creation, or even at the
very first app load — permanently blocking them from ever being null
again, which is the only state `resolveDefaults` will fill into. The
placeholder tier was only ever meant to guarantee a non-blank **export**
(see the design doc's "Bundled fallback assets" section and Task 14 below)
— it was never meant to apply to the live editor's own state. Fix: give
`resolveDefaults` a 4th parameter, `includePlaceholders = false`, gating
the placeholder tier behind it. Every existing call site (module-init,
the five actions from Addendum 1) already calls `resolveDefaults` with
exactly 3 arguments, so they automatically get `includePlaceholders:
false` — the editor now correctly leaves an unmatched slot genuinely
`null` (shown as "Click to upload") instead of a placeholder, keeping it
eligible for a real default later. Only Task 14 (export-time resolution,
not yet implemented) will pass `true` explicitly.

- [ ] **Step 1: Import `unitRoleKey`**

At the top of `src/components/panels/UnitsPanel.tsx`:

```ts
import { unitRoleKey } from '../../utils/roleKeys';
```

- [ ] **Step 2: Pass `roleKey` to the three `AssetUpload` calls inside `UnitCard`**

`UnitCard` already has `unit: UnitConfig` in scope. Update the three
`AssetUpload` elements (idle around line 110, attack around line 118,
projectile around line 128):

```tsx
<AssetUpload
  label="Idle sprite"
  asset={unit.assets.idle}
  roleKey={unitRoleKey('idle', unit.name)}
  onChange={a => onUpdate({ assets: { ...unit.assets, idle: a } })}
/>
```

```tsx
<AssetUpload
  label="Attack sprite"
  asset={unit.assets.attack}
  roleKey={unitRoleKey('attack', unit.name)}
  onChange={a => onUpdate({ assets: { ...unit.assets, attack: a } })}
/>
```

```tsx
<AssetUpload
  label="Projectile"
  asset={unit.assets.projectile ?? null}
  roleKey={unitRoleKey('projectile', unit.name)}
  onChange={a => onUpdate({ assets: { ...unit.assets, projectile: a } })}
/>
```

- [ ] **Step 3: Gate the placeholder tier behind an `includePlaceholders` parameter**

In `src/utils/resolveDefaults.ts`, change the function signature and the
`fillWithPlaceholder` helper:

```ts
export function resolveDefaults(
  config: BattleConfig,
  roleDefaults: RoleDefaults,
  library: LibraryAsset[],
  includePlaceholders = false
): BattleConfig {
  const fill = (current: AssetData | null | undefined, roleKey: string | null): AssetData | null =>
    current ?? lookup(roleKey, roleDefaults, library);
  const fillWithPlaceholder = (
    current: AssetData | null | undefined,
    roleKey: string | null,
    placeholder: AssetData
  ): AssetData | null =>
    current ?? lookup(roleKey, roleDefaults, library) ?? (includePlaceholders ? placeholder : null);

  // ...rest of the function body is unchanged — `fill`/`fillWithPlaceholder`
  // are still used exactly where Task 5 wired them, just with
  // `fillWithPlaceholder` now placeholder-gated.
```

In `src/utils/resolveDefaults.test.ts`:
- Update the existing test `'falls back to the bundled placeholder when no
  role default exists'` to pass `true` as the 4th argument:
  `resolveDefaults(baseConfig(), {}, [], true)`.
- Add a new test proving the default (editor-facing) behavior stays `null`:

```ts
it('leaves a placeholder-eligible slot null when includePlaceholders is not set', () => {
  const result = resolveDefaults(baseConfig(), {}, []);
  expect(result.playerUnits[0].assets.idle).toBeNull();
});
```

Run `npm test` — all tests (the two above plus the full existing suite)
must pass before moving to Step 4.

- [ ] **Step 4: Re-resolve defaults on every unit/spell patch or creation**

In `src/store/battleStore.ts`, wrap the `config` each of these five
actions produces in `resolveDefaults(...)` before returning it from `set`.
`resolveDefaults` is already imported in this file (used at store-init
time since Task 6). For each action, replace the direct `config: {...}`
object with a call to `resolveDefaults(<that same object>, s.roleDefaults, s.library)`:

```ts
updatePlayerUnit: (id, patch) =>
  set(s => ({
    ...pushUndo(get),
    config: resolveDefaults(
      { ...s.config, playerUnits: s.config.playerUnits.map(u => u.id === id ? { ...u, ...patch } : u) },
      s.roleDefaults,
      s.library
    ),
  })),

addPlayerUnit: () => {
  if (get().config.playerUnits.length >= 6) return;
  const unit: UnitConfig = {
    id: crypto.randomUUID(), name: 'Unit', type: 'melee', hp: 100,
    baseDamage: 20, defense: 0, damageMultiplier: 1, gridCol: 0, gridRow: 0,
    displayWidth: 110, moveRange: 2, projectileSize: 60, resistTo: [],
    flipped: false, assets: { idle: null, attack: null, projectile: null },
  };
  set(s => ({
    ...pushUndo(get),
    config: resolveDefaults(
      { ...s.config, playerUnits: [...s.config.playerUnits, unit] },
      s.roleDefaults,
      s.library
    ),
  }));
},

updateEnemyUnit: (id, patch) =>
  set(s => ({
    ...pushUndo(get),
    config: resolveDefaults(
      { ...s.config, enemyUnits: s.config.enemyUnits.map(u => u.id === id ? { ...u, ...patch } : u) },
      s.roleDefaults,
      s.library
    ),
  })),

addEnemyUnit: () => {
  if (get().config.enemyUnits.length >= 6) return;
  const unit: UnitConfig = {
    id: crypto.randomUUID(), name: 'Enemy', type: 'ranged', hp: 100,
    baseDamage: 20, defense: 0, damageMultiplier: 1, gridCol: 2, gridRow: 0,
    displayWidth: 110, moveRange: 2, projectileSize: 60, resistTo: [],
    flipped: true, assets: { idle: null, attack: null, projectile: null },
  };
  set(s => ({
    ...pushUndo(get),
    config: resolveDefaults(
      { ...s.config, enemyUnits: [...s.config.enemyUnits, unit] },
      s.roleDefaults,
      s.library
    ),
  }));
},

updateSpell: (id, patch) =>
  set(s => ({
    ...pushUndo(get),
    config: resolveDefaults(
      { ...s.config, spells: s.config.spells.map(sp => sp.id === id ? { ...sp, ...patch } : sp) },
      s.roleDefaults,
      s.library
    ),
  })),
```

`removePlayerUnit`/`removeEnemyUnit` are unchanged — removing a unit
can't create a new gap to fill. `addPlayerUnit`'s default name `'Unit'`
and `addEnemyUnit`'s `'Enemy'` won't match any real role key today, so
wrapping them is inert until Task 13 seeds the library — included anyway
for consistency and to cover any future role named "Unit"/"Enemy".

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. Rename the default player unit to "Archer", upload an
idle sprite for it. Add a second player unit, rename it to "Archer" too
(before assigning any art) — confirm its idle sprite auto-fills with the
one just uploaded (proves `resolveDefaults`/role-default wiring end to
end for the exact scenario from the design doc). This step depends on
Steps 3 and 4 above — without Step 3 (the `includePlaceholders` gate),
every unit's slots get poisoned with a non-null placeholder at creation
and this never auto-fills, even with Step 4's reactive re-resolution in
place; without Step 4, `roleDefaults` gets set correctly on upload but
nothing re-checks the second unit. Both confirmed by direct testing.

- [ ] **Step 7: Commit**

```bash
git add src/utils/resolveDefaults.ts src/utils/resolveDefaults.test.ts src/components/panels/UnitsPanel.tsx src/store/battleStore.ts
git commit -m "feat: wire unit sprites into the shared role-default library"
```

---

### Task 9: Wire role keys into `SpellsPanel`

**Files:**
- Modify: `src/components/panels/SpellsPanel.tsx`

**Interfaces:**
- Consumes: `spellRoleKey` from `src/utils/roleKeys.ts`, `FIXED_ROLE_KEYS`
  from the same module.

- [ ] **Step 1: Import the role-key helpers**

At the top of `src/components/panels/SpellsPanel.tsx`:

```ts
import { FIXED_ROLE_KEYS, spellRoleKey } from '../../utils/roleKeys';
```

- [ ] **Step 2: Wire the six fixed-slot uploads in the top-level component**

Update each `AssetUpload` in `SpellsPanel` (melee/ranged/flying icons,
ranged projectile, spellbook closed/open) with its matching key:

```tsx
<AssetUpload label="Melee icon" asset={config.uiAssets?.meleeIcon ?? null}
  roleKey={FIXED_ROLE_KEYS.uiMeleeIcon}
  onChange={a => setUiAsset('meleeIcon', a)} />
```
```tsx
<AssetUpload label="Ranged icon" asset={config.uiAssets?.rangedIcon ?? null}
  roleKey={FIXED_ROLE_KEYS.uiRangedIcon}
  onChange={a => setUiAsset('rangedIcon', a)} />
```
```tsx
<AssetUpload label="Flying icon" asset={config.uiAssets?.flyingIcon ?? null}
  roleKey={FIXED_ROLE_KEYS.uiFlyingIcon}
  onChange={a => setUiAsset('flyingIcon', a)} />
```
```tsx
<AssetUpload label="Ranged projectile" asset={config.uiAssets?.rangedProjectile ?? null}
  roleKey={FIXED_ROLE_KEYS.uiRangedProjectile}
  onChange={a => setUiAsset('rangedProjectile', a)} />
```
```tsx
<AssetUpload label="Spellbook closed" asset={config.uiAssets?.spellbookClosed ?? null}
  roleKey={FIXED_ROLE_KEYS.uiSpellbookClosed}
  onChange={a => setUiAsset('spellbookClosed', a)} />
```
```tsx
<AssetUpload label="Spellbook open" asset={config.uiAssets?.spellbookOpen ?? null}
  roleKey={FIXED_ROLE_KEYS.uiSpellbookOpen}
  onChange={a => setUiAsset('spellbookOpen', a)} />
```

- [ ] **Step 3: Wire the two name-based uploads in `SpellCard`**

`SpellCard` already has `spell: SpellConfig` in scope. Update:

```tsx
<AssetUpload label="Spell icon" asset={spell.asset}
  roleKey={spellRoleKey('asset', spell.name)}
  onChange={a => onUpdate({ asset: a })} />
```
```tsx
<AssetUpload label="Spell projectile" asset={spell.projectileAsset ?? null}
  roleKey={spellRoleKey('projectileAsset', spell.name)}
  onChange={a => onUpdate({ projectileAsset: a })} />
```

Leave the two SFX `AssetUpload`s (`sfxShoot`/`sfxHit`) unwired — per-spell
audio doesn't have a natural shared "role" the way icon art does, and
isn't in the design doc's scope.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Upload a melee attack-type icon in Spells — confirm it
appears in 📚 Library, and that reloading the page (which re-runs the
startup `resolveDefaults` against localStorage) keeps it assigned.

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/SpellsPanel.tsx
git commit -m "feat: wire spell and attack-icon assets into the shared library"
```

---

### Task 10: Wire role keys into `HeroPanel`, `BackgroundPanel`, `GridPanel`

**Files:**
- Modify: `src/components/panels/HeroPanel.tsx`
- Modify: `src/components/panels/BackgroundPanel.tsx`
- Modify: `src/components/panels/GridPanel.tsx`

**Interfaces:**
- Consumes: `FIXED_ROLE_KEYS` from `src/utils/roleKeys.ts`.

- [ ] **Step 1: Wire `HeroPanel.tsx`**

Add the import and pass `roleKey` to the two portrait uploads:

```ts
import { FIXED_ROLE_KEYS } from '../../utils/roleKeys';
```
```tsx
<AssetUpload label="Left hero" asset={heroLeft.asset} roleKey={FIXED_ROLE_KEYS.heroLeft} onChange={a => setHeroLeft({ asset: a })} />
```
```tsx
<AssetUpload label="Right hero" asset={heroRight.asset} roleKey={FIXED_ROLE_KEYS.heroRight} onChange={a => setHeroRight({ asset: a })} />
```

- [ ] **Step 2: Wire `BackgroundPanel.tsx`**

```ts
import { FIXED_ROLE_KEYS } from '../../utils/roleKeys';
```
```tsx
<AssetUpload label="Landscape BG" asset={config.backgrounds.landscape}
  roleKey={FIXED_ROLE_KEYS.backgroundLandscape}
  onChange={a => setBackground('landscape', a)} />
```
```tsx
<AssetUpload label="Portrait BG" asset={config.backgrounds.portrait}
  roleKey={FIXED_ROLE_KEYS.backgroundPortrait}
  onChange={a => setBackground('portrait', a)} />
```

- [ ] **Step 3: Wire `GridPanel.tsx`**

```ts
import { FIXED_ROLE_KEYS } from '../../utils/roleKeys';
```
```tsx
<AssetUpload label="Walkable hex" asset={config.gridTiles.walkable}
  roleKey={FIXED_ROLE_KEYS.gridTileWalkable}
  onChange={a => setGridTile('walkable', a)} />
```
```tsx
<AssetUpload label="Active hex" asset={config.gridTiles.active}
  roleKey={FIXED_ROLE_KEYS.gridTileActive}
  onChange={a => setGridTile('active', a)} />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`. Upload a walkable hex tile in Grid, reload the page,
confirm it's still assigned (localStorage round-trip via the startup
`resolveDefaults` call).

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/HeroPanel.tsx src/components/panels/BackgroundPanel.tsx src/components/panels/GridPanel.tsx
git commit -m "feat: wire hero, background, and grid-tile assets into the shared library"
```

---

### Task 11: Wire role keys into `PopupsPanel` and `AudioPanel`

**Files:**
- Modify: `src/components/panels/PopupsPanel.tsx`
- Modify: `src/components/panels/AudioPanel.tsx`

**Interfaces:**
- Consumes: `FIXED_ROLE_KEYS`, `audioRoleKey` from `src/utils/roleKeys.ts`.

- [ ] **Step 1: Wire `PopupsPanel.tsx`**

Add the import and pass `roleKey` to all seven uploads:

```ts
import { FIXED_ROLE_KEYS } from '../../utils/roleKeys';
```
```tsx
<AssetUpload label="App icon" asset={config.appIcon ?? null}
  roleKey={FIXED_ROLE_KEYS.appIcon}
  onChange={a => setAppIcon(a)} />
```
```tsx
<AssetUpload label="Victory banner" asset={popups.victory.bannerAsset}
  roleKey={FIXED_ROLE_KEYS.popupVictoryBanner}
  onChange={a => setPopups({ victory: { ...popups.victory, bannerAsset: a } })} />
```
```tsx
<AssetUpload label="Victory board" asset={popups.victory.boardAsset}
  roleKey={FIXED_ROLE_KEYS.popupVictoryBoard}
  onChange={a => setPopups({ victory: { ...popups.victory, boardAsset: a } })} />
```
```tsx
<AssetUpload label="CTA button" asset={popups.victory.ctaButtonAsset}
  roleKey={FIXED_ROLE_KEYS.popupVictoryCta}
  onChange={a => setPopups({ victory: { ...popups.victory, ctaButtonAsset: a } })} />
```
```tsx
<AssetUpload label="Defeat banner" asset={popups.defeat.bannerAsset}
  roleKey={FIXED_ROLE_KEYS.popupDefeatBanner}
  onChange={a => setPopups({ defeat: { ...popups.defeat, bannerAsset: a } })} />
```
```tsx
<AssetUpload label="Defeat board" asset={popups.defeat.boardAsset}
  roleKey={FIXED_ROLE_KEYS.popupDefeatBoard}
  onChange={a => setPopups({ defeat: { ...popups.defeat, boardAsset: a } })} />
```
```tsx
<AssetUpload label="Retry button" asset={popups.defeat.retryButtonAsset}
  roleKey={FIXED_ROLE_KEYS.popupDefeatRetry}
  onChange={a => setPopups({ defeat: { ...popups.defeat, retryButtonAsset: a } })} />
```
```tsx
<AssetUpload label="Store button" asset={popups.defeat.storeButtonAsset}
  roleKey={FIXED_ROLE_KEYS.popupDefeatStore}
  onChange={a => setPopups({ defeat: { ...popups.defeat, storeButtonAsset: a } })} />
```

- [ ] **Step 2: Wire `AudioPanel.tsx`**

```ts
import { FIXED_ROLE_KEYS, audioRoleKey } from '../../utils/roleKeys';
```
```tsx
<AssetUpload
  label="Music track"
  asset={config.audio.music}
  accept="audio/*"
  roleKey={FIXED_ROLE_KEYS.audioMusic}
  onChange={setMusic}
/>
```

Update the per-event SFX upload inside the `AUDIO_EVENTS.map(...)` loop:

```tsx
<AssetUpload
  label={EVENT_LABELS[ev] ?? ev}
  asset={config.audio.sfxMap[ev] ?? null}
  accept="audio/*"
  roleKey={audioRoleKey(ev)}
  onChange={a => setSfx(ev, a)}
/>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`. Upload a "Player Attack (Melee)" SFX in Audio, confirm
it lands in 📚 Library and survives a reload.

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/PopupsPanel.tsx src/components/panels/AudioPanel.tsx
git commit -m "feat: wire popup, app-icon, and audio assets into the shared library"
```

---

### Task 12: Load the shared library on app start

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `initLibrary` from the store (Task 6).

- [ ] **Step 1: Call `initLibrary` once on mount**

In `src/App.tsx`, add `useEffect` to the React import and call the store
action once when the app mounts:

```ts
import { useEffect, useState } from 'react';
```

Inside `export default function App() { ... }`, alongside the existing
`useBattleStore()` destructure, pull in `initLibrary` and add the effect:

```tsx
const { config, setName, undo, redo, undoStack, redoStack, initLibrary } = useBattleStore();

useEffect(() => {
  initLibrary();
}, [initLibrary]);
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open the browser devtools Network tab, reload — confirm
two requests fire: `library/library.json` and `library/role-defaults.json`
(both will 404 until Task 13 creates them — that's expected and handled
gracefully by `fetchSharedLibrary`'s `try/catch` + `.ok` checks; the app
must not crash or show an error state from these 404s). Confirm the app
still loads normally.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: fetch the shared library on app startup"
```

---

### Task 13: Seed the initial shared library from the bundled templates

**Files:**
- Create: `scripts/seed-library.mjs`
- Create (generated by the script, then committed): `public/library/library.json`
- Create (generated by the script, then committed): `public/library/role-defaults.json`

**Interfaces:**
- Produces: the two static files `initLibrary` (Task 6/12) fetches at
  `library/library.json` / `library/role-defaults.json`.

- [ ] **Step 1: Write the seed script**

Create `scripts/seed-library.mjs`. This duplicates the small role-key
scheme from `src/utils/roleKeys.ts` in plain JS since it's a one-time
Node script run outside the Vite/TS build — if the key scheme in
`src/utils/roleKeys.ts` ever changes, this script's copy must be updated
to match, but ongoing library growth after this one-time seed happens
through the live app (Task 6), not by re-running this script.

```js
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
```

- [ ] **Step 2: Run the script**

Run: `node scripts/seed-library.mjs`
Expected output: `Seeded N library assets, N role defaults.` with N > 0,
and `public/library/library.json` + `public/library/role-defaults.json`
now exist.

- [ ] **Step 3: Sanity-check the output**

Run: `node -e "const d=require('./public/library/role-defaults.json'); console.log(d['unit:idle:archer'] ? 'archer OK' : 'MISSING archer')"`
Expected: `archer OK` (Archer is one of the confirmed-shared unit names
across the bundled templates).

- [ ] **Step 4: Verify the dev server now serves it without 404s**

Run: `npm run dev`, reload, check the Network tab again (same check as
Task 12 Step 3) — both `library/library.json` and
`library/role-defaults.json` now return 200. Open Units, rename the
default player unit to "Archer" — confirm its idle/attack sprites
auto-populate from the seeded library without any manual upload.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-library.mjs public/library/library.json public/library/role-defaults.json
git commit -m "feat: seed the shared library from art already in the bundled templates"
```

---

### Task 14: Resolve defaults at export time

**Files:**
- Modify: `src/components/export/ExportDialog.tsx`

**Interfaces:**
- Consumes: `resolveDefaults` (Task 4/5/8 — Task 8 added a 4th
  `includePlaceholders` parameter, defaulting to `false`; this is the ONE
  call site in the whole app that must pass `true`, since this is the
  only place the placeholder-fallback tier is meant to apply), `roleDefaults`/
  `library` from the store.

- [ ] **Step 1: Compute a resolved config and use it everywhere `generateHTML` is called**

In `src/components/export/ExportDialog.tsx`, add the import and compute a
resolved copy right after reading `config` from the store:

```ts
import { useMemo, useState } from 'react';
import { resolveDefaults } from '../../utils/resolveDefaults';
```

```ts
export default function ExportDialog({ onClose }: Props) {
  const config = useBattleStore(s => s.config);
  const roleDefaults = useBattleStore(s => s.roleDefaults);
  const library = useBattleStore(s => s.library);
  const resolvedConfig = useMemo(
    () => resolveDefaults(config, roleDefaults, library, true),
    [config, roleDefaults, library]
  );
  const [working, setWorking] = useState(false);
```

Replace the three existing `generateHTML(config, ...)` call sites (in the
`sizes` computation, `downloadAll`, and `downloadSingle`) with
`generateHTML(resolvedConfig, ...)`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. Create a brand-new enemy unit named "Imp" (one of the
confirmed cross-template names) but do **not** assign it any art. Open
Export — confirm the size estimates don't error, then download a build
and open the generated HTML file directly in a browser; confirm the Imp
unit renders with real art (from the seeded library), not blank or
broken. Then rename a unit to something nobody has ever uploaded art for
(e.g. "Zzznew") and export again — confirm it renders with the bundled
placeholder art (gray silhouette) rather than a missing/broken image.

- [ ] **Step 4: Commit**

```bash
git add src/components/export/ExportDialog.tsx
git commit -m "feat: resolve default assets before generating an export"
```

---

### Task 15: "Not yet synced" indicator in the Library panel

**Files:**
- Modify: `src/components/LibraryPanel.tsx`

**Interfaces:**
- Consumes: `pendingPublishes`, `retryPublish` from the store (Task 6).

- [ ] **Step 1: Show a retry banner for failed publishes**

In `src/components/LibraryPanel.tsx`, add the store fields and a banner
above the existing library grid:

```tsx
import { useBattleStore } from '../store/battleStore';

export default function LibraryPanel() {
  const { library, removeFromLibrary, pendingPublishes, retryPublish } = useBattleStore();
  const failed = Object.entries(pendingPublishes).filter(([, p]) => p.status === 'failed');

  return (
    <div>
      <div className="panel-title">Asset Library</div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
        Upload an asset anywhere, then click 💾 to save it here. Pick it later from any upload slot via "📚 Library".
      </p>
      {failed.length > 0 && (
        <div style={{ background: '#442222', border: '1px solid #663333', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{failed.length} upload{failed.length > 1 ? 's' : ''} not yet synced to the shared library.</span>
          <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={() => failed.forEach(([id]) => retryPublish(id))}>
            Retry
          </button>
        </div>
      )}
      {library.length === 0 ? (
```

(The remainder of the file — the empty-state message and library grid —
stays unchanged; only the opening JSX gains the banner above it.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev` without setting `VITE_LIBRARY_WORKER_URL` (the default
— no `.env` file exists yet) — upload any asset and confirm **no**
"not yet synced" banner appears (because `publishAsset` treats an
unconfigured Worker URL as success, per Task 6 Step 2 — this is the
expected behavior until the companion Worker plan is implemented and its
URL is configured).

- [ ] **Step 4: Commit**

```bash
git add src/components/LibraryPanel.tsx
git commit -m "feat: show a retry banner for library uploads that failed to sync"
```

---

## Self-Review Notes

- **Spec coverage:** role-key scheme (Task 3), auto-save-on-upload (Tasks
  6–7), `resolveDefaults` for both name-based and fixed slots (Task 4),
  bundled placeholder fallback tier (Task 5), never-blank new projects
  (Task 6 Step 3 + Task 12), never-blank exports (Task 14), shared-library
  fetch-on-load (Task 12), seeding from existing template art (Task 13),
  publish/retry status tracking (Tasks 6, 15). The actual Cloudflare
  Worker, its GitHub commit logic, and the passphrase gate are
  deliberately **not** in this plan — see the companion Worker plan.
- **Type consistency:** `recordUpload(roleKey: string | null, asset: AssetData): LibraryAsset`
  and `setRoleDefault(roleKey: string, assetId: string): void` signatures
  are used identically in Task 6 (definition) and Task 7 (`AssetUpload`
  call sites) — confirmed matching across both tasks.
- **Out of scope for this plan (per the design doc):** the Cloudflare
  Worker bridge (separate plan), pruning old library assets, real
  authentication, and the flying-unit attack animation project from
  earlier in this session.
