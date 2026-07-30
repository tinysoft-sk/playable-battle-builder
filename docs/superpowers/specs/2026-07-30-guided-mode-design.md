# Guided Mode — Design

**Status:** Implemented.

## Purpose

Add a third battle mode, **Guided**, alongside the existing **Puzzle** and
**Alternating** modes. In Guided mode the player is walked through the exact
winning sequence of actions (move / attack / cast spell) one step at a time.
Before each click, a tooltip bubble explains *what* to do and *why*. Only the
one correct action is available each step — there is no way to click wrong
and trigger a failure state.

## Background

- **Puzzle mode** already has a `scenario.winningSequence` (`WinStep[]`) list
  in the editor, describing the "correct" ordered actions (actor → action →
  target). It turns out this list is **not** actually consumed by the
  generated HTML today — Puzzle's fail/success behavior is driven by
  hardcoded heuristics in `htmlGenerator.ts` (kill flying before ranged,
  correct spell element, etc.), and `winningSequence` exists purely as
  documentation for the designer. Guided mode is the first thing to actually
  execute this list.
- The speech bubble (`#speech-bubble`) already exists and is reused across
  modes for narrative/hint text (retaliation lines, "out of reach", etc.).
  Guided mode reuses this same element for the step tooltip.
- Puzzle mode has a separate `scenario.retaliations` (Post-Kill Retaliation)
  system: killing a specific enemy triggers a scripted counter-attack from
  another surviving enemy. Alternating mode has its own, different,
  per-hit `attackReactions` system. Guided mode reuses the Puzzle-style
  Post-Kill Retaliation system, not the Alternating one.

## Data model changes (`src/types/battle.ts`)

- `BattleScenario.mode`: add `'guided'` to the union
  (`'puzzle' | 'alternating' | 'guided'`).
- `WinStep`:
  - `action` gains a 4th option: `'move'` (alongside `cast_spell`,
    `melee_attack`, `ranged_attack`).
  - New optional fields `moveTargetCol?: number` / `moveTargetRow?: number`,
    used only when `action === 'move'`.
  - New field `tooltipText?: string` — designer-authored text shown in the
    speech bubble while this step is active. Optional at the type level (for
    backward compatibility with saved configs from before this change), read
    with a `?? ''` fallback at generation time, matching the existing
    codebase convention for schema growth (e.g. `hintLayout`, `gridOffset`).
- No changes to `scenario.retaliations` — reused as-is.

## Editor UI changes (`src/components/panels/ScenarioPanel.tsx`)

- "Battle Mode" `<select>` gets a third `<option value="guided">`.
- "Winning Sequence" and "Post-Kill Retaliations" sections currently render
  only `scenario.mode === 'puzzle'`; change the condition to
  `mode === 'puzzle' || mode === 'guided'` so Guided's script and
  retaliations are editable in the same UI.
- "Fail Conditions" section stays gated to `mode === 'puzzle'` only — Guided
  has no fail state, so fail-condition hints are meaningless there.
- Each step card in "Winning Sequence":
  - Action `<select>` gains a `Move` option.
  - When `action === 'move'`, hide the target-enemy select and show
    `col`/`row` number inputs instead (mirroring the existing pattern used
    for the Alternating mode's "move" enemy-turn type).
  - Add a new "Tooltip (what & why)" text field to every step, regardless of
    action type.

## Runtime logic changes (`src/utils/htmlGenerator.ts`)

### Injected data

- `GUIDED_STEPS`: array built from `config.scenario.winningSequence`, one
  entry per step: `{ actorId, action, spellId, targetId, moveCol, moveRow,
  tooltip }`.

### State

- `gs.guidedIdx` (starts at 0, resets to 0 in `resetGame()`): pointer into
  `GUIDED_STEPS` for the step currently being presented.

### Active player resolution

- `activePlayerIdx()` gets a Guided branch: when `SCENARIO_MODE==='guided'`,
  resolve the active unit from the *current step's* `actorId` (looked up in
  `ALL_PLAYERS`) instead of the Alternating turn-cycle (`PLT_IDS`).

### Step presentation

- `highlightMove()` gets a Guided branch that calls a new
  `highlightGuidedStep()` instead of the normal full-board
  range/attack-icon display:
  - `move` step → only the destination hex (`moveCol`/`moveRow`) gets the
    `reachable` highlight class; no enemies are targetable.
  - `melee_attack` / `ranged_attack` step → only the target enemy's hex gets
    `targetable`, and only its attack icon is shown (type-appropriate icon
    based on the actor's unit type). All other enemies show no icon.
  - `cast_spell` step → only the target enemy's hex gets `targetable`. A new
    `updateGuidedSpellLock()` toggles a `.guided-locked` CSS class (dimmed,
    `pointer-events:none`) on every spell button except the one matching
    `step.spellId`.
  - In all cases, the speech bubble shows `step.tooltip` with no auto-hide
    (persists until the step completes or advances).

### Input gating

- `onHexClick()` gets a Guided branch (parallel to the existing Alternating
  branch), placed before the Puzzle fallback logic:
  - `spell_target` state: only proceeds to `castSpell()` if the selected
    spell matches `step.spellId` **and** the clicked hex is the step's
    target enemy. Otherwise, no-op + nudge.
  - `move` step: only proceeds if the clicked hex matches
    `(moveCol, moveRow)` and is unoccupied. Otherwise, no-op + nudge.
  - `melee_attack` / `ranged_attack` step: only proceeds if the clicked hex
    contains the step's target enemy. Otherwise, no-op + nudge. Melee actors
    auto-walk to an adjacent hex first (reusing `findAttackHex` +
    `movePlayerTo`, same as Puzzle/Alternating today) before swinging.
- `selectSpell()` gets a guard: in Guided mode, selecting any spell other
  than the current step's `spellId` is a no-op + nudge instead of opening
  target-selection.
- "Nudge" is a new small helper (`nudgeTooltip()`) that re-triggers a brief
  CSS shake on the speech bubble, giving feedback on a wrong click without
  any fail/damage/state change.

### Combat execution & retaliation

- Guided combat reuses the existing `playerAttackAlt()` (handles
  ranged/flying/melee animation + damage math) and `movePlayerTo()`
  functions used by Alternating mode, **not** the Puzzle one-shot-kill
  assumption — this lets a Guided step deal real calculated damage and
  supports multi-hit kills across steps if a designer wants that.
- `playerAttackAlt()` and `playerFlyAttack()` each gain an optional trailing
  `applyFn` parameter (defaulting to the existing `applyDamageToEnemy`, so
  Alternating mode's behavior is unchanged). Guided mode passes a new
  `applyDamageToEnemyGuided()` instead, which is identical except that on
  a kill it calls the Puzzle-style `doRetaliation(e.id, cb)` (Post-Kill
  Retaliation) rather than doing nothing further — matching your choice to
  reuse Post-Kill Retaliation, not the Alternating per-hit reaction system.
- `castSpell()` is reused unmodified for Guided's `cast_spell` steps (it
  already calls `doRetaliation` on kill). It's made actor-position-generic
  (reads from `gs.allPlayerPos[activePlayerIdx()]` instead of the legacy
  `gs.pCol`/`gs.pRow` globals) so it works correctly when the active unit
  isn't player index 0 — a safe no-op change for Puzzle mode, where the
  active index is always 0 anyway.
- `checkWin()` gets a Guided branch: if enemies remain, call a new
  `advanceGuided()` (`gs.guidedIdx++; gs.state='player_turn';
  highlightMove();`) instead of the Puzzle/Alternating branches. The `move`
  step handler calls `advanceGuided()` directly (no combat, so no
  `checkWin()` involved).

### Known caveat (accepted, not solved by this design)

Because Guided reuses Post-Kill Retaliation as-is, a designer who
configures cumulative retaliation damage exceeding the player's HP across
the sequence can still cause a player death → the existing fail screen.
This mirrors a pre-existing exposure in Puzzle mode today (its "correct"
path can also drain HP to 0 via the same retaliation config). Guided mode's
guarantee is specifically "can't fail by clicking the wrong thing," not
"can never lose HP" — no new fail-avoidance mechanism is added here.

Similarly, a Guided script whose steps reference an already-dead target, or
that runs out before all enemies are defeated, is a designer-authoring
error the runtime does not self-heal from (the board simply stops
responding to that step). This mirrors the same pre-existing precedent as
Puzzle mode's `winningSequence`, which likewise assumes a coherent,
game-state-consistent script — no new recovery mechanism was added for
Guided's step list either. A future iteration could add auto-advance past
a dead target or a free-play fallback when steps run out, but that was
explicitly deferred as out of scope for this design.

### Alternating mode behavior correction (discovered during implementation)

`doRetaliation()` — the Puzzle-style Post-Kill Retaliation function this
design reuses for Guided — turned out to have a latent bug: its callback
parameter was only invoked on its early-return paths, never after a live
retaliation actually resolved. Making Guided mode work correctly required
fixing this (otherwise Guided's step pointer would never advance after a
retaliating kill). Because `doRetaliation()` is shared code, reachable from
Alternating mode too (the spellbook is available regardless of scenario
mode), this fix also corrects an existing Alternating-mode bug: previously,
an enemy turn immediately following a Post-Kill-Retaliation-triggering kill
was silently skipped; now it correctly resumes. This was an explicit,
considered decision (not an accidental side effect) — the alternative was
scoping the callback fix away from Alternating and leaving that skip-bug in
place, which was rejected in favor of correctness. The default scenario's
Alternating `enemyTurns` damage for `armored_giant` (`et2`) was reduced from
40 to 10 to keep the default scenario winnable under the corrected behavior
(85 retaliation damage + 10 enemy-turn damage stays under the player's 100
HP, versus 85 + 40 which would not have).

## Out of scope

- No changes to Puzzle mode's own heuristic fail-condition engine.
- Alternating mode's turn-order/attack logic is otherwise unchanged; the
  one behavior correction it did receive is documented above, not a design
  goal of this work.
- The two stray untracked files `src/types/battleStore.ts` and
  `src/types/htmlGenerator.ts` (older, unused duplicates of
  `src/store/battleStore.ts` / `src/utils/htmlGenerator.ts`, confirmed
  unreferenced by any import) are left untouched — unrelated to this work.
