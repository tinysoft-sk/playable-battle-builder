# Guided Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third battle mode, "Guided", where the player is walked through the exact winning sequence one step at a time via a persistent tooltip, with only the single correct action clickable each turn.

**Architecture:** Extend the existing (currently editor-only, not codegen-consumed) `scenario.winningSequence` with a `move` action and per-step tooltip text. `utils/htmlGenerator.ts`'s `generateHTML()` — a single large function that returns a self-contained HTML/JS string for the playable — gets a new "guided" code path that reuses existing animation/combat primitives (`movePlayerTo`, `playerAttackAlt`, `castSpell`, `doRetaliation`) but drives them from the step list instead of free player choice, and gates every click to the one valid target.

**Tech Stack:** React + TypeScript + Zustand (editor), a single generated vanilla-JS/HTML string (the playable itself, built by template literals in `htmlGenerator.ts`). No test runner exists in this repo (`package.json` has no Jest/Vitest/etc., no test files anywhere) — do not add one. Verification per task is: `npx tsc --noEmit` for type safety, plus manual verification via `npm run dev` (the editor's own Live Preview panel renders `generateHTML()` output live in an iframe — this is the real "test" for behavior).

## Global Constraints

- Do not modify Puzzle mode's or Alternating mode's existing behavior — Guided is purely additive. Any shared function that gets a new parameter must default to the old behavior when called from existing (non-guided) call sites.
- `tooltipText`, `moveTargetCol`, `moveTargetRow` are optional on `WinStep` (backward compatibility with configs saved before this change) — always read them with `?? ''` / `?? 0` fallbacks in `htmlGenerator.ts`, matching the existing convention there (e.g. `(config as any).hintLayout?.landscapeY ?? 265`).
- Guided mode never shows the fail/retry screen as a result of a wrong click — wrong clicks are always a no-op plus a "nudge" animation on the tooltip bubble, never a state change.
- Reuse the Puzzle-style Post-Kill Retaliation system (`scenario.retaliations`, the `doRetaliation()` function) for Guided combat consequences — not Alternating's per-hit `attackReactions` system.
- Two untracked files, `src/types/battleStore.ts` and `src/types/htmlGenerator.ts`, are stale unused duplicates (confirmed via `grep -rn "types/battleStore\|types/htmlGenerator" src` — nothing imports them). Do not touch them; they are out of scope.

---

### Task 1: Type and default-config changes

**Files:**
- Modify: `src/types/battle.ts` (the `WinStep` interface and `BattleScenario.mode`)
- Modify: `src/store/battleStore.ts` (the `DEFAULT_CONFIG.scenario.winningSequence` example steps)

**Interfaces:**
- Produces: `WinStep.action` union gains `'move'`; `WinStep` gains optional `moveTargetCol?: number`, `moveTargetRow?: number`, `tooltipText?: string`. `BattleScenario.mode` union gains `'guided'`. These are the fields every later task reads/writes.

- [ ] **Step 1: Update `WinStep` and `BattleScenario` in `src/types/battle.ts`**

Find this block (currently lines 53–59):

```typescript
export interface WinStep {
  order: number;
  actorUnitId: string;
  action: 'cast_spell' | 'melee_attack' | 'ranged_attack';
  spellId?: string;
  targetUnitId: string;
}
```

Replace with:

```typescript
export interface WinStep {
  order: number;
  actorUnitId: string;
  action: 'cast_spell' | 'melee_attack' | 'ranged_attack' | 'move';
  spellId?: string;
  targetUnitId: string;
  moveTargetCol?: number;
  moveTargetRow?: number;
  tooltipText?: string;
}
```

Find this line (currently line 100):

```typescript
  mode: 'puzzle' | 'alternating';
```

Replace with:

```typescript
  mode: 'puzzle' | 'alternating' | 'guided';
```

- [ ] **Step 2: Add tooltip text to the default winning sequence in `src/store/battleStore.ts`**

Find this block (currently lines 98–101):

```typescript
    winningSequence: [
      { order: 0, actorUnitId: 'knight', action: 'cast_spell', spellId: 'fireball', targetUnitId: 'valkyrie' },
      { order: 1, actorUnitId: 'knight', action: 'melee_attack', targetUnitId: 'armored_giant' },
    ],
```

Replace with:

```typescript
    winningSequence: [
      { order: 0, actorUnitId: 'knight', action: 'cast_spell', spellId: 'fireball', targetUnitId: 'valkyrie', tooltipText: 'Cast Fireball on the Valkyrie first — she flies and can always reach you, and only fire hurts her.' },
      { order: 1, actorUnitId: 'knight', action: 'melee_attack', targetUnitId: 'armored_giant', tooltipText: 'Now finish off the Armored Giant with a melee strike.' },
    ],
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors (this is a superset-widening change; nothing narrows a `WinStep.action` or `scenario.mode` value in a way that would now be non-exhaustive, since neither file has a `switch` over these unions — confirm with `grep -rn "scenario.mode ===" src` and `grep -rn "\.action ===" src` and check every match still compiles).

- [ ] **Step 4: Commit**

```bash
git add src/types/battle.ts src/store/battleStore.ts
git commit -m "Add guided mode + move-step + tooltip fields to WinStep"
```

---

### Task 2: Editor UI for Guided mode

**Files:**
- Modify: `src/components/panels/ScenarioPanel.tsx`

**Interfaces:**
- Consumes: `WinStep` shape from Task 1 (`action: '...' | 'move'`, `moveTargetCol?`, `moveTargetRow?`, `tooltipText?`), `BattleScenario.mode` including `'guided'`.
- Produces: nothing new consumed by later tasks — this is purely the authoring UI. Later tasks (3–6) read `config.scenario.winningSequence` and `config.scenario.mode` exactly as before; this task doesn't change how the store exposes data (it already uses the generic `setScenario`/`updateStep`/`addStep` helpers, no new store actions needed).

- [ ] **Step 1: Add the Guided option to the mode selector**

Find (currently lines 78–81):

```tsx
        <select value={scenario.mode} onChange={e => setScenario({ mode: e.target.value as 'puzzle' | 'alternating' })}>
          <option value="puzzle">Puzzle (one winning path)</option>
          <option value="alternating">Alternating turns</option>
        </select>
```

Replace with:

```tsx
        <select value={scenario.mode} onChange={e => setScenario({ mode: e.target.value as 'puzzle' | 'alternating' | 'guided' })}>
          <option value="puzzle">Puzzle (one winning path)</option>
          <option value="alternating">Alternating turns</option>
          <option value="guided">Guided (one option per turn)</option>
        </select>
```

- [ ] **Step 2: Default new steps with an empty tooltip**

Find `addStep` (currently lines 48–58):

```tsx
  function addStep() {
    const order = scenario.winningSequence.length;
    setScenario({
      winningSequence: [...scenario.winningSequence, {
        order,
        actorUnitId: config.playerUnits[0]?.id ?? '',
        action: 'melee_attack',
        targetUnitId: config.enemyUnits[0]?.id ?? '',
      }],
    });
  }
```

Replace with:

```tsx
  function addStep() {
    const order = scenario.winningSequence.length;
    setScenario({
      winningSequence: [...scenario.winningSequence, {
        order,
        actorUnitId: config.playerUnits[0]?.id ?? '',
        action: 'melee_attack',
        targetUnitId: config.enemyUnits[0]?.id ?? '',
        tooltipText: '',
      }],
    });
  }
```

- [ ] **Step 3: Show Winning Sequence / Retaliations for Guided too, keep Fail Conditions Puzzle-only**

Find the opening of the mode-gated block (currently line 85):

```tsx
      {scenario.mode === 'puzzle' && (
```

Replace with:

```tsx
      {(scenario.mode === 'puzzle' || scenario.mode === 'guided') && (
```

Find the Fail Conditions section (currently lines 150–171):

```tsx
          <div className="section-title">Fail Conditions</div>
          {scenario.failConditions.map(fc => (
            <div key={fc.id} className="fail-card">
              <div className="fail-card-header">
                <span className="fail-id">{fc.id}</span>
                <select
                  value={fc.trigger}
                  onChange={e => updateFailCondition(fc.id, { trigger: e.target.value as FailCondition['trigger'] })}
                  style={{ flex: 1 }}
                >
                  {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Hint Lines (one per line → shown with line breaks)</label>
                <textarea
                  value={fc.hintLines.join('\n')}
                  onChange={e => updateFailCondition(fc.id, { hintLines: e.target.value.split('\n') })}
                />
              </div>
            </div>
          ))}
```

Replace with (wraps the same content in a Puzzle-only guard):

```tsx
          {scenario.mode === 'puzzle' && (
            <>
              <div className="section-title">Fail Conditions</div>
              {scenario.failConditions.map(fc => (
                <div key={fc.id} className="fail-card">
                  <div className="fail-card-header">
                    <span className="fail-id">{fc.id}</span>
                    <select
                      value={fc.trigger}
                      onChange={e => updateFailCondition(fc.id, { trigger: e.target.value as FailCondition['trigger'] })}
                      style={{ flex: 1 }}
                    >
                      {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Hint Lines (one per line → shown with line breaks)</label>
                    <textarea
                      value={fc.hintLines.join('\n')}
                      onChange={e => updateFailCondition(fc.id, { hintLines: e.target.value.split('\n') })}
                    />
                  </div>
                </div>
              ))}
            </>
          )}
```

- [ ] **Step 4: Add the Move action option and col/row inputs, and the tooltip field, to each step card**

Find the entire step-card block (currently lines 91–147):

```tsx
          {scenario.winningSequence.map((step, i) => (
            <div key={i} className="step-card" style={{ flexWrap: 'wrap', gap: 6 }}>
              <span className="step-order">{i + 1}.</span>

              {/* Actor */}
              <select
                title="Who acts"
                value={step.actorUnitId ?? config.playerUnits[0]?.id ?? ''}
                onChange={e => updateStep(i, { actorUnitId: e.target.value })}
                style={{ flex: '1 1 90px', minWidth: 80 }}
              >
                {config.playerUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              {/* Action */}
              <select
                title="Action"
                value={step.action}
                onChange={e => updateStep(i, { action: e.target.value as WinStep['action'] })}
                style={{ flex: '1 1 120px', minWidth: 100 }}
              >
                <option value="cast_spell">Cast Spell</option>
                <option value="melee_attack">Melee Attack</option>
                <option value="ranged_attack">Ranged Attack</option>
              </select>

              {/* Spell (if cast) */}
              {step.action === 'cast_spell' && (
                <select
                  title="Spell"
                  value={step.spellId ?? ''}
                  onChange={e => updateStep(i, { spellId: e.target.value })}
                  style={{ flex: '1 1 90px', minWidth: 80 }}
                >
                  {config.spells.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                  ))}
                </select>
              )}

              {/* Target */}
              <select
                title="Target enemy"
                value={step.targetUnitId}
                onChange={e => updateStep(i, { targetUnitId: e.target.value })}
                style={{ flex: '1 1 90px', minWidth: 80 }}
              >
                {config.enemyUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              <button className="unit-remove" onClick={() => removeStep(i)}>✕</button>
            </div>
          ))}
```

Replace with:

```tsx
          {scenario.winningSequence.map((step, i) => (
            <div key={i} className="step-card" style={{ flexWrap: 'wrap', gap: 6 }}>
              <span className="step-order">{i + 1}.</span>

              {/* Actor */}
              <select
                title="Who acts"
                value={step.actorUnitId ?? config.playerUnits[0]?.id ?? ''}
                onChange={e => updateStep(i, { actorUnitId: e.target.value })}
                style={{ flex: '1 1 90px', minWidth: 80 }}
              >
                {config.playerUnits.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              {/* Action */}
              <select
                title="Action"
                value={step.action}
                onChange={e => updateStep(i, { action: e.target.value as WinStep['action'] })}
                style={{ flex: '1 1 120px', minWidth: 100 }}
              >
                <option value="cast_spell">Cast Spell</option>
                <option value="melee_attack">Melee Attack</option>
                <option value="ranged_attack">Ranged Attack</option>
                <option value="move">Move</option>
              </select>

              {/* Spell (if cast) */}
              {step.action === 'cast_spell' && (
                <select
                  title="Spell"
                  value={step.spellId ?? ''}
                  onChange={e => updateStep(i, { spellId: e.target.value })}
                  style={{ flex: '1 1 90px', minWidth: 80 }}
                >
                  {config.spells.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name}</option>
                  ))}
                </select>
              )}

              {/* Target: enemy select, or move col/row */}
              {step.action === 'move' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 0 auto' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>col</span>
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
                  </div>
                </>
              ) : (
                <select
                  title="Target enemy"
                  value={step.targetUnitId}
                  onChange={e => updateStep(i, { targetUnitId: e.target.value })}
                  style={{ flex: '1 1 90px', minWidth: 80 }}
                >
                  {config.enemyUnits.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              )}

              <button className="unit-remove" onClick={() => removeStep(i)}>✕</button>

              {scenario.mode === 'guided' && (
                <div className="field" style={{ flex: '1 1 100%' }}>
                  <label>Tooltip (what &amp; why)</label>
                  <textarea
                    value={step.tooltipText ?? ''}
                    onChange={e => updateStep(i, { tooltipText: e.target.value })}
                  />
                </div>
              )}
            </div>
          ))}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification in the browser**

Run: `npm run dev`, open the printed local URL.
- Select Guided from the Battle Mode dropdown → confirm "Winning Sequence" and "Post-Kill Retaliations" sections appear, "Fail Conditions" does not.
- On a step, change Action to "Move" → confirm the enemy-target dropdown is replaced by col/row number inputs, and they're editable.
- Confirm a "Tooltip (what & why)" textarea appears under each step only in Guided mode (switch back to Puzzle and confirm it disappears, while Winning Sequence itself still shows with Fail Conditions back).
- Type into the tooltip textarea and confirm the text persists (doesn't reset) after clicking elsewhere in the panel.

- [ ] **Step 7: Commit**

```bash
git add src/components/panels/ScenarioPanel.tsx
git commit -m "Add Guided mode editor UI: move steps and per-step tooltips"
```

---

### Task 3: Guided step data, state, and active-player resolution

**Files:**
- Modify: `src/utils/htmlGenerator.ts`

**Interfaces:**
- Consumes: `config.scenario.winningSequence` (`WinStep[]` from Task 1), `config.scenario.mode`.
- Produces (used by Tasks 4 and 5): the injected `GUIDED_STEPS` array (each entry: `{actorId, action, spellId, targetId, moveCol, moveRow, tooltip}`), `gs.guidedIdx` state field, the `guidedStep()` helper (returns the current entry or `null`), and the `advanceGuided()` helper. Also: `activePlayerIdx()` now resolves correctly for Guided mode, which Task 5's combat code depends on.

- [ ] **Step 1: Inject `GUIDED_STEPS` alongside the other alternating-mode injection values**

Find (currently around line 92–100, right after `enemiesData`):

```typescript
  // alternating mode injection values
  const altCfg = config.scenario.alternating ?? { firstTurn: 'player', playerTurns: [], enemyTurns: [], attackReactions: [] };
```

Insert *before* that line:

```typescript
  // guided mode injection values
  const guidedStepsData = config.scenario.winningSequence.map(s => ({
    actorId: s.actorUnitId,
    action: s.action,
    spellId: s.spellId ?? '',
    targetId: s.targetUnitId ?? '',
    moveCol: s.moveTargetCol ?? 0,
    moveRow: s.moveTargetRow ?? 0,
    tooltip: s.tooltipText ?? '',
  }));

  // alternating mode injection values
  const altCfg = config.scenario.alternating ?? { firstTurn: 'player', playerTurns: [], enemyTurns: [], attackReactions: [] };
```

- [ ] **Step 2: Emit the `GUIDED_STEPS` constant in the generated script**

Find (currently the line right after `const SCENARIO_MODE='${config.scenario.mode}';`, i.e. `const ALT_FIRST='${altCfg.firstTurn}';`):

```typescript
const SCENARIO_MODE='${config.scenario.mode}';
const ALT_FIRST='${altCfg.firstTurn}';
```

Replace with:

```typescript
const SCENARIO_MODE='${config.scenario.mode}';
const GUIDED_STEPS=${JSON.stringify(guidedStepsData)};
const ALT_FIRST='${altCfg.firstTurn}';
```

- [ ] **Step 3: Add `guidedIdx` to the runtime state object**

Find (currently in the `gs` initializer):

```typescript
  allPlayerPos:ALL_PLAYERS.map(p=>({col:p.col,row:p.row})),
  altPlayerTurnIdx:0};
```

Replace with:

```typescript
  allPlayerPos:ALL_PLAYERS.map(p=>({col:p.col,row:p.row})),
  altPlayerTurnIdx:0,guidedIdx:0};
```

- [ ] **Step 4: Give `activePlayerIdx()` a Guided branch, and add `guidedStep()`/`advanceGuided()`**

Find:

```typescript
function activePlayerIdx(){const id=PLT_IDS[gs.altPlayerTurnIdx%PLT_IDS.length];const i=ALL_PLAYERS.findIndex(p=>p.id===id);return i>=0?i:0;}
```

Replace with:

```typescript
function guidedStep(){return GUIDED_STEPS[gs.guidedIdx]||null;}
function advanceGuided(){gs.guidedIdx++;gs.state='player_turn';highlightMove();}
function activePlayerIdx(){
  if(SCENARIO_MODE==='guided'){
    const st=guidedStep();
    if(st){const i=ALL_PLAYERS.findIndex(p=>p.id===st.actorId);if(i>=0)return i;}
    return 0;
  }
  const id=PLT_IDS[gs.altPlayerTurnIdx%PLT_IDS.length];const i=ALL_PLAYERS.findIndex(p=>p.id===id);return i>=0?i:0;
}
```

(`guidedStep`/`advanceGuided` reference `highlightMove`/`GUIDED_STEPS`, which are defined elsewhere in the same script scope — safe because these are `function` declarations, hoisted, and this is all one `<script>` block, not separate modules.)

- [ ] **Step 5: Reset `guidedIdx` on game reset**

Find (currently in `resetGame()`):

```typescript
  gs.altPlayerTurnIdx=0;
```

Replace with:

```typescript
  gs.altPlayerTurnIdx=0;gs.guidedIdx=0;
```

- [ ] **Step 6: Give `checkWin()` a Guided branch**

Find:

```typescript
function checkWin(){
  if(!gs.enemyAlive.some(Boolean)){setTimeout(doWin,500);}
  else if(SCENARIO_MODE==='alternating'){setTimeout(runEnemyTurns,400);}
  else{gs.state='player_turn';highlightMove();}
}
```

Replace with:

```typescript
function checkWin(){
  if(!gs.enemyAlive.some(Boolean)){setTimeout(doWin,500);}
  else if(SCENARIO_MODE==='alternating'){setTimeout(runEnemyTurns,400);}
  else if(SCENARIO_MODE==='guided'){advanceGuided();}
  else{gs.state='player_turn';highlightMove();}
}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (Everything added here is inside a template-literal string, so `tsc` only checks the surrounding TypeScript, e.g. that `guidedStepsData` and `JSON.stringify(...)` type-check — it does not parse the injected JS. That's expected; behavioral verification of the injected JS happens in Task 6.)

- [ ] **Step 8: Verify the injected data statically**

Since there's no test runner, verify by inspection: temporarily add a one-off script to confirm `generateHTML` embeds the steps correctly, then delete it (do not commit it).

Create a scratch file `/tmp/verify-guided.mjs` is not usable here since the source is TypeScript with a bundler-only import graph — instead, verify via the running dev server (this is why Task 6 exists for full behavioral checks). For this task, it's sufficient to visually confirm in a code review pass that:
- `guidedStepsData` maps every field with a `?? ''`/`?? 0` fallback (no field can be `undefined` in the JSON output).
- `GUIDED_STEPS` appears once, right after `SCENARIO_MODE`.
- `gs.guidedIdx` initializes to `0` and is reset to `0` in `resetGame()`.

Confirm by reading the diff: `git diff src/utils/htmlGenerator.ts`.

- [ ] **Step 9: Commit**

```bash
git add src/utils/htmlGenerator.ts
git commit -m "Inject guided step list and wire active-player/checkWin for guided mode"
```

---

### Task 4: Guided presentation layer (tooltip, highlighting, spell lock, nudge)

**Files:**
- Modify: `src/utils/htmlGenerator.ts`

**Interfaces:**
- Consumes: `guidedStep()`, `gs.guidedIdx`, `GUIDED_STEPS`, `SCENARIO_MODE` from Task 3; existing `hexEls`, `hideAllAttackIcons()`, `atkIconEls`, `showSpeech()`/`hideSpeech()`, `speechBub`, `ATTACK_ICON_MELEE/RANGED/FLYING`, `hexCenter()`.
- Produces (used by Task 5): `highlightGuidedStep()`, `showGuidedTooltip()`, `updateGuidedSpellLock()`, `nudgeTooltip()` — Task 5's click handlers call `nudgeTooltip()` on invalid clicks, and `updateGuidedSpellLock()` is also called from `openSpellbook()` (edited in this task).

- [ ] **Step 1: Generate the per-spell lock-toggle snippet alongside the other `spSP_*` snippets**

Find (currently right after `spSP_resetAll`):

```typescript
  const spSP_resetAll = config.spells.map((_, i) =>
    `if(spSP${i})spSP${i}.classList.remove('used','selected');`).join('');
```

Replace with (adds `'guided-locked'` to the reset, and adds the new lock-toggle generator):

```typescript
  const spSP_resetAll = config.spells.map((_, i) =>
    `if(spSP${i})spSP${i}.classList.remove('used','selected','guided-locked');`).join('');
  const spSP_guidedLock = config.spells.map((_, i) =>
    `if(spSP${i})spSP${i}.classList.toggle('guided-locked',!(st&&st.action==='cast_spell'&&st.spellId==='spell${i}'));`).join('');
```

- [ ] **Step 2: Add the guided-lock and nudge CSS**

Find (currently the `.spell-btn.used` rule):

```css
.spell-btn.used{opacity:.35;pointer-events:none;}
```

Insert immediately after it:

```css
.spell-btn.guided-locked{opacity:.3;pointer-events:none;filter:grayscale(1);}
```

Find (currently the `#speech-bubble::before` rule, right after the speech-bubble block):

```css
#speech-bubble::before{content:'';position:absolute;left:-12px;top:18px;border:7px solid transparent;border-right-color:rgba(255,255,255,.95);}
```

Insert immediately after it:

```css
@keyframes bubbleNudge{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
#speech-bubble.nudge{animation:bubbleNudge .3s ease;}
```

- [ ] **Step 3: Give `highlightMove()` a Guided branch that delegates to the new step-highlighter**

Find:

```typescript
function highlightMove(){
  clearHex();
  const pi=activePlayerIdx();const ap=gs.allPlayerPos[pi];const mr=ALL_PLAYERS[pi].moveRange;
  const k=hexEls[ap.col+','+ap.row];if(k)k.classList.add('selected');
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
    if(!hexEls[c+','+r])continue;if(c===ap.col&&r===ap.row)continue;
    const eIdx=findEnemyAt(c,r);
    if(eIdx>=0){hexEls[c+','+r].classList.add('enemy-hex');continue;}
    if(hexDist(ap.col,ap.row,c,r)<=mr)hexEls[c+','+r].classList.add('reachable');
  }
  updateActiveIndicator();
  if(pi!==lastHoppedIdx){lastHoppedIdx=pi;hopPlayer(pi);}
  showAllAttackIcons();
}
```

Replace with:

```typescript
function highlightMove(){
  clearHex();
  const pi=activePlayerIdx();const ap=gs.allPlayerPos[pi];const mr=ALL_PLAYERS[pi].moveRange;
  const k=hexEls[ap.col+','+ap.row];if(k)k.classList.add('selected');
  if(SCENARIO_MODE==='guided'){highlightGuidedStep();return;}
  for(let c=0;c<COLS;c++)for(let r=0;r<ROWS;r++){
    if(!hexEls[c+','+r])continue;if(c===ap.col&&r===ap.row)continue;
    const eIdx=findEnemyAt(c,r);
    if(eIdx>=0){hexEls[c+','+r].classList.add('enemy-hex');continue;}
    if(hexDist(ap.col,ap.row,c,r)<=mr)hexEls[c+','+r].classList.add('reachable');
  }
  updateActiveIndicator();
  if(pi!==lastHoppedIdx){lastHoppedIdx=pi;hopPlayer(pi);}
  showAllAttackIcons();
}
function highlightGuidedStep(){
  hideAllAttackIcons();
  const st=guidedStep();
  showGuidedTooltip();
  if(!st)return;
  if(st.action==='move'){
    const h=hexEls[st.moveCol+','+st.moveRow];if(h)h.classList.add('reachable');
    return;
  }
  const eIdx=ENEMIES.findIndex(e=>e.id===st.targetId);
  if(eIdx<0||!gs.enemyAlive[eIdx])return;
  const e=ENEMIES[eIdx];
  const h=hexEls[e.col+','+e.row];if(h)h.classList.add('targetable');
  if(st.action==='cast_spell'){updateGuidedSpellLock();return;}
  const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];
  const src=ap.type==='ranged'?ATTACK_ICON_RANGED:ap.type==='flying'?ATTACK_ICON_FLYING:ATTACK_ICON_MELEE;
  const el=atkIconEls[eIdx];
  if(el&&src){const img=el.querySelector('img');if(img)img.src=src;const{x,y}=hexCenter(e.col,e.row);el.style.left=(x-24)+'px';el.style.top=(y-90)+'px';el.style.display='block';}
}
function showGuidedTooltip(){const st=guidedStep();if(!st||!st.tooltip){hideSpeech();return;}showSpeech(st.tooltip,0);}
function updateGuidedSpellLock(){const st=guidedStep();${spSP_guidedLock}}
function nudgeTooltip(){if(!speechBub)return;speechBub.classList.remove('nudge');requestAnimationFrame(()=>requestAnimationFrame(()=>{speechBub.classList.add('nudge');setTimeout(()=>speechBub.classList.remove('nudge'),320);}));}
```

- [ ] **Step 4: Give `highlightTargets()` a Guided branch (only the correct target lights up after spell selection)**

Find:

```typescript
function highlightTargets(){clearHex();hideAllAttackIcons();ENEMIES.forEach((e,i)=>{if(gs.enemyAlive[i]){const h=hexEls[e.col+','+e.row];if(h)h.classList.add('targetable');}});}
```

Replace with:

```typescript
function highlightTargets(){
  clearHex();hideAllAttackIcons();
  if(SCENARIO_MODE==='guided'){
    const st=guidedStep();
    if(st){const eIdx=ENEMIES.findIndex(e=>e.id===st.targetId);if(eIdx>=0&&gs.enemyAlive[eIdx]){const h=hexEls[ENEMIES[eIdx].col+','+ENEMIES[eIdx].row];if(h)h.classList.add('targetable');}}
    return;
  }
  ENEMIES.forEach((e,i)=>{if(gs.enemyAlive[i]){const h=hexEls[e.col+','+e.row];if(h)h.classList.add('targetable');}});
}
```

- [ ] **Step 5: Lock spell buttons as soon as the spellbook opens in Guided mode**

Find:

```typescript
function openSpellbook(){if(!SPELLBOOK_ENABLED)return;startMusic();gs.sbOpen=true;gs.state='spell_select';if(sbIcon&&IMG_SB_OPEN)sbIcon.src=IMG_SB_OPEN;sbPanel.style.display='flex';clearHex();playSound(SFX.sb_open);}
```

Replace with:

```typescript
function openSpellbook(){if(!SPELLBOOK_ENABLED)return;startMusic();gs.sbOpen=true;gs.state='spell_select';if(sbIcon&&IMG_SB_OPEN)sbIcon.src=IMG_SB_OPEN;sbPanel.style.display='flex';clearHex();if(SCENARIO_MODE==='guided')updateGuidedSpellLock();playSound(SFX.sb_open);}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/htmlGenerator.ts
git commit -m "Add guided-mode tooltip, single-target highlighting, and spell lock"
```

---

### Task 5: Guided input gating and combat execution

**Files:**
- Modify: `src/utils/htmlGenerator.ts`

**Interfaces:**
- Consumes: everything from Tasks 3–4 (`guidedStep()`, `advanceGuided()`, `nudgeTooltip()`, `updateGuidedSpellLock()`), plus existing `findEnemyAt`, `findAttackHex`, `movePlayerTo`, `playerSwingAttack`, `animateSpell`, `killEnemy`, `doRetaliation`, `showOutOfReach`.
- Produces: `applyDamageToEnemyGuided(eIdx, dmg, cb)` — the Guided-specific damage-and-kill handler that routes kills through Post-Kill Retaliation. `playerAttackAlt` and `playerFlyAttack` gain an optional trailing `applyFn` parameter (default `applyDamageToEnemy`, so Alternating mode is unaffected). This is the last runtime task — after this, the full Guided flow is playable end to end (verified in Task 6).

- [ ] **Step 1: Add the Guided-specific damage/kill handler next to `applyDamageToEnemy`**

Find:

```typescript
function applyDamageToEnemy(eIdx,dmg,cb){
  const e=ENEMIES[eIdx];const{x,y}=hexCenter(e.col,e.row);
  setEnemyHP(eIdx,gs.enemyHP[eIdx]-dmg);
  floatText('-'+dmg,x,y-30,'damage');
  flashBadge(enemyEls[eIdx]);
  if(gs.enemyHP[eIdx]<=0){
    killEnemy(eIdx,()=>{
      // check if reaction on kill (no - reactions are for surviving enemies only)
      checkWin();
    });
  } else {
```

Insert a new function immediately *before* this one (do not modify `applyDamageToEnemy` itself):

```typescript
function applyDamageToEnemyGuided(eIdx,dmg,cb){
  const e=ENEMIES[eIdx];const{x,y}=hexCenter(e.col,e.row);
  setEnemyHP(eIdx,gs.enemyHP[eIdx]-dmg);
  floatText('-'+dmg,x,y-30,'damage');
  flashBadge(enemyEls[eIdx]);
  if(gs.enemyHP[eIdx]<=0){
    killEnemy(eIdx,()=>{doRetaliation(e.id,()=>{if(cb)cb();});});
  } else {
    shakeUnit(enemyEls[eIdx],()=>{if(cb)cb();});
  }
}
function applyDamageToEnemy(eIdx,dmg,cb){
  const e=ENEMIES[eIdx];const{x,y}=hexCenter(e.col,e.row);
  setEnemyHP(eIdx,gs.enemyHP[eIdx]-dmg);
  floatText('-'+dmg,x,y-30,'damage');
  flashBadge(enemyEls[eIdx]);
  if(gs.enemyHP[eIdx]<=0){
    killEnemy(eIdx,()=>{
      // check if reaction on kill (no - reactions are for surviving enemies only)
      checkWin();
    });
  } else {
```

(The rest of `applyDamageToEnemy` after this point is unchanged — only the new function is inserted above it.)

- [ ] **Step 2: Thread an optional `applyFn` through `playerAttackAlt` and `playerFlyAttack`**

Find:

```typescript
function playerFlyAttack(eIdx,dmg,cb){
  const pi=activePlayerIdx();const pEl=playerEls[pi];const ap=ALL_PLAYERS[pi];
  const e=ENEMIES[eIdx];
  const orig=gs.allPlayerPos[pi];
  const [dc,dr]=nearestAdjacentTo(e.col,e.row,orig.col,orig.row);
  const dst=hexCenter(dc,dr);
  gs.allPlayerPos[pi]={col:dc,row:dr};gs.pCol=dc;gs.pRow=dr;
  const img=pEl&&pEl.querySelector('img');
  if(img&&ap.atkImg){img.src=ap.atkImg;img.width=ap.aw;}
  playSound(SFX.player_fly_atk||SFX.player_atk);
  if(pEl){pEl.style.transition='left .28s ease-in,top .28s ease-in';pEl.style.left=dst.x+'px';pEl.style.top=dst.y+'px';}
  setTimeout(()=>{
    if(pEl)pEl.style.transition='';
    if(img&&ap.idleImg){img.src=ap.idleImg;img.width=ap.w;}
    applyDamageToEnemy(eIdx,dmg,cb);
  },300);
}
```

Replace with:

```typescript
function playerFlyAttack(eIdx,dmg,cb,applyFn){
  applyFn=applyFn||applyDamageToEnemy;
  const pi=activePlayerIdx();const pEl=playerEls[pi];const ap=ALL_PLAYERS[pi];
  const e=ENEMIES[eIdx];
  const orig=gs.allPlayerPos[pi];
  const [dc,dr]=nearestAdjacentTo(e.col,e.row,orig.col,orig.row);
  const dst=hexCenter(dc,dr);
  gs.allPlayerPos[pi]={col:dc,row:dr};gs.pCol=dc;gs.pRow=dr;
  const img=pEl&&pEl.querySelector('img');
  if(img&&ap.atkImg){img.src=ap.atkImg;img.width=ap.aw;}
  playSound(SFX.player_fly_atk||SFX.player_atk);
  if(pEl){pEl.style.transition='left .28s ease-in,top .28s ease-in';pEl.style.left=dst.x+'px';pEl.style.top=dst.y+'px';}
  setTimeout(()=>{
    if(pEl)pEl.style.transition='';
    if(img&&ap.idleImg){img.src=ap.idleImg;img.width=ap.w;}
    applyFn(eIdx,dmg,cb);
  },300);
}
```

Find:

```typescript
function playerAttackAlt(eIdx,cb){
  const e=ENEMIES[eIdx];
  const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];
  const dmg=calcDamage(ap.baseDmg,ap.dmgMult,e.defense||0);
  const{x,y}=hexCenter(e.col,e.row);
  hideAllAttackIcons();
  if(ap.type==='ranged'){
    const apos=gs.allPlayerPos[pi];const from=hexCenter(apos.col,apos.row);
    const img=playerEls[pi]&&playerEls[pi].querySelector('img');
    if(img&&ap.atkImg){img.src=ap.atkImg;img.width=ap.aw;}
    playSound(SFX.player_ranged_atk||SFX.player_atk);
    animateSpell(-1,from.x,from.y-30,x,y-30,()=>{
      if(img&&ap.idleImg){img.src=ap.idleImg;img.width=ap.w;}
      applyDamageToEnemy(eIdx,dmg,cb);
    });
  } else if(ap.type==='flying'){
    playerFlyAttack(eIdx,dmg,cb);
  } else {
    playerSwingAttack(()=>{applyDamageToEnemy(eIdx,dmg,cb);});
  }
}
```

Replace with:

```typescript
function playerAttackAlt(eIdx,cb,applyFn){
  applyFn=applyFn||applyDamageToEnemy;
  const e=ENEMIES[eIdx];
  const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];
  const dmg=calcDamage(ap.baseDmg,ap.dmgMult,e.defense||0);
  const{x,y}=hexCenter(e.col,e.row);
  hideAllAttackIcons();
  if(ap.type==='ranged'){
    const apos=gs.allPlayerPos[pi];const from=hexCenter(apos.col,apos.row);
    const img=playerEls[pi]&&playerEls[pi].querySelector('img');
    if(img&&ap.atkImg){img.src=ap.atkImg;img.width=ap.aw;}
    playSound(SFX.player_ranged_atk||SFX.player_atk);
    animateSpell(-1,from.x,from.y-30,x,y-30,()=>{
      if(img&&ap.idleImg){img.src=ap.idleImg;img.width=ap.w;}
      applyFn(eIdx,dmg,cb);
    });
  } else if(ap.type==='flying'){
    playerFlyAttack(eIdx,dmg,cb,applyFn);
  } else {
    playerSwingAttack(()=>{applyFn(eIdx,dmg,cb);});
  }
}
```

- [ ] **Step 3: Make `castSpell()`'s origin position generic (works for any active player, not just legacy globals)**

Find:

```typescript
  closeSpellbookSilent();gs.state='animating';clearHex();
  const from=hexCenter(gs.pCol,gs.pRow),to=hexCenter(e.col,e.row);
```

Replace with:

```typescript
  closeSpellbookSilent();gs.state='animating';clearHex();
  const pi=activePlayerIdx();const apos=gs.allPlayerPos[pi];
  const from=hexCenter(apos.col,apos.row),to=hexCenter(e.col,e.row);
```

(This is a no-op behavior change for Puzzle mode, where `activePlayerIdx()` always returns `0` and `gs.allPlayerPos[0]` already mirrors `gs.pCol`/`gs.pRow` — confirms in Task 6.)

- [ ] **Step 4: Guard `selectSpell()` so only the current step's spell can be picked in Guided mode**

Find:

```typescript
function selectSpell(id){const idx=parseInt(id.replace('spell',''));if(gs.spellUsed[id])return;gs.selSpell=id;${spSP_toggleSel}gs.state='spell_target';highlightTargets();playSound(SFX.sb_spell);}
```

Replace with:

```typescript
function selectSpell(id){
  const idx=parseInt(id.replace('spell',''));if(gs.spellUsed[id])return;
  if(SCENARIO_MODE==='guided'){const st=guidedStep();if(!st||st.action!=='cast_spell'||id!==st.spellId){nudgeTooltip();return;}}
  gs.selSpell=id;${spSP_toggleSel}gs.state='spell_target';highlightTargets();playSound(SFX.sb_spell);
}
```

- [ ] **Step 5: Add the Guided branch to `onHexClick()`**

Find the top of `onHexClick`:

```typescript
function onHexClick(){
  startMusic();
  const col=parseInt(this.dataset.col),row=parseInt(this.dataset.row);
  if(gs.state==='spell_target'){castSpell(col,row);return;}
  if(gs.state==='intro'){skipIntro();return;}
  if(gs.state!=='player_turn')return;
  const eIdx=findEnemyAt(col,row);

  if(SCENARIO_MODE==='alternating'){
```

Replace with:

```typescript
function onHexClick(){
  startMusic();
  const col=parseInt(this.dataset.col),row=parseInt(this.dataset.row);
  if(gs.state==='spell_target'){
    if(SCENARIO_MODE==='guided'){
      const st=guidedStep();
      if(st&&st.action==='cast_spell'&&gs.selSpell===st.spellId){
        const eIdxSpell=findEnemyAt(col,row);
        if(eIdxSpell>=0&&ENEMIES[eIdxSpell].id===st.targetId){castSpell(col,row);return;}
      }
      nudgeTooltip();return;
    }
    castSpell(col,row);return;
  }
  if(gs.state==='intro'){skipIntro();return;}
  if(gs.state!=='player_turn')return;
  const eIdx=findEnemyAt(col,row);

  if(SCENARIO_MODE==='guided'){
    const st=guidedStep();
    if(!st)return;
    if(st.action==='move'){
      if(col===st.moveCol&&row===st.moveRow&&!occupied(col,row)){
        gs.state='animating';clearHex();hideSpeech();hideAllAttackIcons();playSound(SFX.grid,.7);
        movePlayerTo(col,row,()=>{advanceGuided();});
      } else nudgeTooltip();
      return;
    }
    if(st.action==='cast_spell'){nudgeTooltip();return;}
    if(eIdx<0||ENEMIES[eIdx].id!==st.targetId){nudgeTooltip();return;}
    const e=ENEMIES[eIdx];
    gs.state='animating';clearHex();hideSpeech();hideAllAttackIcons();
    const pi=activePlayerIdx();const ap=ALL_PLAYERS[pi];
    if(ap.type==='melee'){
      const apos=gs.allPlayerPos[pi];
      const adjHex=findAttackHex(e.col,e.row,apos.col,apos.row,ap.moveRange);
      if(!adjHex){showOutOfReach();gs.state='player_turn';highlightMove();return;}
      const[dc,dr]=adjHex;
      movePlayerTo(dc,dr,()=>{playerAttackAlt(eIdx,()=>{checkWin();},applyDamageToEnemyGuided);});
    } else {
      playerAttackAlt(eIdx,()=>{checkWin();},applyDamageToEnemyGuided);
    }
    return;
  }

  if(SCENARIO_MODE==='alternating'){
```

(Everything from `if(SCENARIO_MODE==='alternating'){` to the end of `onHexClick` is unchanged.)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/htmlGenerator.ts
git commit -m "Wire guided-mode input gating: only the scripted action can be clicked"
```

---

### Task 6: End-to-end manual verification

**Files:** none (verification only — fix forward in the relevant task's file if something's broken, then re-run this task).

**Interfaces:** none — this task exercises the full feature built in Tasks 1–5 through the real UI.

- [ ] **Step 1: Start the app**

Run: `npm run dev`, open the printed local URL.

- [ ] **Step 2: Configure a Guided scenario**

- In the Scenario panel, set Battle Mode to Guided.
- Confirm the default two steps (Cast Fireball on Valkyrie, Melee Attack on Armored Giant, from Task 1) show with their tooltip text pre-filled.
- Add a third step at the top of the sequence (or reorder by editing): set it to action `Move`, actor = the default player unit, col/row = any unoccupied reachable hex, tooltip = "Reposition before engaging." (This exercises the move-step path, which the default scenario doesn't otherwise cover.)

- [ ] **Step 3: Verify the move step in Live Preview**

Open the Live Preview panel. Confirm:
- On game start, the speech bubble is visible showing the move step's tooltip, persisting (not disappearing after a few seconds).
- Only one hex on the board is highlighted (`reachable`); no enemy is highlighted or has an attack icon.
- Clicking any other hex does nothing except a brief shake of the tooltip bubble.
- Clicking the correct hex moves the player there, the tooltip updates to the next step's text, and the highlight moves to reflect the new step.

- [ ] **Step 4: Verify the cast_spell step**

Confirm:
- Only the Valkyrie's hex is highlighted `targetable`; the Armored Giant is not.
- Opening the spellbook shows only the Fireball button enabled — Ice Shard is dimmed and unclickable (confirm clicking it does nothing but nudge the tooltip).
- Selecting Fireball and clicking anywhere except the Valkyrie's hex does nothing but nudge.
- Selecting Fireball and clicking the Valkyrie kills it, triggers the Armored Giant's retaliation (per the default `retaliations` config — confirm the retaliation speech and player HP loss both occur), and then advances to the melee step.

- [ ] **Step 5: Verify the melee_attack step and win**

Confirm:
- Only the Armored Giant is highlighted/targetable; clicking empty hexes or (if any other enemy existed) other enemies does nothing but nudge.
- Clicking the Armored Giant makes the player auto-walk adjacent and swing, killing it.
- The win screen appears immediately (all enemies dead), without needing to "reach the end" of the step list explicitly.

- [ ] **Step 6: Verify Puzzle and Alternating modes are unaffected**

Switch Battle Mode back to Puzzle, confirm Live Preview still plays through exactly as before this change (same win/fail behavior). Switch to Alternating, confirm turn order and enemy attacks still work as before. (This is the regression check for the `applyFn` parameter threading and the `activePlayerIdx()`/`castSpell()` changes in Tasks 3 and 5.)

- [ ] **Step 7: Final type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Fix-forward if anything failed**

If any check in Steps 3–6 failed, identify which Task (3, 4, or 5) owns the broken function, fix it there, re-run `npx tsc --noEmit`, re-verify in the browser, and commit the fix with a message describing what was wrong (e.g. `git commit -m "Fix guided move-step highlight not clearing previous target"`).

- [ ] **Step 9: Update the design doc's status (optional but recommended)**

Add a one-line note at the top of `docs/superpowers/specs/2026-07-30-guided-mode-design.md`: `**Status:** Implemented.` Commit:

```bash
git add docs/superpowers/specs/2026-07-30-guided-mode-design.md
git commit -m "Mark guided mode design as implemented"
```
