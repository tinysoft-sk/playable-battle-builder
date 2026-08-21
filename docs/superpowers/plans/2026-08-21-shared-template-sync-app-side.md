# Shared Template Sync — App-Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the session-only "Saved Templates" list with a shared, synced one — saving/loading/deleting a template goes through the new Worker endpoints (`/publish-template`, `/delete-template`), using small id-reference "slim" templates instead of re-embedding multi-MB asset data per save.

**Architecture:** Every config asset slot gets tagged with the id of the library asset it came from (`AssetData.libraryAssetId`). Two new pure functions, `slimTemplate`/`hydrateTemplate`, convert between the full in-editor `BattleConfig` (always fully hydrated, real `dataUri` everywhere) and a small wire format (asset slots become `{ libraryAssetId }` when that id is a known library asset). The store's template actions (`saveTemplate`/`loadTemplate`/`deleteTemplate`) are rewired to fetch/publish/delete through the Worker (this repo's `worker/`, implemented in the companion plan `2026-08-21-shared-template-sync-worker.md`), reusing the exact optimistic-update + local-retry-queue pattern already proven for asset uploads.

**Tech Stack:** React 18, Zustand 5, TypeScript, Vite 6, Vitest (pure-function unit tests only — this codebase has no component/store test harness; UI and store changes are verified via `tsc` plus a live browser check).

## Global Constraints

- `config` in the Zustand store (`useBattleStore`) must **always** hold a fully-hydrated `BattleConfig` — real `AssetData` with `dataUri` at every slot, never a `{ libraryAssetId }`-only reference. Slim data exists only transiently: inside `slimTemplate`'s return value right before it's sent to the Worker, and inside the raw fetch response from `templates/shared-templates.json` right before `hydrateTemplate` converts it back.
- The existing local "Export JSON" / "Import JSON" buttons in `TemplatesModal.tsx` and the 4 bundled "Built-in templates" (`public/templates/*.json`, loaded via `BUILT_IN_TEMPLATES`) are unrelated to this feature and must not change.
- When `VITE_LIBRARY_WORKER_URL` is unset (no Worker configured), every publish/delete call must behave as a harmless local-only success — this already the existing convention for `publishAsset` in `battleStore.ts:41-44` and must be matched exactly for the new template calls.
- Name matching for overwrite/delete is exact, case-sensitive string equality — no trimming beyond what the Worker plan already does, no case-folding.

---

### Task 1: Tag `AssetData` with the originating library asset id

**Files:**
- Modify: `src/types/battle.ts`
- Modify: `src/utils/resolveDefaults.ts:6-17` (`lookupRoleDefault`)
- Modify: `src/utils/resolveDefaults.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `AssetData` gains `libraryAssetId?: string`. `lookupRoleDefault`'s return now includes it. Later tasks (2, 3) rely on this field being present wherever an asset came from a known library entry.

- [ ] **Step 1: Update the existing tests to expect `libraryAssetId`**

In `src/utils/resolveDefaults.test.ts`, update these three existing assertions (the ids come from the file's existing `archerIdle`/`heroImg`/`music` fixtures):

Change:
```ts
    expect(result.playerUnits[0].assets.idle).toEqual({ dataUri: archerIdle.dataUri, mimeType: archerIdle.mimeType, fileName: archerIdle.fileName });
```
to:
```ts
    expect(result.playerUnits[0].assets.idle).toEqual({ dataUri: archerIdle.dataUri, mimeType: archerIdle.mimeType, fileName: archerIdle.fileName, libraryAssetId: archerIdle.id });
```

Change:
```ts
    expect(result.heroLeft.asset).toEqual({ dataUri: heroImg.dataUri, mimeType: heroImg.mimeType, fileName: heroImg.fileName });
```
to:
```ts
    expect(result.heroLeft.asset).toEqual({ dataUri: heroImg.dataUri, mimeType: heroImg.mimeType, fileName: heroImg.fileName, libraryAssetId: heroImg.id });
```

Change:
```ts
    expect(result.audio.sfxMap.walk).toEqual({ dataUri: music.dataUri, mimeType: music.mimeType, fileName: music.fileName });
```
to:
```ts
    expect(result.audio.sfxMap.walk).toEqual({ dataUri: music.dataUri, mimeType: music.mimeType, fileName: music.fileName, libraryAssetId: music.id });
```

Add one new test at the end of the `describe('resolveDefaults', ...)` block, right before the closing `});`:

```ts
  it('tags a filled slot with the library asset id it came from', () => {
    const result = resolveDefaults(baseConfig(), { 'unit:idle:archer': 'lib1' }, [archerIdle]);
    expect(result.playerUnits[0].assets.idle?.libraryAssetId).toBe('lib1');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run`
Expected: FAIL — the three updated assertions fail because the current `lookupRoleDefault` doesn't include `libraryAssetId` yet.

- [ ] **Step 3: Implement**

In `src/types/battle.ts`, change:

```ts
export interface AssetData {
  dataUri: string;
  mimeType: string;
  fileName: string;
}
```

to:

```ts
export interface AssetData {
  dataUri: string;
  mimeType: string;
  fileName: string;
  libraryAssetId?: string;
}
```

In `src/utils/resolveDefaults.ts`, change the `lookupRoleDefault` return line (currently line 16):

```ts
  return { dataUri: found.dataUri, mimeType: found.mimeType, fileName: found.fileName };
```

to:

```ts
  return { dataUri: found.dataUri, mimeType: found.mimeType, fileName: found.fileName, libraryAssetId: found.id };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run`
Expected: PASS — all tests in `resolveDefaults.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add src/types/battle.ts src/utils/resolveDefaults.ts src/utils/resolveDefaults.test.ts
git commit -m "app: tag AssetData with the originating library asset id"
```

---

### Task 2: Tag uploaded/picked assets with `libraryAssetId`, fix the upload/library id mismatch

**Files:**
- Modify: `src/store/battleStore.ts:607-628` (`recordUpload`)
- Modify: `src/components/AssetUpload.tsx`

**Context:** Today, a fresh upload calls `onChange(data)` with the raw encoded file, then separately calls `recordUpload(roleKey, data)`, which mints its **own**, different `crypto.randomUUID()` for the library copy (`battleStore.ts:608`). The slot in `config` and the entry in `library` end up as two different objects with no shared id at all. This task fixes that (required for `libraryAssetId` to ever be correct on a freshly-uploaded slot) and also tags the library-picker path.

**Interfaces:**
- Consumes: `AssetData.libraryAssetId` from Task 1.
- Produces: `recordUpload`'s signature is unchanged (`(roleKey: string | null, asset: AssetData) => LibraryAsset`), but now reuses `asset.libraryAssetId` as the new library entry's id when present, instead of always minting a fresh one — and skips re-adding a duplicate if that id is already in the library.

- [ ] **Step 1: Implement the `recordUpload` fix**

In `src/store/battleStore.ts`, replace the `recordUpload` action (currently lines 607-628):

```ts
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
```

with:

```ts
  recordUpload: (roleKey, asset) => {
    const existingId = asset.libraryAssetId;
    const existing = existingId ? get().library.find(a => a.id === existingId) : undefined;
    if (existing) {
      if (roleKey) get().setRoleDefault(roleKey, existing.id);
      return existing;
    }
    const libraryAsset: LibraryAsset = {
      dataUri: asset.dataUri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
      id: existingId ?? crypto.randomUUID(),
    };
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
```

(The dedup guard also prevents a latent bug this change would otherwise introduce: without it, pressing 💾 twice on an already-known, `libraryAssetId`-tagged asset would push a second entry with a duplicate `id` into `library`.)

- [ ] **Step 2: Tag the fresh-upload path in `AssetUpload.tsx`**

In `src/components/AssetUpload.tsx`, replace the `onFile` function:

```ts
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await encodeFile(file);
    onChange(data);
    if (roleKey) recordUpload(roleKey, data);
    e.target.value = '';
  }
```

with:

```ts
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const encoded = await encodeFile(file);
    const data: AssetData = { ...encoded, libraryAssetId: crypto.randomUUID() };
    onChange(data);
    if (roleKey) recordUpload(roleKey, data);
    e.target.value = '';
  }
```

- [ ] **Step 3: Tag the library-picker path in `AssetUpload.tsx`**

In the same file, replace the `LibraryPickerModal` usage:

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

with:

```tsx
      {showPicker && (
        <LibraryPickerModal
          accept={accept}
          onSelect={a => {
            onChange({ dataUri: a.dataUri, mimeType: a.mimeType, fileName: a.fileName, libraryAssetId: a.id });
            if (roleKey) setRoleDefault(roleKey, a.id);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the existing test suite**

Run: `npm test -- --run`
Expected: PASS — no test in this codebase covers `battleStore.ts` or `AssetUpload.tsx` directly (there is no component/store test harness here), so this step is a regression check on the pure-function suite from Task 1, which must stay green.

- [ ] **Step 6: Commit**

```bash
git add src/store/battleStore.ts src/components/AssetUpload.tsx
git commit -m "app: tag uploaded/picked assets with libraryAssetId, fix upload/library id mismatch"
```

---

### Task 3: `slimTemplate` / `hydrateTemplate`

**Files:**
- Create: `src/utils/templateSlim.ts`
- Test: `src/utils/templateSlim.test.ts`

**Interfaces:**
- Consumes: `resolveDefaults` from `src/utils/resolveDefaults.ts` (existing, unchanged signature); `AssetData`, `BattleConfig`, `LibraryAsset`, `RoleDefaults` types from `src/types/battle.ts`.
- Produces:
  - `export type SlimAssetSlot = { libraryAssetId: string } | AssetData | null;`
  - `export function slimTemplate(config: BattleConfig, library: LibraryAsset[]): unknown`
  - `export function hydrateTemplate(slim: unknown, library: LibraryAsset[], roleDefaults: RoleDefaults): BattleConfig`
  - Task 4 (`battleStore.ts`) calls both of these directly.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/templateSlim.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run`
Expected: FAIL — `src/utils/templateSlim.ts` doesn't exist yet.

- [ ] **Step 3: Implement**

Create `src/utils/templateSlim.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run`
Expected: PASS — all tests in `templateSlim.test.ts` green, plus the full existing suite still green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/templateSlim.ts src/utils/templateSlim.test.ts
git commit -m "app: add slimTemplate/hydrateTemplate for reference-based template storage"
```

---

### Task 4: Rewire `battleStore.ts` for shared templates

**Files:**
- Modify: `src/store/battleStore.ts`
- Create: `public/templates/shared-templates.json` (seed file, content `[]`)

**Interfaces:**
- Consumes: `slimTemplate`, `hydrateTemplate` from Task 3.
- Produces:
  - `export interface SharedTemplateEntry { name: string; savedAt: number; config: BattleConfig; }` (replaces the removed `TemplateEntry`).
  - Store state: `sharedTemplates: SharedTemplateEntry[]`, `remoteTemplateNames: string[]`, `pendingTemplatePublishes: Record<string, PendingTemplatePublish>` (replaces `templates: TemplateEntry[]`).
  - Store actions: `saveTemplate: (name: string) => void`, `loadTemplate: (name: string) => void` (signature changes from `id` to `name`), `deleteTemplate: (name: string) => void` (signature changes from `id` to `name`), `retryTemplatePublish: (name: string) => void`, `initSharedTemplates: () => Promise<void>`.
  - Task 5 (`TemplatesModal.tsx`) and Task 6 (`App.tsx`) consume these exact names/signatures.

- [ ] **Step 1: Create the seed file**

Create `public/templates/shared-templates.json` with exactly this content:

```json
[]
```

- [ ] **Step 2: Remove `TemplateEntry`, add the new types and helpers**

In `src/store/battleStore.ts`, replace:

```ts
export interface TemplateEntry { id: string; name: string; savedAt: number; config: BattleConfig; }
```

with:

```ts
export interface SharedTemplateEntry { name: string; savedAt: number; config: BattleConfig; }
```

Add this import at the top of the file, alongside the existing `resolveDefaults`/`lookupRoleDefault` import:

```ts
import { slimTemplate, hydrateTemplate } from '../utils/templateSlim';
```

Add these helpers below the existing `PENDING_KEY`/`loadPending`/`savePending` block (after `savePending`, before `publishAsset`):

```ts
const TEMPLATE_KEY = 'battle-editor-shared-templates';
function loadLocalTemplates(): SharedTemplateEntry[] {
  try { const raw = localStorage.getItem(TEMPLATE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
function saveLocalTemplates(templates: SharedTemplateEntry[], remoteTemplateNames: string[]) {
  const remoteSet = new Set(remoteTemplateNames);
  try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates.filter(t => !remoteSet.has(t.name)))); } catch {}
}

const TEMPLATE_PENDING_KEY = 'battle-editor-pending-template-publishes';
type PendingTemplatePublish =
  | { op: 'save'; name: string; config: BattleConfig; status: 'syncing' | 'failed' }
  | { op: 'delete'; name: string; status: 'syncing' | 'failed' };
function loadPendingTemplates(): Record<string, PendingTemplatePublish> {
  try { const raw = localStorage.getItem(TEMPLATE_PENDING_KEY); if (raw) return JSON.parse(raw); } catch {}
  return {};
}
function savePendingTemplates(pending: Record<string, PendingTemplatePublish>) {
  try { localStorage.setItem(TEMPLATE_PENDING_KEY, JSON.stringify(pending)); } catch {}
}
```

Add these two functions right after the existing `publishAsset` function (after its closing `}`, before `fetchSharedLibrary`):

```ts
async function publishTemplate(name: string, config: unknown): Promise<boolean> {
  const url = import.meta.env.VITE_LIBRARY_WORKER_URL as string | undefined;
  if (!url) return true;
  const passphrase = import.meta.env.VITE_LIBRARY_PUBLISH_PASSPHRASE as string | undefined;
  try {
    const res = await fetch(`${url}/publish-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase, name, config }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function deleteTemplateRemote(name: string): Promise<boolean> {
  const url = import.meta.env.VITE_LIBRARY_WORKER_URL as string | undefined;
  if (!url) return true;
  const passphrase = import.meta.env.VITE_LIBRARY_PUBLISH_PASSPHRASE as string | undefined;
  try {
    const res = await fetch(`${url}/delete-template`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase, name }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
```

Add this function right after the existing `fetchSharedLibrary` function:

```ts
async function fetchSharedTemplates(): Promise<{ name: string; savedAt: number; config: unknown }[]> {
  try {
    const res = await fetch('templates/shared-templates.json');
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 3: Update the `BattleStore` interface**

Replace:

```ts
  library: LibraryAsset[];
  templates: TemplateEntry[];
  roleDefaults: RoleDefaults;
  pendingPublishes: Record<string, PendingPublish>;
  remoteLibraryIds: string[];
```

with:

```ts
  library: LibraryAsset[];
  sharedTemplates: SharedTemplateEntry[];
  remoteTemplateNames: string[];
  roleDefaults: RoleDefaults;
  pendingPublishes: Record<string, PendingPublish>;
  pendingTemplatePublishes: Record<string, PendingTemplatePublish>;
  remoteLibraryIds: string[];
```

Replace the `// Templates` block at the bottom of the interface:

```ts
  // Templates
  saveTemplate: (name: string) => void;
  loadTemplate: (id: string) => void;
  deleteTemplate: (id: string) => void;
```

with:

```ts
  // Templates
  saveTemplate: (name: string) => void;
  loadTemplate: (name: string) => void;
  deleteTemplate: (name: string) => void;
  retryTemplatePublish: (name: string) => void;
  initSharedTemplates: () => Promise<void>;
```

- [ ] **Step 4: Update the initial state**

Replace:

```ts
  library: loadLibrary(),
  templates: [],
  roleDefaults: loadRoleDefaults(),
  pendingPublishes: loadPending(),
  remoteLibraryIds: [],
```

with:

```ts
  library: loadLibrary(),
  sharedTemplates: loadLocalTemplates(),
  remoteTemplateNames: [],
  roleDefaults: loadRoleDefaults(),
  pendingPublishes: loadPending(),
  pendingTemplatePublishes: loadPendingTemplates(),
  remoteLibraryIds: [],
```

- [ ] **Step 5: Replace the template actions**

Replace the existing `saveTemplate`/`loadTemplate`/`deleteTemplate` block at the end of the file:

```ts
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
```

with:

```ts
  saveTemplate: (name) => {
    const config = get().config;
    const savedAt = Date.now();
    set(s => {
      const sharedTemplates = [...s.sharedTemplates.filter(t => t.name !== name), { name, savedAt, config }];
      const pendingTemplatePublishes = { ...s.pendingTemplatePublishes, [name]: { op: 'save' as const, name, config, status: 'syncing' as const } };
      saveLocalTemplates(sharedTemplates, s.remoteTemplateNames);
      savePendingTemplates(pendingTemplatePublishes);
      return { sharedTemplates, pendingTemplatePublishes };
    });
    const slim = slimTemplate(config, get().library);
    publishTemplate(name, slim).then(ok => {
      set(s => {
        const pendingTemplatePublishes = { ...s.pendingTemplatePublishes };
        if (ok) delete pendingTemplatePublishes[name];
        else pendingTemplatePublishes[name] = { op: 'save', name, config, status: 'failed' };
        savePendingTemplates(pendingTemplatePublishes);
        return { pendingTemplatePublishes };
      });
    });
  },

  loadTemplate: (name) => {
    const entry = get().sharedTemplates.find(t => t.name === name);
    if (entry) {
      set(s => ({
        config: resolveDefaults({ ...entry.config, id: crypto.randomUUID() }, s.roleDefaults, s.library),
        undoStack: [],
        redoStack: [],
      }));
    }
  },

  deleteTemplate: (name) => {
    set(s => {
      const sharedTemplates = s.sharedTemplates.filter(t => t.name !== name);
      const pendingTemplatePublishes = { ...s.pendingTemplatePublishes, [name]: { op: 'delete' as const, name, status: 'syncing' as const } };
      saveLocalTemplates(sharedTemplates, s.remoteTemplateNames);
      savePendingTemplates(pendingTemplatePublishes);
      return { sharedTemplates, pendingTemplatePublishes };
    });
    deleteTemplateRemote(name).then(ok => {
      set(s => {
        const pendingTemplatePublishes = { ...s.pendingTemplatePublishes };
        if (ok) delete pendingTemplatePublishes[name];
        else pendingTemplatePublishes[name] = { op: 'delete', name, status: 'failed' };
        savePendingTemplates(pendingTemplatePublishes);
        return { pendingTemplatePublishes };
      });
    });
  },

  retryTemplatePublish: (name) => {
    const entry = get().pendingTemplatePublishes[name];
    if (!entry) return;
    set(s => ({ pendingTemplatePublishes: { ...s.pendingTemplatePublishes, [name]: { ...entry, status: 'syncing' } } }));
    const run = entry.op === 'save'
      ? publishTemplate(name, slimTemplate(entry.config, get().library))
      : deleteTemplateRemote(name);
    run.then(ok => {
      set(s => {
        const pendingTemplatePublishes = { ...s.pendingTemplatePublishes };
        if (ok) delete pendingTemplatePublishes[name];
        else pendingTemplatePublishes[name] = { ...entry, status: 'failed' };
        savePendingTemplates(pendingTemplatePublishes);
        return { pendingTemplatePublishes };
      });
    });
  },

  initSharedTemplates: async () => {
    const remote = await fetchSharedTemplates();
    set(s => {
      const hydratedRemote = remote.map(t => ({
        name: t.name,
        savedAt: t.savedAt,
        config: hydrateTemplate(t.config, s.library, s.roleDefaults),
      }));
      const remoteNames = new Set(hydratedRemote.map(t => t.name));
      const localOnly = s.sharedTemplates.filter(t => !remoteNames.has(t.name));
      const sharedTemplates = [...hydratedRemote, ...localOnly];
      const remoteTemplateNames = hydratedRemote.map(t => t.name);
      saveLocalTemplates(sharedTemplates, remoteTemplateNames);
      return { sharedTemplates, remoteTemplateNames };
    });
    Object.keys(get().pendingTemplatePublishes).forEach(name => get().retryTemplatePublish(name));
  },
}));
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (This will surface any remaining reference to the old `TemplateEntry`/`templates` names — Task 5 fixes `TemplatesModal.tsx`.)

- [ ] **Step 7: Run the existing test suite**

Run: `npm test -- --run`
Expected: PASS — the pure-function suites (`resolveDefaults.test.ts`, `roleKeys.test.ts`, `templateSlim.test.ts`) are unaffected by store changes and must stay green. `tsc --noEmit` will still show errors from `TemplatesModal.tsx` referencing the old API until Task 5 — that's expected at this point, not a regression to fix here.

- [ ] **Step 8: Commit**

```bash
git add src/store/battleStore.ts public/templates/shared-templates.json
git commit -m "app: rewire battleStore templates to sync through the Worker"
```

---

### Task 5: Rewire `TemplatesModal.tsx`

**Files:**
- Modify: `src/components/TemplatesModal.tsx`

**Interfaces:**
- Consumes: `sharedTemplates`, `saveTemplate`, `loadTemplate`, `deleteTemplate`, `pendingTemplatePublishes`, `retryTemplatePublish` from the store (Task 4).
- Produces: no new exports — this is the last piece needed for `npx tsc --noEmit` to pass clean across the whole app.

- [ ] **Step 1: Update the destructure**

Replace:

```ts
  const { config, templates, saveTemplate, loadTemplate, deleteTemplate, loadConfig } = useBattleStore();
```

with:

```ts
  const { config, sharedTemplates, saveTemplate, loadTemplate, deleteTemplate, loadConfig, pendingTemplatePublishes, retryTemplatePublish } = useBattleStore();
```

Add this line right after the existing `const importRef = useRef<HTMLInputElement>(null);` line:

```ts
  const failedTemplates = Object.entries(pendingTemplatePublishes).filter(([, p]) => p.status === 'failed');
```

- [ ] **Step 2: Replace the "Saved list" section**

Replace:

```tsx
        {/* Saved list */}
        {templates.length > 0 && (
          <div className="popup-section" style={{ marginBottom: 14 }}>
            <div className="popup-section-title">Saved templates (this session)</div>
            {templates.map(t => (
              <div key={t.id} className="template-item">
                <span className="template-name">{t.name}</span>
                <span className="template-date">{new Date(t.savedAt).toLocaleTimeString()}</span>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => { loadTemplate(t.id); onClose(); }}>Load</button>
                <button className="asset-clear" onClick={() => deleteTemplate(t.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
```

with:

```tsx
        {/* Shared templates */}
        <div className="popup-section" style={{ marginBottom: 14 }}>
          <div className="popup-section-title">Shared templates</div>
          {failedTemplates.length > 0 && (
            <div style={{ background: '#442222', border: '1px solid #663333', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{failedTemplates.length} template change{failedTemplates.length > 1 ? 's' : ''} not yet synced.</span>
              <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}
                onClick={() => failedTemplates.forEach(([name]) => retryTemplatePublish(name))}>
                Retry
              </button>
            </div>
          )}
          {sharedTemplates.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No shared templates yet.</div>
          ) : (
            sharedTemplates.map(t => (
              <div key={t.name} className="template-item">
                <span className="template-name">{t.name}</span>
                <span className="template-date">{new Date(t.savedAt).toLocaleTimeString()}</span>
                <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }}
                  onClick={() => { loadTemplate(t.name); onClose(); }}>Load</button>
                <button className="asset-clear" onClick={() => deleteTemplate(t.name)}>✕</button>
              </div>
            ))
          )}
        </div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/TemplatesModal.tsx
git commit -m "app: rewire TemplatesModal to the shared template list"
```

---

### Task 6: Fetch shared templates at startup

**Files:**
- Modify: `src/App.tsx:33-41`

**Interfaces:**
- Consumes: `initSharedTemplates` from the store (Task 4).
- Produces: nothing new.

- [ ] **Step 1: Wire the startup fetch**

Replace:

```tsx
  const { config, setName, undo, redo, undoStack, redoStack, initLibrary } = useBattleStore();

  useEffect(() => {
    initLibrary();
  }, [initLibrary]);
```

with:

```tsx
  const { config, setName, undo, redo, undoStack, redoStack, initLibrary, initSharedTemplates } = useBattleStore();

  useEffect(() => {
    initLibrary();
    initSharedTemplates();
  }, [initLibrary, initSharedTemplates]);
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors — this should be the first fully clean type-check since Task 4 started.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "app: fetch shared templates on startup"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run: `npm test -- --run`
Expected: all tests pass — `resolveDefaults.test.ts`, `roleKeys.test.ts`, `templateSlim.test.ts`.

- [ ] **Step 3: Live browser check (no Worker configured)**

Start the dev server (`npm run dev` or the project's existing `run-editor.bat`) with `VITE_LIBRARY_WORKER_URL` unset (the normal local-dev state, matching how asset publish already behaves locally). In the browser:

1. Open the editor, click "📋 Templates".
2. Confirm the section now reads "Shared templates" and shows "No shared templates yet." (assuming a clean `public/templates/shared-templates.json` with `[]`, seeded in Task 4).
3. Type a name in "Save current as template" and click Save. Confirm it immediately appears in the "Shared templates" list (optimistic local update — this must work even with no Worker configured, exactly like an asset upload already does).
4. Click "Load" on that entry. Confirm the editor's config updates to match (e.g. project name field reflects the loaded config's `name`).
5. Click ✕ to delete it. Confirm it disappears from the list.
6. Check the browser console for errors during all of the above — expect none.
7. Confirm the existing "Built-in templates" section and "Export JSON"/"Import JSON" buttons still work unchanged (regression check — Task 5 only touched the "Saved list" section of this file).

Report the outcome of each of these 7 checks. If any fails, diagnose against the relevant task above and fix before considering the plan complete — do not report success without having actually run this check.

No commit for this task — it's verification only.
