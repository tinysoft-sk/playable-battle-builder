# Grid Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated "Grid" panel (first in the nav, above Units) that consolidates grid position and grid tile images from other panels, and makes the battle grid's column/row count configurable.

**Architecture:** A new `BattleConfig.grid` field drives a new `GridPanel.tsx`. `src/utils/htmlGenerator.ts`'s hardcoded `COLS=5,ROWS=4` and hand-tuned hex-layout constants become computed via a pure, aspect-preserving auto-fit formula that reduces to today's exact values at the 5×4 default.

**Tech Stack:** React + TypeScript + Zustand (editor). No test runner exists in this repo (confirmed: no Jest/Vitest, no test files) — do not add one. Verification per task is `npx tsc --noEmit`, `npm run build`, and — for the layout math specifically — a standalone executable check compiling `src/utils/htmlGenerator.ts` with esbuild and calling `generateHTML()` directly (the same technique used for the prior Guided-mode feature).

## Global Constraints

- `BattleConfig.grid: { cols: number; rows: number }` is a new **required** field on the type (matching the existing convention for fields like `gridOffset` that are typed required but read defensively elsewhere for backward compatibility with older saved configs).
- Every read of `config.grid` in `src/utils/htmlGenerator.ts` must use the defensive `(config as any).grid?.cols ?? 5` / `(config as any).grid?.rows ?? 4` pattern — the exact idiom already used in that file for `gridOffset`, `hintLayout`, `speechLayout`, `uiAssets`, and `spellbookEnabled` — so old saved configs without `grid` behave exactly as they do today.
- At `grid = { cols: 5, rows: 4 }` (the default), the auto-fit formula must produce byte-identical `LAYOUT` constants to today's hardcoded values, for both `land` and `port` orientations. This is a hard backward-compatibility requirement, not a nice-to-have — verify it numerically in Task 2.
- Grid Size inputs: Columns min 2 max 10, Rows min 2 max 8.
- Do not add hex-distance/pathing changes, runtime validation/clamping of unit positions, or any other scope beyond what's described below (see the design spec's "Out of scope" section).

---

### Task 1: Types and store plumbing

**Files:**
- Modify: `src/types/battle.ts`
- Modify: `src/store/battleStore.ts`

**Interfaces:**
- Produces: `BattleConfig.grid: { cols: number; rows: number }`, `DEFAULT_CONFIG.grid = { cols: 5, rows: 4 }`, store action `setGridSize: (patch: Partial<{ cols: number; rows: number }>) => void`, and `loadConfig`'s normalization filling in `grid` for older saved configs. Every later task reads `config.grid` and calls `setGridSize`.

- [ ] **Step 1: Add `grid` to `BattleConfig` in `src/types/battle.ts`**

Find (currently the `gridOffset` field inside `BattleConfig`):

```typescript
  appIcon: AssetData | null;
  gridOffset: {
    landscape: number;
    portrait: number;
  };
```

Replace with:

```typescript
  appIcon: AssetData | null;
  grid: {
    cols: number;
    rows: number;
  };
  gridOffset: {
    landscape: number;
    portrait: number;
  };
```

- [ ] **Step 2: Add the default value in `src/store/battleStore.ts`**

Find:

```typescript
  appIcon: null,
  gridOffset: { landscape: 0, portrait: 0 },
```

Replace with:

```typescript
  appIcon: null,
  grid: { cols: 5, rows: 4 },
  gridOffset: { landscape: 0, portrait: 0 },
```

- [ ] **Step 3: Normalize `grid` in `loadConfig` for backward compatibility**

Find:

```typescript
      backgrounds: { ...DEFAULT_CONFIG.backgrounds, ...(c.backgrounds ?? {}) },
      gridOffset: { ...DEFAULT_CONFIG.gridOffset, ...(c.gridOffset ?? {}) },
```

Replace with:

```typescript
      backgrounds: { ...DEFAULT_CONFIG.backgrounds, ...(c.backgrounds ?? {}) },
      grid: { ...DEFAULT_CONFIG.grid, ...(c.grid ?? {}) },
      gridOffset: { ...DEFAULT_CONFIG.gridOffset, ...(c.gridOffset ?? {}) },
```

- [ ] **Step 4: Add the `setGridSize` action to the `BattleStore` interface**

Find:

```typescript
  setGridTile: (key: 'walkable' | 'active', asset: AssetData | null) => void;
  setUiAsset: (key: keyof BattleConfig['uiAssets'], asset: AssetData | null) => void;
```

Replace with:

```typescript
  setGridTile: (key: 'walkable' | 'active', asset: AssetData | null) => void;
  setGridSize: (patch: Partial<{ cols: number; rows: number }>) => void;
  setUiAsset: (key: keyof BattleConfig['uiAssets'], asset: AssetData | null) => void;
```

- [ ] **Step 5: Implement `setGridSize` next to `setGridTile`**

Find:

```typescript
  setGridTile: (key, asset) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, gridTiles: { ...s.config.gridTiles, [key]: asset } } })),
```

Replace with:

```typescript
  setGridTile: (key, asset) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, gridTiles: { ...s.config.gridTiles, [key]: asset } } })),

  setGridSize: (patch) =>
    set(s => ({ ...pushUndo(get), config: { ...s.config, grid: { ...s.config.grid, ...patch } } })),
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `HeroPanel.tsx`/`BackgroundPanel.tsx`/`ScenarioPanel.tsx`/`UnitsPanel.tsx`/`htmlGenerator.ts` are **not** expected yet from this task alone (those files don't reference `config.grid` yet) — the only files touched are `battle.ts` and `battleStore.ts`, so the type-check should be clean. If it isn't, stop and report.

- [ ] **Step 7: Commit**

```bash
git add src/types/battle.ts src/store/battleStore.ts
git commit -m "Add configurable grid size (BattleConfig.grid, setGridSize action)"
```

---

### Task 2: Auto-fit grid layout in the generator

**Files:**
- Modify: `src/utils/htmlGenerator.ts`

**Interfaces:**
- Consumes: `config.grid` from Task 1.
- Produces: nothing new consumed by later tasks — this task's effect is entirely inside the generated HTML/JS output (the `COLS`/`ROWS` constants and `LAYOUT.land`/`LAYOUT.port` geometry). Task 5's verification checks this task's output directly.

- [ ] **Step 1: Add the `fitLayout` helper function**

Find (currently right after the `hintFor` function, before `generateHTML`):

```typescript
function hintFor(config: BattleConfig, trigger: string): string {
  const fc = config.scenario.failConditions.find(f => f.trigger === trigger);
  return fc ? fc.hintLines.join('<br>') : '';
}

export function generateHTML(config: BattleConfig, network: NetworkTarget): string {
```

Replace with:

```typescript
function hintFor(config: BattleConfig, trigger: string): string {
  const fc = config.scenario.failConditions.find(f => f.trigger === trigger);
  return fc ? fc.hintLines.join('<br>') : '';
}

// Computes hex-grid geometry for an arbitrary cols/rows count, scaled and
// centered to occupy the same on-screen footprint the original hand-tuned
// 5x4 layout occupied (hexW0/hexH0/gx0_0/gy0_0 are that layout's constants
// for one orientation). Preserves hex aspect ratio (no image stretching).
// At cols=5, rows=4 this returns hexW0/hexH0/gx0_0/gy0_0 unchanged.
function fitLayout(hexW0: number, hexH0: number, gx0_0: number, gy0_0: number, cols: number, rows: number) {
  const BASE_COLS = 5, BASE_ROWS = 4;
  const footprintW = hexW0 * (BASE_COLS + 0.5);
  const footprintH = hexH0 * ((BASE_ROWS - 1) * 0.75 + 1);
  const centerX = gx0_0 - hexW0 / 2 + footprintW / 2;
  const centerY = gy0_0 - hexH0 / 2 + footprintH / 2;

  const scaleW = footprintW / (hexW0 * (cols + 0.5));
  const scaleH = footprintH / (hexH0 * ((rows - 1) * 0.75 + 1));
  const scale = Math.min(scaleW, scaleH);

  const hexW = hexW0 * scale;
  const hexH = hexH0 * scale;
  const colSp = hexW;
  const rowSp = hexH * 0.75;
  const oddDx = hexW / 2;

  const newFootprintW = hexW * (cols + 0.5);
  const newFootprintH = hexH * ((rows - 1) * 0.75 + 1);
  const gx0 = centerX - newFootprintW / 2 + hexW / 2;
  const gy0 = centerY - newFootprintH / 2 + hexH / 2;

  return { hexW, hexH, colSp, rowSp, oddDx, gx0, gy0 };
}

export function generateHTML(config: BattleConfig, network: NetworkTarget): string {
```

- [ ] **Step 2: Compute `gridCols`/`gridRows` and both orientations' layouts**

Find:

```typescript
  const gridOffsetLand = (config as any).gridOffset?.landscape ?? 0;
  const gridOffsetPort = (config as any).gridOffset?.portrait ?? 0;
```

Replace with:

```typescript
  const gridOffsetLand = (config as any).gridOffset?.landscape ?? 0;
  const gridOffsetPort = (config as any).gridOffset?.portrait ?? 0;
  const gridCols = (config as any).grid?.cols ?? 5;
  const gridRows = (config as any).grid?.rows ?? 4;
  const landLayout = fitLayout(120, 80, 240, 275, gridCols, gridRows);
  const portLayout = fitLayout(90, 60, 79, 420, gridCols, gridRows);
```

- [ ] **Step 3: Use the computed values for `COLS`/`ROWS` and `LAYOUT`**

Find:

```typescript
const COLS=5,ROWS=4;
const LAYOUT={
  land:{vpW:1000,vpH:563,gx0:240,gy0:${275+gridOffsetLand},hexW:120,hexH:80,colSp:120,rowSp:60,oddDx:60},
  port:{vpW:563,vpH:1000,gx0:79,gy0:${420+gridOffsetPort},hexW:90,hexH:60,colSp:90,rowSp:45,oddDx:45},
```

Replace with:

```typescript
const COLS=${gridCols},ROWS=${gridRows};
const LAYOUT={
  land:{vpW:1000,vpH:563,gx0:${landLayout.gx0},gy0:${landLayout.gy0+gridOffsetLand},hexW:${landLayout.hexW},hexH:${landLayout.hexH},colSp:${landLayout.colSp},rowSp:${landLayout.rowSp},oddDx:${landLayout.oddDx}},
  port:{vpW:563,vpH:1000,gx0:${portLayout.gx0},gy0:${portLayout.gy0+gridOffsetPort},hexW:${portLayout.hexW},hexH:${portLayout.hexH},colSp:${portLayout.colSp},rowSp:${portLayout.rowSp},oddDx:${portLayout.oddDx}},
```

(The line after this, `};`, is unchanged — only these three lines are replaced.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Verify the default case is byte-identical by hand**

At `cols=5, rows=4`: `footprintW=660, footprintH=260` for both calls' respective base constants, `scale=1` in both `fitLayout` calls, so `landLayout` = `{hexW:120,hexH:80,colSp:120,rowSp:60,oddDx:60,gx0:240,gy0:275}` and `portLayout` = `{hexW:90,hexH:60,colSp:90,rowSp:45,oddDx:45,gx0:79,gy0:420}` — identical to the original hardcoded literals. Confirm by reading the diff: `git diff src/utils/htmlGenerator.ts` and re-deriving this by hand (don't just trust the report — this is the backward-compatibility guarantee the whole feature depends on).

- [ ] **Step 6: Commit**

```bash
git add src/utils/htmlGenerator.ts
git commit -m "Make grid columns/rows configurable with an aspect-preserving auto-fit layout"
```

---

### Task 3: Grid panel UI and nav wiring

**Files:**
- Create: `src/components/panels/GridPanel.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/panels/HeroPanel.tsx`
- Modify: `src/components/panels/BackgroundPanel.tsx`

**Interfaces:**
- Consumes: `config.grid`, `setGridSize` (Task 1); `config.gridOffset`, `setGridOffset`, `config.gridTiles`, `setGridTile` (pre-existing store actions, just relocated to a new panel).
- Produces: nothing new consumed by later tasks (Task 4 reads `config.grid` directly from the store, not from this panel).

- [ ] **Step 1: Create `src/components/panels/GridPanel.tsx`**

```tsx
import { useBattleStore } from '../../store/battleStore';
import AssetUpload from '../AssetUpload';

export default function GridPanel() {
  const { config, setGridSize, setGridOffset, setGridTile } = useBattleStore();
  const grid = config.grid ?? { cols: 5, rows: 4 };
  const gridOffset = config.gridOffset ?? { landscape: 0, portrait: 0 };

  return (
    <div>
      <div className="panel-title">Grid</div>

      <div className="section-title">Grid Size</div>
      <div className="row">
        <div className="field">
          <label>Columns</label>
          <input type="number" min={2} max={10} value={grid.cols}
            onChange={e => setGridSize({ cols: +e.target.value })} />
        </div>
        <div className="field">
          <label>Rows</label>
          <input type="number" min={2} max={8} value={grid.rows}
            onChange={e => setGridSize({ rows: +e.target.value })} />
        </div>
      </div>

      <div className="section-title">Grid Position</div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        Shift the battle grid up (negative) or down (positive) in pixels.
      </p>
      <div className="row">
        <div className="field">
          <label>Landscape offset Y</label>
          <input type="number" step={10} value={gridOffset.landscape}
            onChange={e => setGridOffset('landscape', +e.target.value)} />
        </div>
        <div className="field">
          <label>Portrait offset Y</label>
          <input type="number" step={10} value={gridOffset.portrait}
            onChange={e => setGridOffset('portrait', +e.target.value)} />
        </div>
      </div>

      <div className="section-title">Grid Tiles</div>
      <div className="field">
        <label>Walkable Hex Tile</label>
        <AssetUpload label="Walkable hex" asset={config.gridTiles.walkable}
          onChange={a => setGridTile('walkable', a)} />
      </div>
      <div className="field">
        <label>Active Hex Tile</label>
        <AssetUpload label="Active hex" asset={config.gridTiles.active}
          onChange={a => setGridTile('active', a)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the nav in `src/App.tsx`, as the first item**

Find:

```tsx
import UnitsPanel from './components/panels/UnitsPanel';
import HeroPanel from './components/panels/HeroPanel';
```

Replace with:

```tsx
import GridPanel from './components/panels/GridPanel';
import UnitsPanel from './components/panels/UnitsPanel';
import HeroPanel from './components/panels/HeroPanel';
```

Find:

```tsx
type NavItem = 'units' | 'heroes' | 'spells' | 'scenario' | 'popups' | 'backgrounds' | 'store' | 'audio' | 'library';

const NAV_ITEMS: { id: NavItem; label: string }[] = [
  { id: 'units',       label: 'Units' },
```

Replace with:

```tsx
type NavItem = 'grid' | 'units' | 'heroes' | 'spells' | 'scenario' | 'popups' | 'backgrounds' | 'store' | 'audio' | 'library';

const NAV_ITEMS: { id: NavItem; label: string }[] = [
  { id: 'grid',        label: 'Grid' },
  { id: 'units',       label: 'Units' },
```

Find:

```tsx
          {section === 'units'       && <UnitsPanel />}
```

Replace with:

```tsx
          {section === 'grid'        && <GridPanel />}
          {section === 'units'       && <UnitsPanel />}
```

Find (the initial nav selection, so the app doesn't need to change which panel opens by default — leave `'units'` as the default landing panel, only the nav order changes):

```tsx
  const [section, setSection] = useState<NavItem>('units');
```

This line does not need to change — leave it as `'units'`. (Not a step; noted so the implementer doesn't "fix" it unnecessarily.)

- [ ] **Step 3: Remove "Grid Position" from `src/components/panels/HeroPanel.tsx`**

Find:

```tsx
export default function HeroPanel() {
  const { config, setHeroLeft, setHeroRight, setGridOffset } = useBattleStore();
  const { heroLeft, heroRight } = config;
  const gridOffset = config.gridOffset ?? { landscape: 0, portrait: 0 };
```

Replace with:

```tsx
export default function HeroPanel() {
  const { config, setHeroLeft, setHeroRight } = useBattleStore();
  const { heroLeft, heroRight } = config;
```

Find:

```tsx
      <div className="field">
        <label>
          <input type="checkbox" checked={heroRight.flipped} onChange={e => setHeroRight({ flipped: e.target.checked })} />
          {' '}Flipped horizontally
        </label>
      </div>

      <div className="section-title">Grid Position</div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        Shift the battle grid up (negative) or down (positive) in pixels.
      </p>
      <div className="row">
        <div className="field">
          <label>Landscape offset Y</label>
          <input type="number" step={10} value={gridOffset.landscape}
            onChange={e => setGridOffset('landscape', +e.target.value)} />
        </div>
        <div className="field">
          <label>Portrait offset Y</label>
          <input type="number" step={10} value={gridOffset.portrait}
            onChange={e => setGridOffset('portrait', +e.target.value)} />
        </div>
      </div>
    </div>
  );
}
```

Replace with:

```tsx
      <div className="field">
        <label>
          <input type="checkbox" checked={heroRight.flipped} onChange={e => setHeroRight({ flipped: e.target.checked })} />
          {' '}Flipped horizontally
        </label>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Remove "Grid Tiles" from `src/components/panels/BackgroundPanel.tsx`**

Find:

```tsx
export default function BackgroundPanel() {
  const { config, setBackground, setGridTile } = useBattleStore();
```

Replace with:

```tsx
export default function BackgroundPanel() {
  const { config, setBackground } = useBattleStore();
```

Find:

```tsx
      <div className="field">
        <label>Portrait Background</label>
        <AssetUpload label="Portrait BG" asset={config.backgrounds.portrait}
          onChange={a => setBackground('portrait', a)} />
      </div>
      <div className="section-title">Grid Tiles</div>
      <div className="field">
        <label>Walkable Hex Tile</label>
        <AssetUpload label="Walkable hex" asset={config.gridTiles.walkable}
          onChange={a => setGridTile('walkable', a)} />
      </div>
      <div className="field">
        <label>Active Hex Tile</label>
        <AssetUpload label="Active hex" asset={config.gridTiles.active}
          onChange={a => setGridTile('active', a)} />
      </div>
    </div>
  );
}
```

Replace with:

```tsx
      <div className="field">
        <label>Portrait Background</label>
        <AssetUpload label="Portrait BG" asset={config.backgrounds.portrait}
          onChange={a => setBackground('portrait', a)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. This repo has `noUnusedLocals`/`noUnusedParameters` enabled in `tsconfig.json` — if you left an unused `setGridOffset`/`setGridTile`/`gridOffset` binding in `HeroPanel.tsx` or `BackgroundPanel.tsx`, this step will fail with an "unused variable" error. Fix by removing the leftover binding.

- [ ] **Step 6: Manual verification in the browser**

Run: `npm run dev`, open the printed local URL.
- Confirm "Grid" is the first item in the left nav, above "Units".
- Click it: confirm Grid Size (Columns/Rows), Grid Position (Landscape/Portrait offset Y), and Grid Tiles (Walkable/Active hex uploads) all appear, all functional (typing a number or uploading an image updates and persists).
- Click "Heroes": confirm "Grid Position" no longer appears there, hero sections are otherwise unchanged.
- Click "Backgrounds": confirm "Grid Tiles" no longer appears there, background upload sections are otherwise unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/components/panels/GridPanel.tsx src/App.tsx src/components/panels/HeroPanel.tsx src/components/panels/BackgroundPanel.tsx
git commit -m "Add Grid panel; move grid position and grid tiles out of Heroes/Backgrounds"
```

---

### Task 4: Dependent col/row bounds

**Files:**
- Modify: `src/components/panels/UnitsPanel.tsx`
- Modify: `src/components/panels/ScenarioPanel.tsx`

**Interfaces:**
- Consumes: `config.grid` (Task 1).
- Produces: nothing consumed by later tasks — this is the last UI change.

- [ ] **Step 1: Thread grid bounds into `UnitCard` in `src/components/panels/UnitsPanel.tsx`**

Find:

```tsx
function UnitCard({
  unit,
  onUpdate,
  onRemove,
  canRemove,
}: {
  unit: UnitConfig;
  onUpdate: (patch: Partial<UnitConfig>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
```

Replace with:

```tsx
function UnitCard({
  unit,
  onUpdate,
  onRemove,
  canRemove,
  gridCols,
  gridRows,
}: {
  unit: UnitConfig;
  onUpdate: (patch: Partial<UnitConfig>) => void;
  onRemove: () => void;
  canRemove: boolean;
  gridCols: number;
  gridRows: number;
}) {
```

Find:

```tsx
          <div className="field">
            <label>Grid Col</label>
            <input type="number" min={0} max={4} value={unit.gridCol} onChange={e => onUpdate({ gridCol: +e.target.value })} />
          </div>
          <div className="field">
            <label>Grid Row</label>
            <input type="number" min={0} max={3} value={unit.gridRow} onChange={e => onUpdate({ gridRow: +e.target.value })} />
          </div>
```

Replace with:

```tsx
          <div className="field">
            <label>Grid Col</label>
            <input type="number" min={0} max={gridCols - 1} value={unit.gridCol} onChange={e => onUpdate({ gridCol: +e.target.value })} />
          </div>
          <div className="field">
            <label>Grid Row</label>
            <input type="number" min={0} max={gridRows - 1} value={unit.gridRow} onChange={e => onUpdate({ gridRow: +e.target.value })} />
          </div>
```

Find:

```tsx
export default function UnitsPanel() {
  const {
    config,
    updatePlayerUnit, addPlayerUnit, removePlayerUnit,
    updateEnemyUnit,  addEnemyUnit,  removeEnemyUnit,
  } = useBattleStore();

  return (
```

Replace with:

```tsx
export default function UnitsPanel() {
  const {
    config,
    updatePlayerUnit, addPlayerUnit, removePlayerUnit,
    updateEnemyUnit,  addEnemyUnit,  removeEnemyUnit,
  } = useBattleStore();
  const grid = config.grid ?? { cols: 5, rows: 4 };

  return (
```

Find (both `<UnitCard` usages):

```tsx
            <UnitCard
              key={u.id}
              unit={u}
              onUpdate={patch => updatePlayerUnit(u.id, patch)}
              onRemove={() => removePlayerUnit(u.id)}
              canRemove={config.playerUnits.length > 1}
            />
```

Replace with:

```tsx
            <UnitCard
              key={u.id}
              unit={u}
              onUpdate={patch => updatePlayerUnit(u.id, patch)}
              onRemove={() => removePlayerUnit(u.id)}
              canRemove={config.playerUnits.length > 1}
              gridCols={grid.cols}
              gridRows={grid.rows}
            />
```

Find:

```tsx
            <UnitCard
              key={u.id}
              unit={u}
              onUpdate={patch => updateEnemyUnit(u.id, patch)}
              onRemove={() => removeEnemyUnit(u.id)}
              canRemove={config.enemyUnits.length > 1}
            />
```

Replace with:

```tsx
            <UnitCard
              key={u.id}
              unit={u}
              onUpdate={patch => updateEnemyUnit(u.id, patch)}
              onRemove={() => removeEnemyUnit(u.id)}
              canRemove={config.enemyUnits.length > 1}
              gridCols={grid.cols}
              gridRows={grid.rows}
            />
```

- [ ] **Step 2: Update the Winning Sequence "move" step bounds in `src/components/panels/ScenarioPanel.tsx`**

Find:

```tsx
  const { scenario } = config;
  const alt = scenario.alternating;
```

Replace with:

```tsx
  const { scenario } = config;
  const alt = scenario.alternating;
  const gridCols = config.grid?.cols ?? 5;
  const gridRows = config.grid?.rows ?? 4;
```

Find:

```tsx
                    <input
                      type="number" min={0} max={4} value={step.moveTargetCol ?? 0}
                      onChange={e => updateStep(i, { moveTargetCol: +e.target.value })}
                      style={{ width: 50 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>row</span>
                    <input
                      type="number" min={0} max={3} value={step.moveTargetRow ?? 0}
                      onChange={e => updateStep(i, { moveTargetRow: +e.target.value })}
                      style={{ width: 50 }}
                    />
```

Replace with:

```tsx
                    <input
                      type="number" min={0} max={gridCols - 1} value={step.moveTargetCol ?? 0}
                      onChange={e => updateStep(i, { moveTargetCol: +e.target.value })}
                      style={{ width: 50 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>row</span>
                    <input
                      type="number" min={0} max={gridRows - 1} value={step.moveTargetRow ?? 0}
                      onChange={e => updateStep(i, { moveTargetRow: +e.target.value })}
                      style={{ width: 50 }}
                    />
```

- [ ] **Step 3: Update the Alternating enemy-turn "move" bounds**

Find:

```tsx
                        <input
                          type="number" min={0} max={4} value={turn.moveTargetCol ?? 0}
                          onChange={e => updateEnemyTurn(turn.id, { moveTargetCol: +e.target.value })}
                          style={{ width: 50 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>row</span>
                        <input
                          type="number" min={0} max={3} value={turn.moveTargetRow ?? 0}
                          onChange={e => updateEnemyTurn(turn.id, { moveTargetRow: +e.target.value })}
                          style={{ width: 50 }}
                        />
```

Replace with:

```tsx
                        <input
                          type="number" min={0} max={gridCols - 1} value={turn.moveTargetCol ?? 0}
                          onChange={e => updateEnemyTurn(turn.id, { moveTargetCol: +e.target.value })}
                          style={{ width: 50 }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>row</span>
                        <input
                          type="number" min={0} max={gridRows - 1} value={turn.moveTargetRow ?? 0}
                          onChange={e => updateEnemyTurn(turn.id, { moveTargetRow: +e.target.value })}
                          style={{ width: 50 }}
                        />
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Manual verification in the browser**

Run: `npm run dev`.
- In the Grid panel, change Columns to 7 and Rows to 6.
- Go to Units: confirm a unit's Grid Col input now accepts up to 6 (not 4), Grid Row up to 5 (not 3).
- Go to Scenario, switch to Guided or Puzzle mode, add a Winning Sequence step, set its action to "Move": confirm the col input accepts up to 6, row up to 5.
- Switch to Alternating mode, add an Enemy Turn, set its action to "Move": same check.
- In Live Preview, confirm the grid visibly redraws with 7 columns × 6 rows (more, smaller hexes) without any hex overlapping the hero portraits or spellbook UI.

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/UnitsPanel.tsx src/components/panels/ScenarioPanel.tsx
git commit -m "Bind unit/scenario grid col-row input bounds to configured grid size"
```

---

### Task 5: End-to-end verification

**Files:** none (verification only — fix forward in the relevant task's file if something's broken, then re-run this task).

**Interfaces:** none.

- [ ] **Step 1: Start the app and confirm a clean build**

```bash
npx tsc --noEmit
npm run build
```
Expected: both clean.

- [ ] **Step 2: Executable check of the auto-fit formula**

There is no test framework in this repo; verify by compiling `src/utils/htmlGenerator.ts` standalone with esbuild and executing `generateHTML()` directly.

Create a scratch directory and compile:

```bash
mkdir -p /tmp/grid-verify
./node_modules/.bin/esbuild src/utils/htmlGenerator.ts --bundle --platform=node --format=cjs --outfile=/tmp/grid-verify/htmlGenerator.cjs
```

Write `/tmp/grid-verify/verify.cjs` (do not commit it — it's scratch, delete it when done) with exactly this content:

```js
const { generateHTML } = require('./htmlGenerator.cjs');

const unit = (over) => ({
  id: 'x', name: 'X', type: 'melee', hp: 100, baseDamage: 100, defense: 0,
  damageMultiplier: 1, gridCol: 0, gridRow: 0, displayWidth: 110, moveRange: 2,
  resistTo: [], flipped: false, assets: { idle: null, attack: null }, ...over,
});

function baseConfig(gridOverride) {
  const cfg = {
    id: 'cfg', name: 'Test', spellbookEnabled: true,
    playerUnits: [unit({ id: 'knight', name: 'Knight', type: 'melee', gridCol: 1, gridRow: 2 })],
    enemyUnits: [unit({ id: 'giant', name: 'Giant', type: 'ranged', gridCol: 3, gridRow: 2 })],
    heroLeft: { asset: null, flipped: true, posX: 42, posY: 170 },
    heroRight: { asset: null, flipped: false, posX: 42, posY: 150 },
    spells: [],
    scenario: {
      mode: 'puzzle',
      winningSequence: [],
      failConditions: [
        { id: 'A', trigger: 'move_to_flying', hintLines: ['a'] },
        { id: 'B', trigger: 'kill_ranged_first', hintLines: ['b'] },
        { id: 'C', trigger: 'wrong_spell_on_flying', hintLines: ['c'] },
        { id: 'D', trigger: 'wasted_spell', hintLines: ['d'] },
      ],
      retaliations: [],
      alternating: { firstTurn: 'player', playerTurns: [{ id: 'pt1', unitId: 'knight' }], enemyTurns: [], attackReactions: [] },
    },
    popups: {
      victory: { bannerAsset: null, boardAsset: null, ctaButtonAsset: null },
      defeat: { bannerAsset: null, boardAsset: null, retryButtonAsset: null, storeButtonAsset: null, hintTextColor: '#fff' },
    },
    backgrounds: { landscape: null, portrait: null },
    store: { iosUrl: '', androidUrl: '', ctaFailCount: 3 },
    audio: { music: null, sfxMap: {} },
    gridTiles: { walkable: null, active: null },
    uiAssets: { spellbookClosed: null, spellbookOpen: null, meleeIcon: null, rangedIcon: null, flyingIcon: null },
    appIcon: null,
    grid: { cols: 5, rows: 4 },
    gridOffset: { landscape: 0, portrait: 0 },
    hintLayout: { landscapeY: 265, portraitY: 265, landscapeFontSize: 13.5, portraitFontSize: 13.5 },
    speechLayout: { landscapeX: 160, landscapeY: 14, landscapeFontSize: 13, portraitX: 14, portraitY: 14, portraitFontSize: 13 },
  };
  if (gridOverride === undefined) return cfg;
  if (gridOverride === null) { delete cfg.grid; return cfg; }
  cfg.grid = gridOverride;
  return cfg;
}

function extractLayout(html) {
  const m = html.match(/const LAYOUT=\{[\s\S]*?\};/);
  if (!m) throw new Error('LAYOUT not found in generated output');
  return m[0];
}

function fitLayout(hexW0, hexH0, gx0_0, gy0_0, cols, rows) {
  const BASE_COLS = 5, BASE_ROWS = 4;
  const footprintW = hexW0 * (BASE_COLS + 0.5);
  const footprintH = hexH0 * ((BASE_ROWS - 1) * 0.75 + 1);
  const centerX = gx0_0 - hexW0 / 2 + footprintW / 2;
  const centerY = gy0_0 - hexH0 / 2 + footprintH / 2;
  const scaleW = footprintW / (hexW0 * (cols + 0.5));
  const scaleH = footprintH / (hexH0 * ((rows - 1) * 0.75 + 1));
  const scale = Math.min(scaleW, scaleH);
  const hexW = hexW0 * scale, hexH = hexH0 * scale;
  const colSp = hexW, rowSp = hexH * 0.75, oddDx = hexW / 2;
  const newFootprintW = hexW * (cols + 0.5), newFootprintH = hexH * ((rows - 1) * 0.75 + 1);
  const gx0 = centerX - newFootprintW / 2 + hexW / 2;
  const gy0 = centerY - newFootprintH / 2 + hexH / 2;
  return { hexW, hexH, colSp, rowSp, oddDx, gx0, gy0 };
}

function near(a, b, label) {
  if (Math.abs(a - b) > 0.01) throw new Error(`${label}: expected ${b}, got ${a}`);
}

let allPass = true;
function check(label, fn) {
  try { fn(); console.log('PASS - ' + label); }
  catch (e) { console.log('FAIL - ' + label + ': ' + e.message); allPass = false; }
}

// 1. Default (grid: {cols:5,rows:4}) must be byte-identical to today's hardcoded values.
check('default grid produces original hardcoded LAYOUT', () => {
  const html = generateHTML(baseConfig(), 'unity');
  const layout = extractLayout(html);
  for (const expected of [
    'gx0:240', 'gy0:275', 'hexW:120', 'hexH:80', 'colSp:120', 'rowSp:60', 'oddDx:60',
    'gx0:79', 'gy0:420', 'hexW:90', 'hexH:60', 'colSp:90', 'rowSp:45', 'oddDx:45',
  ]) {
    if (!layout.includes(expected)) throw new Error(`missing "${expected}" in ${layout}`);
  }
  if (!html.includes('const COLS=5,ROWS=4;')) throw new Error('COLS/ROWS not 5/4');
});

// 2. Non-default grid (7 cols x 6 rows): independently re-derive expected values
//    from the design spec's formula (written fresh here, not copy-pasted from
//    htmlGenerator.ts) and compare against the actual generated output.
check('7x6 grid matches independently-computed auto-fit values', () => {
  const html = generateHTML(baseConfig({ cols: 7, rows: 6 }), 'unity');
  if (!html.includes('const COLS=7,ROWS=6;')) throw new Error('COLS/ROWS not 7/6');
  const land = fitLayout(120, 80, 240, 275, 7, 6);
  const port = fitLayout(90, 60, 79, 420, 7, 6);
  const layout = extractLayout(html);
  const m = (key) => {
    const mm = layout.match(new RegExp(key + ':([\\d.]+)'));
    if (!mm) throw new Error(`key ${key} not found in ${layout}`);
    return parseFloat(mm[1]);
  };
  // land block comes first, port second — extract each block separately
  const landBlock = layout.match(/land:\{[^}]*\}/)[0];
  const portBlock = layout.match(/port:\{[^}]*\}/)[0];
  const mIn = (block, key) => {
    const mm = block.match(new RegExp(key + ':([\\d.]+)'));
    if (!mm) throw new Error(`key ${key} not found in ${block}`);
    return parseFloat(mm[1]);
  };
  near(mIn(landBlock, 'gx0'), land.gx0, 'land.gx0');
  near(mIn(landBlock, 'gy0'), land.gy0, 'land.gy0');
  near(mIn(landBlock, 'hexW'), land.hexW, 'land.hexW');
  near(mIn(landBlock, 'hexH'), land.hexH, 'land.hexH');
  near(mIn(landBlock, 'colSp'), land.colSp, 'land.colSp');
  near(mIn(landBlock, 'rowSp'), land.rowSp, 'land.rowSp');
  near(mIn(landBlock, 'oddDx'), land.oddDx, 'land.oddDx');
  near(mIn(portBlock, 'gx0'), port.gx0, 'port.gx0');
  near(mIn(portBlock, 'gy0'), port.gy0, 'port.gy0');
  near(mIn(portBlock, 'hexW'), port.hexW, 'port.hexW');
  near(mIn(portBlock, 'hexH'), port.hexH, 'port.hexH');
});

// 3. Regression: a config with `grid` entirely absent (simulating an old saved
//    config from before this feature) must fall back to the same 5x4 default.
check('missing grid field falls back to 5x4 default without throwing', () => {
  const html = generateHTML(baseConfig(null), 'unity');
  if (!html.includes('const COLS=5,ROWS=4;')) throw new Error('fallback COLS/ROWS not 5/4');
  const layout = extractLayout(html);
  if (!layout.includes('gx0:240') || !layout.includes('gx0:79')) throw new Error('fallback LAYOUT does not match default');
});

console.log(allPass ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(allPass ? 0 : 1);
```

Run: `node /tmp/grid-verify/verify.cjs`
Expected: `ALL CHECKS PASSED`, exit code 0. If any check fails, it names exactly which value was wrong and by how much — use that to find the bug in `fitLayout` or its call sites in `src/utils/htmlGenerator.ts` (Task 2).

- [ ] **Step 3: Regression check against Puzzle/Alternating defaults**

Using the same compiled `generateHTML()`, generate HTML for a config with `grid` **absent entirely** (delete the field from the plain object before calling, to simulate an old saved config predating this feature) and confirm `generateHTML()` does not throw, and the extracted `LAYOUT` matches the same defaults as Step 2's point 2 (i.e. the `(config as any).grid?.cols ?? 5` fallback works).

- [ ] **Step 4: Manual verification in the browser**

Run `npm run dev`. Repeat Task 3 Step 6 and Task 4 Step 5's manual checks in one pass: Grid panel is first in the nav with all three sections working; Heroes/Backgrounds no longer show the relocated sections; changing grid size updates the Units/Scenario input bounds and the Live Preview's rendered grid.

**If no browser/screenshot tool is available in this environment**, do not fabricate having done this — state plainly in your report that this step was skipped for that reason, matching how the Guided-mode plan's equivalent step was handled.

- [ ] **Step 5: Fix-forward if anything failed**

If any check failed, identify which Task (1-4) owns the broken piece, fix it there, re-run the relevant checks, and commit the fix with a message describing what was wrong.

- [ ] **Step 6: Update the design doc's status**

Add a one-line note at the top of `docs/superpowers/specs/2026-07-30-grid-panel-design.md`: `**Status:** Implemented.` Commit:

```bash
git add docs/superpowers/specs/2026-07-30-grid-panel-design.md
git commit -m "Mark grid panel design as implemented"
```
