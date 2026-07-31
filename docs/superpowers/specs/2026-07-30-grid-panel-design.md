# Grid Panel — Design

**Status:** Implemented.

## Purpose

Add a dedicated "Grid" section to the editor, first in the nav (above
Units), consolidating everything about the battle grid that is currently
scattered across other panels, and adding configurable grid size (columns
and rows) where today it's hardcoded to 5×4 in the generated playable.

## Background

- Grid Y-offset (landscape/portrait) is currently a "Grid Position" section
  inside `HeroPanel.tsx`, alongside hero portrait placement — unrelated to
  heroes, just parked there.
- The two hex tile images (dim "walkable" tile, brighter "active/selected"
  tile) are currently a "Grid Tiles" section inside `BackgroundPanel.tsx`,
  alongside the landscape/portrait background images — same situation.
- Grid dimensions are not configurable at all today: `src/utils/htmlGenerator.ts`
  hardcodes `const COLS=5,ROWS=4;` in the generated script, and three UI
  spots hardcode the corresponding bounds on col/row number inputs:
  `UnitsPanel.tsx` (`max={4}`/`max={3}` on a unit's `gridCol`/`gridRow`),
  and `ScenarioPanel.tsx` twice (the Guided/Puzzle "move" winning-sequence
  step, and the Alternating "move" enemy-turn type).
- The hex layout math in `htmlGenerator.ts` (`LAYOUT.land`/`LAYOUT.port`)
  hardcodes `hexW`/`hexH`/`colSp`/`rowSp`/`oddDx`/`gx0`/`gy0` tuned by hand
  for the 5×4 case. `hexDist`/`toCube` (hex distance math) and `buildGrid()`
  (the loop that creates hex elements, including its `col===COLS-1&&row%2===1`
  "skip the dangling last hex on odd rows" rule) already read `COLS`/`ROWS`
  as live values, so they need no changes — only the six geometry constants
  above need to become computed instead of hardcoded.

## Data model changes (`src/types/battle.ts`)

- `BattleConfig` gains a new field: `grid: { cols: number; rows: number };`.
- Read as `config.grid ?? { cols: 5, rows: 4 }` wherever consumed, matching
  the codebase's existing convention for backward-compatible schema growth
  (e.g. `gridOffset`, `hintLayout`) — old saved configs without this field
  behave exactly as they do today.

## Editor UI changes

### New file: `src/components/panels/GridPanel.tsx`

Three sections, in this order:

1. **Grid Size** — two number inputs, `Columns` (min 2, max 10) and `Rows`
   (min 2, max 8), bound to `config.grid.cols`/`config.grid.rows` via a new
   store action `setGridSize(patch: Partial<{ cols: number; rows: number }>)`.
2. **Grid Position** — the existing landscape/portrait Y-offset inputs,
   moved verbatim from `HeroPanel.tsx` (same `setGridOffset` action, same
   labels/copy).
3. **Grid Tiles** — the existing walkable/active hex tile image uploads,
   moved verbatim from `BackgroundPanel.tsx` (same `setGridTile` action,
   same labels).

### `HeroPanel.tsx`

Remove the "Grid Position" section (moved to `GridPanel`). Nothing else
changes.

### `BackgroundPanel.tsx`

Remove the "Grid Tiles" section (moved to `GridPanel`). Nothing else
changes.

### `App.tsx`

- Add `'grid'` to the `NavItem` union and as the **first** entry in
  `NAV_ITEMS` (label `"Grid"`), above `'units'`.
- Import and render `GridPanel` when `section === 'grid'`.

### Dependent bounds on existing col/row inputs

Three existing number-input pairs currently hardcode the grid extent;
each becomes bound to the configured size instead:

- `UnitsPanel.tsx`: a unit's `gridCol`/`gridRow` inputs — `max` becomes
  `config.grid.cols - 1` / `config.grid.rows - 1` (falling back to 4/3 if
  `config.grid` is absent, matching the type-level default).
- `ScenarioPanel.tsx`, Winning Sequence step's `move` action — the
  `moveTargetCol`/`moveTargetRow` inputs' `max` likewise becomes
  `config.grid.cols - 1` / `config.grid.rows - 1`.
- `ScenarioPanel.tsx`, Alternating enemy-turn `move` action — the
  `moveTargetCol`/`moveTargetRow` inputs' `max` likewise.

### `src/store/battleStore.ts`

- `DEFAULT_CONFIG.grid = { cols: 5, rows: 4 }`.
- New action `setGridSize(patch: Partial<{ cols: number; rows: number }>)`,
  following the same `pushUndo`/`set` pattern as `setGridOffset`.

## Runtime logic changes (`src/utils/htmlGenerator.ts`)

### `COLS`/`ROWS` become configured values

```ts
const gridCols = config.grid?.cols ?? 5;
const gridRows = config.grid?.rows ?? 4;
```
injected as `const COLS=${gridCols},ROWS=${gridRows};` (replacing the
hardcoded `const COLS=5,ROWS=4;`). No other runtime logic needs to change:
`hexDist`/`toCube` operate purely on col/row indices, and `buildGrid()`'s
skip-rule already reads `COLS`/`ROWS` as live values.

### Auto-fit hex geometry (computed once, at generation time, in TypeScript)

For each orientation (`land`, `port`), the existing hand-tuned constants at
the 5×4 baseline are treated as defining a fixed on-screen **footprint**
(the same region of the viewport the grid occupies today, regardless of
how many hexes are packed into it) and a fixed **center point**. Changing
`cols`/`rows` recomputes `hexW`/`hexH`/`colSp`/`rowSp`/`oddDx`/`gx0`/`gy0`
to pack the new count into that same footprint, uniformly scaled (never
stretched, so uploaded hex tile images never distort) and re-centered.

Baseline constants (unchanged, still literals in the generator):
```
land: hexW0=120, hexH0=80, gx0_0=240, gy0_0=275
port: hexW0=90,  hexH0=60, gx0_0=79,  gy0_0=420
BASE_COLS=5, BASE_ROWS=4
```

For each orientation, computed once per `generateHTML()` call:
```ts
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
```

At `cols=5, rows=4` (the default), this reduces to `scale=1` and the exact
original constants for both orientations — verified by hand:
- Landscape: `footprintW=660, footprintH=260, centerX=510, centerY=365` →
  `hexW=120, hexH=80, colSp=120, rowSp=60, oddDx=60, gx0=240, gy0=275`
  (all identical to today's hardcoded values).
- Portrait: `footprintW=495, footprintH=195, centerX=281.5, centerY=487.5`
  → `hexW=90, hexH=60, colSp=90, rowSp=45, oddDx=45, gx0=79, gy0=420`
  (identical to today).

This guarantees byte-identical generated output for every existing saved
config (which all have `grid` absent, defaulting to 5×4) — this feature is
purely additive for anyone who doesn't touch the new Grid Size inputs.

The existing `gridOffset` Y-shift (landscape/portrait) is applied on top of
the computed `gy0`, exactly as it is today (`gy0_0+gridOffsetLand` becomes
`gy0+gridOffsetLand`, computed after `fitLayout` returns).

`LAYOUT.land`/`LAYOUT.port`'s `vpW`/`vpH` (1000×563 / 563×1000) do not
change — the viewport size is fixed; only how the grid is packed inside it
changes.

## Testing note

This repo has no automated test framework (confirmed: no Jest/Vitest, no
test files). Verification is `npx tsc --noEmit`, a full `npm run build`,
and — for the layout math specifically — a standalone executable check
(compiling `htmlGenerator.ts` with esbuild and calling `generateHTML()`
directly against configs with `grid` absent, at the 5×4 default, and at a
non-default size, asserting the computed `LAYOUT` constants match by hand
calculation) — the same technique used to verify the Guided mode feature.

## Out of scope

- No changes to hex distance/pathing math (`hexDist`, `toCube`,
  `findAttackHex`, `findBestMoveToward`, etc.) — these already operate
  purely on col/row indices and are unaffected by grid size.
- No changes to how many enemies/players can be placed — that was never
  grid-size-limited beyond the col/row bounds this design updates.
- No validation preventing a unit's `gridCol`/`gridRow` from becoming
  out-of-bounds if the grid is shrunk after units are already placed
  farther out — the number input's `max` simply changes going forward;
  existing out-of-range values are a pre-existing category of designer
  error (the same as e.g. overlapping unit positions today) and not
  newly introduced or specially handled by this feature. The same applies
  to `WinStep`/`EnemyTurnDef`'s `moveTargetCol`/`moveTargetRow` in the
  Scenario panel — not called out separately in the original draft of this
  section, but the same accepted risk.
- Unit sprite `displayWidth` stays an absolute pixel value and does not
  scale down when the grid is configured larger (smaller hexes). At small
  grids this is unnoticeable; at the largest allowed size (10 cols /
  8 rows), landscape `hexW` shrinks from 120px to well under half that,
  and a default-sized unit sprite (~110px) will visibly overlap its
  neighbors. This was not anticipated when this design was written and is
  left as a known follow-up rather than fixed here — a designer raising
  the grid size will need to manually shrink `displayWidth` on their units
  to compensate. A future iteration could scale `displayWidth` by the same
  factor `fitLayout`'s `scale` computes, but that couples two independently
  designer-tunable values in a way this design doesn't attempt.
