# UX Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Critical and Important findings from the Battle Editor Audit (a Web Interface Guidelines compliance review plus a UX/design critique of `playable-battle-builder`'s editor, published as an Artifact earlier this session) — without changing any existing behavior.

**Architecture:** Every fix here is additive (new attributes, new CSS rules, new event handlers) or a same-visual-output substitution (an `alt=""` becomes a real `alt`, a dead `<label>` becomes a `<div>` with the same CSS class applied via an extended selector). No data flow, no state shape, no store action signature changes. The riskiest single change (`UnitsPanel`'s accordion header becoming keyboard-operable) is isolated to one file and does not touch how any other panel works.

**Tech Stack:** React 18, TypeScript, Vite — same as the rest of the app. No new dependencies.

## Global Constraints

- **No visual regressions.** Every fix must look identical at rest to how it looks today — this is an accessibility/interaction pass, not a redesign. Where a fix changes an element's *tag* (e.g. `<label>` → `<div>`), the CSS selector must be extended so the new element keeps the exact same computed style.
- **No behavior changes to existing working flows.** Save/load/delete templates, upload/pick/remove assets, undo/redo, export — all must work exactly as before after every task.
- Out of scope for this plan (explicitly deferred, do not attempt): typography polish (curly quotes, tabular-nums), Title Case consistency, virtualizing the library grid, replacing `alert()`/`confirm()` with custom dialogs, any palette/typography/icon redesign. These are the Minor findings and the Part Two visual-identity critique from the audit — a separate, larger effort.
- Every task ends with `npx tsc --noEmit` passing and the existing test suite (`npm test -- --run`) still green. Neither currently covers UI components directly (no component test harness in this codebase) — that's expected, not a gap to fix here.

---

### Task 1: CSS foundation — focus states, hover states, modal scroll, dark color-scheme

**Files:**
- Modify: `src/App.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: a `.field-label` CSS class (styled identically to `.field label`) that Tasks 7 and 8 rely on when converting dead `<label>` wrappers to `<div>`s.

- [ ] **Step 1: Add visible focus states**

In `src/App.css`, add this block right after the `:root { ... }` block (after line 10):

```css
button:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
a:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid #4af;
  outline-offset: 2px;
}
.field:focus-within label,
.field:focus-within .field-label {
  color: var(--text);
}
```

- [ ] **Step 2: Add hover states to buttons that currently have none**

In `src/App.css`, find `.header-actions button:disabled { opacity: 0.35; cursor: default; }` (currently line 60) and add directly after it:

```css
.header-actions button:not(:disabled):hover { background: #123456; border-color: #4af; }
```

Find `.preview-toolbar button { ... }` (currently lines 360-368) and add directly after its closing `}`:

```css
.preview-toolbar button:hover { border-color: #4af; }
```

Find `.btn-primary { ... }` and `.btn-secondary { ... }` (currently lines 315-333) and add directly after `.btn-secondary`'s closing `}`:

```css
.btn-primary:hover { background: #d63850; }
.btn-secondary:hover { border-color: #4af; }
```

- [ ] **Step 3: Contain scroll inside dialogs**

In `src/App.css`, find the `.dialog { ... }` rule (currently lines 304-312) and add one line inside it:

```css
overscroll-behavior: contain;
```

- [ ] **Step 4: Add the `.field-label` class for dead-label replacement**

In `src/App.css`, find `.field label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }` (currently line 120) and change the selector to also match the new class:

```css
.field label,
.field .field-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

- [ ] **Step 5: Set `color-scheme: dark`**

In `src/index.css`, add this line inside the existing `body { margin: 0; }` rule (making it `body { margin: 0; color-scheme: dark; }`), OR add a new rule — either is fine, but it must apply to `<html>`/`<body>` so native scrollbars/selects pick it up:

```css
html { color-scheme: dark; }
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` (should be unaffected, but confirms nothing else broke) and `npm test -- --run`.
Expected: both green (CSS-only change, no test coverage exists for it — this is a visual check, not a test-driven one).

Then start the dev server (`npm run dev`), open the editor, and confirm by eye: Tab through the header buttons and see a visible focus ring; hover over Save/Cancel/Export/Undo buttons and see a visible hover state; open any dialog (Templates, Export, or a Library picker) and confirm it still looks identical to before. Native `<select>` dropdowns should now render with dark chrome instead of light chrome.

- [ ] **Step 7: Commit**

```bash
git add src/App.css src/index.css
git commit -m "css: add focus-visible rings, hover states, dialog overscroll containment, dark color-scheme"
```

---

### Task 2: `App.tsx` — label the project-name field, warn before losing unsaved work

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `undoStack` from `useBattleStore()` (already destructured in this file) as the "has the user made at least one edit this session" signal — no new store state needed.
- Produces: nothing new for other tasks to consume.

- [ ] **Step 1: Label the project-name input**

In `src/App.tsx`, change:

```tsx
        <input
          className="project-name"
          value={config.name}
          onChange={e => setName(e.target.value)}
        />
```

to:

```tsx
        <input
          className="project-name"
          aria-label="Project name"
          autoComplete="off"
          value={config.name}
          onChange={e => setName(e.target.value)}
        />
```

- [ ] **Step 2: Warn before an accidental tab close**

In `src/App.tsx`, change the existing effect block:

```tsx
  useEffect(() => {
    (async () => {
      await initLibrary();
      await initSharedTemplates();
    })();
  }, [initLibrary, initSharedTemplates]);
```

to (adding a second, independent effect after it):

```tsx
  useEffect(() => {
    (async () => {
      await initLibrary();
      await initSharedTemplates();
    })();
  }, [initLibrary, initSharedTemplates]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (undoStack.length === 0) return;
      e.preventDefault();
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [undoStack.length]);
```

(`undoStack` grows on the very first edit and never shrinks back to empty during a session — see `pushUndo` in `src/store/battleStore.ts` — so `undoStack.length > 0` is a reliable, already-available "this session has unsaved edits" signal with no new state needed. Modern browsers ignore any custom message and show their own generic "leave site?" prompt, so `e.preventDefault()` alone is correct and sufficient — do not also set `e.returnValue`, it's unnecessary in evergreen browsers and the plan intentionally keeps this minimal.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both must be green.

Manually: open the dev server, make one edit (e.g. change a unit's HP), then try to close/reload the tab — the browser should show its native "leave site?" confirmation. With no edits made yet, closing/reloading should NOT prompt.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "app: label project-name field, warn before losing unsaved edits"
```

---

### Task 3: `UnitsPanel.tsx` — keyboard-accessible unit cards, icon-button labels, linked field labels

**Files:**
- Modify: `src/components/panels/UnitsPanel.tsx`

**Interfaces:**
- Consumes: `.field-label` class from Task 1.
- Produces: nothing new for other tasks.

- [ ] **Step 1: Make the accordion header keyboard-operable**

Change:

```tsx
      <div className="unit-card-header" onClick={() => setOpen(o => !o)}>
        <span className="unit-card-title">{unit.name || '(unnamed)'}</span>
        <span className="unit-card-type">{unit.type}</span>
        {canRemove && (
          <button className="unit-remove" onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove">✕</button>
        )}
      </div>
```

to:

```tsx
      <div
        className="unit-card-header"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(o => !o);
          }
        }}
      >
        <span className="unit-card-title">{unit.name || '(unnamed)'}</span>
        <span className="unit-card-type">{unit.type}</span>
        {canRemove && (
          <button
            className="unit-remove"
            aria-label={`Remove ${unit.name || 'unit'}`}
            onClick={e => { e.stopPropagation(); onRemove(); }}
            title="Remove"
          >
            ✕
          </button>
        )}
      </div>
```

- [ ] **Step 2: Link every field label to its control**

The pattern for the rest of this file: each `<div className="field"><label>Text</label><input .../></div>` gets a stable `id` on the control (built from `unit.id` so multiple unit cards never collide) and a matching `htmlFor` on the label. Apply this pattern to every field in `UnitCard` (currently lines 34-141):

Worked example — change:
```tsx
        <div className="field">
          <label>Name</label>
          <input type="text" value={unit.name} onChange={e => onUpdate({ name: e.target.value })} />
        </div>
```
to:
```tsx
        <div className="field">
          <label htmlFor={`unit-name-${unit.id}`}>Name</label>
          <input id={`unit-name-${unit.id}`} type="text" value={unit.name} onChange={e => onUpdate({ name: e.target.value })} />
        </div>
```

Apply the identical pattern (matching `id`/`htmlFor` pair, ids prefixed `unit-` and suffixed `-${unit.id}`) to every remaining field in this component:
- `Type` select (currently ~L39-44) → id `unit-type-${unit.id}`
- `HP` input (~L49-50) → id `unit-hp-${unit.id}`
- `Base Damage` input (~L53-54) → id `unit-basedamage-${unit.id}`
- `Defense` input (~L60-61) → id `unit-defense-${unit.id}`
- `Dmg Multiplier` input (~L64-65) → id `unit-dmgmult-${unit.id}`
- `Grid Col` input (~L71-72) → id `unit-gridcol-${unit.id}`
- `Grid Row` input (~L75-76) → id `unit-gridrow-${unit.id}`
- `Display Width` input (~L79-80) → id `unit-displaywidth-${unit.id}`
- `Move Range` input (~L83-84) → id `unit-moverange-${unit.id}`
- `Projectile Size` input (~L140-141, inside the `type === 'ranged'` block) → id `unit-projsize-${unit.id}`

Leave the `Resist To` checkboxes (~L88-107) and the three `AssetUpload` fields (`Idle Image`, `Attack Image`, `Projectile Image`) untouched — checkboxes here already wrap their control correctly, and the `AssetUpload`-wrapping labels are handled in Task 4/7/8's orphaned-label pattern, not here.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: open the dev server, go to Units. Click a unit card header — it should still expand/collapse exactly as before. Then click the card header once to focus it (or Tab to it) and press Enter, then Space — both should toggle it open/closed. Click a field's visible label text (e.g. "Name") — the adjacent input should receive focus.

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/UnitsPanel.tsx
git commit -m "app: make unit cards keyboard-operable, link field labels, label remove buttons"
```

---

### Task 4: `AssetUpload.tsx` — meaningful alt text, icon-button labels

**Files:**
- Modify: `src/components/AssetUpload.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is the single shared component every panel uses for image/audio upload, so this fix applies everywhere at once.

- [ ] **Step 1: Fix the thumbnail's `alt` text**

Change:
```tsx
            <img className="asset-thumb" src={asset.dataUri} alt="" />
```
to:
```tsx
            <img className="asset-thumb" src={asset.dataUri} alt={asset.fileName} />
```

(Matches the equivalent thumbnail in `LibraryPanel.tsx`/`LibraryPickerModal.tsx`, which already correctly use `alt={a.fileName}`.)

- [ ] **Step 2: Label the icon-only buttons**

Change:
```tsx
            <button
              className="asset-action-btn"
              title="Save to library"
              onClick={e => { e.preventDefault(); addToLibrary(asset); }}
            >
              💾
            </button>
            <button
              className="asset-clear"
              title="Remove"
              onClick={e => { e.preventDefault(); onChange(null); }}
            >
              ✕
            </button>
```
to:
```tsx
            <button
              className="asset-action-btn"
              aria-label="Save to library"
              title="Save to library"
              onClick={e => { e.preventDefault(); addToLibrary(asset); }}
            >
              💾
            </button>
            <button
              className="asset-clear"
              aria-label={`Remove ${asset.fileName}`}
              title="Remove"
              onClick={e => { e.preventDefault(); onChange(null); }}
            >
              ✕
            </button>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: upload an image anywhere in the editor, confirm the thumbnail still renders identically, and confirm the 💾/✕ buttons still work (save-to-library, clear).

- [ ] **Step 4: Commit**

```bash
git add src/components/AssetUpload.tsx
git commit -m "app: meaningful alt text on asset thumbnails, label save/remove buttons"
```

---

### Task 5: Shared dialog accessibility — Escape-to-close, `role="dialog"`, initial focus

**Files:**
- Create: `src/hooks/useDialogA11y.ts`
- Modify: `src/components/export/ExportDialog.tsx`
- Modify: `src/components/LibraryPickerModal.tsx`
- Modify: `src/components/TemplatesModal.tsx`

**Interfaces:**
- Produces: `export function useDialogA11y(onClose: () => void): React.RefObject<HTMLDivElement>` — call it inside a dialog component, attach the returned ref to the dialog's outer `.dialog` element. It wires an Escape-key handler that calls `onClose`, and focuses the dialog on mount so screen readers announce it immediately and keyboard focus starts inside it.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useDialogA11y.ts`:

```tsx
import { useEffect, useRef } from 'react';

export function useDialogA11y(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return ref;
}
```

- [ ] **Step 2: Apply it to `ExportDialog.tsx`**

Add the import:
```tsx
import { useDialogA11y } from '../../hooks/useDialogA11y';
```

Inside the `ExportDialog` component, right after `const [working, setWorking] = useState(false);`, add:
```tsx
  const dialogRef = useDialogA11y(onClose);
```

Change the dialog's outer markup from:
```tsx
      <div className="dialog">
        <h2>Export</h2>
```
to:
```tsx
      <div className="dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="export-dialog-title" tabIndex={-1}>
        <h2 id="export-dialog-title">Export</h2>
```

- [ ] **Step 3: Apply it to `LibraryPickerModal.tsx`**

Add the import:
```tsx
import { useDialogA11y } from '../hooks/useDialogA11y';
```

Inside `LibraryPickerModal`, right after `const { library } = useBattleStore();`, add:
```tsx
  const dialogRef = useDialogA11y(onClose);
```

Change:
```tsx
      <div className="dialog lib-picker-dialog" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2>Library — pick {isAudio ? 'audio' : 'image'}</h2>
```
to:
```tsx
      <div className="dialog lib-picker-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="library-picker-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 id="library-picker-title">Library — pick {isAudio ? 'audio' : 'image'}</h2>
```

- [ ] **Step 4: Apply it to `TemplatesModal.tsx`**

Add the import:
```tsx
import { useDialogA11y } from '../hooks/useDialogA11y';
```

Inside `TemplatesModal`, right after `const importRef = useRef<HTMLInputElement>(null);`, add:
```tsx
  const dialogRef = useDialogA11y(onClose);
```

Change:
```tsx
      <div className="dialog" style={{ width: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2>Templates</h2>
```
to:
```tsx
      <div className="dialog" style={{ width: 460 }} ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="templates-dialog-title" tabIndex={-1} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 id="templates-dialog-title">Templates</h2>
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: open each of the three dialogs (Export, a Library picker via any asset slot's 📚 button, Templates) and for each: confirm it still opens/closes/functions exactly as before (clicking the backdrop, clicking Cancel/✕), then press Escape and confirm it closes that way too.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDialogA11y.ts src/components/export/ExportDialog.tsx src/components/LibraryPickerModal.tsx src/components/TemplatesModal.tsx
git commit -m "app: add Escape-to-close, role=dialog, and initial focus to all three dialogs"
```

---

### Task 6: `ScenarioPanel.tsx` — select labels, button labels, linked field labels

**Files:**
- Modify: `src/components/panels/ScenarioPanel.tsx`

**Interfaces:**
- Consumes: `.field-label` class from Task 1 (not used in this file — it has no `AssetUpload` fields — included for consistency, no action needed if unused).
- Produces: nothing new.

- [ ] **Step 1: Label the 8 title-only selects**

Each of these already has a `title="..."` attribute — add a matching `aria-label` with the same text alongside it (do not remove `title`, it's still a useful visual tooltip):

- L110-119 (Actor select): add `aria-label="Who acts"` alongside `title="Who acts"`
- L122-139 (Action select): add `aria-label="Action"` alongside `title="Action"`
- L143-153 (Spell select): add `aria-label="Spell"` alongside `title="Spell"`
- L176-186 (Target enemy select): add `aria-label="Target enemy"` alongside `title="Target enemy"`
- L334-341 (Attacker select): add `aria-label="Attacker"` alongside `title="Attacker"`
- L342-350 (enemy turn Action select): add `aria-label="Action"` alongside `title="Action"`
- L353-361 (Target player unit select): add `aria-label="Target player unit"` alongside `title="Target player unit"`

Worked example — change:
```tsx
              <select
                title="Who acts"
                value={step.actorUnitId ?? config.playerUnits[0]?.id ?? ''}
                onChange={e => updateStep(i, { actorUnitId: e.target.value })}
                style={{ flex: '1 1 90px', minWidth: 80 }}
              >
```
to:
```tsx
              <select
                title="Who acts"
                aria-label="Who acts"
                value={step.actorUnitId ?? config.playerUnits[0]?.id ?? ''}
                onChange={e => updateStep(i, { actorUnitId: e.target.value })}
                style={{ flex: '1 1 90px', minWidth: 80 }}
              >
```

Apply the same `aria-label` addition (matching the existing `title` value on that same element) to the other 6 selects listed above.

- [ ] **Step 2: Label the remaining icon-only buttons**

- L188 (`unit-remove` inside the winning-sequence step card): change `<button className="unit-remove" onClick={() => removeStep(i)}>✕</button>` to `<button className="unit-remove" aria-label={`Remove step ${i + 1}`} onClick={() => removeStep(i)}>✕</button>`
- L256-257 (retaliation remove): change `<button className="unit-remove" style={{ alignSelf: 'flex-end', marginBottom: 2 }} onClick={() => removeRetaliation(i)}>✕</button>` to add `aria-label="Remove retaliation"` before `onClick`
- L315-317 (player-turn remove): change to add `aria-label="Remove turn"` before `onClick`
- L397 (enemy-turn remove): change to add `aria-label="Remove enemy turn"` before `onClick`

- [ ] **Step 3: Link the plain-text field labels**

Apply the same `id`/`htmlFor` pattern as Task 3, using a plan-wide-unique prefix per field (this file has no natural per-row id in some loops — use the loop index `i` where that's what the code already uses, e.g. `key={i}`):

- `Battle Mode` select (L79-86) → id `scenario-mode`
- `Intro Speech` input (L88-96) → id `scenario-intro-speech`
- `Tooltip (what & why)` textarea (L191-197, inside the guided-mode step block) → id `scenario-step-tooltip-${i}`
- `Hint Lines...` textarea (L218-224, inside the fail-conditions map, `fc` is the loop var with `fc.id`) → id `scenario-hint-lines-${fc.id}`
- `When killed` select (L237-243) → id `scenario-ret-killed-${i}`
- `Retaliator` select (L244-250) → id `scenario-ret-retaliator-${i}`
- `Damage` input (L251-255) → id `scenario-ret-damage-${i}`
- `Speech Text` input (L259-263) → id `scenario-ret-speech-${i}`
- `Follow-up Speech` input (L264-268) → id `scenario-ret-followup-${i}`
- `Damage` input inside Attack Reactions (L428-432, loop var is `reaction` with `reaction.enemyUnitId`) → id `scenario-reaction-damage-${reaction.enemyUnitId}`
- `Retaliation Speech` input (L433-437) → id `scenario-reaction-speech-${reaction.enemyUnitId}`

Leave the two radio buttons (`firstTurn`, L282-293) and the `Retaliates` checkbox (L417-424) untouched — both already correctly wrap their control in the surrounding `<label>`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: open Scenario in each of the three battle modes (Puzzle, Guided, Alternating) and confirm every field still reads/writes correctly — add and remove a winning-sequence step, a retaliation, a player turn, an enemy turn; toggle an enemy's Retaliates checkbox.

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/ScenarioPanel.tsx
git commit -m "app: label scenario selects and remove buttons, link remaining field labels"
```

---

### Task 7: `StorePanel.tsx`, `GridPanel.tsx`, `HeroPanel.tsx` — linked labels, orphaned-label cleanup

**Files:**
- Modify: `src/components/panels/StorePanel.tsx`
- Modify: `src/components/panels/GridPanel.tsx`
- Modify: `src/components/panels/HeroPanel.tsx`

**Interfaces:**
- Consumes: `.field-label` class from Task 1.
- Produces: nothing new.

- [ ] **Step 1: `StorePanel.tsx` — link the three fields, add example placeholders**

Change:
```tsx
      <div className="field">
        <label>iOS App Store URL</label>
        <input type="url" value={store.iosUrl} onChange={e => setStore({ iosUrl: e.target.value })} />
      </div>
      <div className="field">
        <label>Android Play Store URL</label>
        <input type="url" value={store.androidUrl} onChange={e => setStore({ androidUrl: e.target.value })} />
      </div>
      <div className="field" style={{ maxWidth: 180 }}>
        <label>Show Store Button After N Fails</label>
        <input
          type="number"
          min={1}
          value={store.ctaFailCount}
          onChange={e => setStore({ ctaFailCount: +e.target.value })}
        />
      </div>
```
to:
```tsx
      <div className="field">
        <label htmlFor="store-ios-url">iOS App Store URL</label>
        <input id="store-ios-url" type="url" placeholder="https://apps.apple.com/…" value={store.iosUrl} onChange={e => setStore({ iosUrl: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="store-android-url">Android Play Store URL</label>
        <input id="store-android-url" type="url" placeholder="https://play.google.com/store/apps/…" value={store.androidUrl} onChange={e => setStore({ androidUrl: e.target.value })} />
      </div>
      <div className="field" style={{ maxWidth: 180 }}>
        <label htmlFor="store-cta-fail-count">Show Store Button After N Fails</label>
        <input
          id="store-cta-fail-count"
          type="number"
          min={1}
          value={store.ctaFailCount}
          onChange={e => setStore({ ctaFailCount: +e.target.value })}
        />
      </div>
```

- [ ] **Step 2: `GridPanel.tsx` — link the four number fields, convert the two orphaned `AssetUpload` labels**

Change:
```tsx
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
```
to:
```tsx
        <div className="field">
          <label htmlFor="grid-cols">Columns</label>
          <input id="grid-cols" type="number" min={2} max={10} value={grid.cols}
            onChange={e => setGridSize({ cols: +e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="grid-rows">Rows</label>
          <input id="grid-rows" type="number" min={2} max={8} value={grid.rows}
            onChange={e => setGridSize({ rows: +e.target.value })} />
        </div>
```

Change:
```tsx
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
```
to:
```tsx
        <div className="field">
          <label htmlFor="grid-offset-landscape">Landscape offset Y</label>
          <input id="grid-offset-landscape" type="number" step={10} value={gridOffset.landscape}
            onChange={e => setGridOffset('landscape', +e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="grid-offset-portrait">Portrait offset Y</label>
          <input id="grid-offset-portrait" type="number" step={10} value={gridOffset.portrait}
            onChange={e => setGridOffset('portrait', +e.target.value)} />
        </div>
```

Change:
```tsx
      <div className="field">
        <label>Walkable Hex Tile</label>
        <AssetUpload label="Walkable hex" asset={config.gridTiles.walkable}
          roleKey={FIXED_ROLE_KEYS.gridTileWalkable}
          onChange={a => setGridTile('walkable', a)} />
      </div>
      <div className="field">
        <label>Active Hex Tile</label>
        <AssetUpload label="Active hex" asset={config.gridTiles.active}
          roleKey={FIXED_ROLE_KEYS.gridTileActive}
          onChange={a => setGridTile('active', a)} />
      </div>
```
to:
```tsx
      <div className="field">
        <div className="field-label">Walkable Hex Tile</div>
        <AssetUpload label="Walkable hex" asset={config.gridTiles.walkable}
          roleKey={FIXED_ROLE_KEYS.gridTileWalkable}
          onChange={a => setGridTile('walkable', a)} />
      </div>
      <div className="field">
        <div className="field-label">Active Hex Tile</div>
        <AssetUpload label="Active hex" asset={config.gridTiles.active}
          roleKey={FIXED_ROLE_KEYS.gridTileActive}
          onChange={a => setGridTile('active', a)} />
      </div>
```

- [ ] **Step 3: `HeroPanel.tsx` — link all number fields (both hero sides), convert the two orphaned `AssetUpload` labels**

For `heroLeft`'s three number fields (`Pos X`, `Pos Y`, `Display Width`, currently inside the first `.row` block), add matching ids/htmlFor prefixed `hero-left-`: `hero-left-posx`, `hero-left-posy`, `hero-left-displaywidth`. Worked example — change:
```tsx
        <div className="field">
          <label>Pos X (from left edge)</label>
          <input type="number" value={heroLeft.posX} onChange={e => setHeroLeft({ posX: +e.target.value })} />
        </div>
```
to:
```tsx
        <div className="field">
          <label htmlFor="hero-left-posx">Pos X (from left edge)</label>
          <input id="hero-left-posx" type="number" value={heroLeft.posX} onChange={e => setHeroLeft({ posX: +e.target.value })} />
        </div>
```
Apply identically to the `Pos Y (from top)` and `Display Width` fields in the same block (`hero-left-posy`, `hero-left-displaywidth`).

Do the same for `heroRight`'s three number fields, prefixed `hero-right-`: `hero-right-posx`, `hero-right-posy`, `hero-right-displaywidth`.

Leave both "Flipped horizontally" checkboxes untouched — they already correctly wrap their control.

Change both `Portrait` fields:
```tsx
      <div className="field">
        <label>Portrait</label>
        <AssetUpload label="Left hero" asset={heroLeft.asset} roleKey={FIXED_ROLE_KEYS.heroLeft} onChange={a => setHeroLeft({ asset: a })} />
      </div>
```
and
```tsx
      <div className="field">
        <label>Portrait</label>
        <AssetUpload label="Right hero" asset={heroRight.asset} roleKey={FIXED_ROLE_KEYS.heroRight} onChange={a => setHeroRight({ asset: a })} />
      </div>
```
to use `<div className="field-label">Portrait</div>` instead of `<label>Portrait</label>` in both places.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: open Store, Grid, and Heroes panels, confirm every field still visually looks the same and still reads/writes correctly, click a couple of label texts and confirm the adjacent input focuses.

- [ ] **Step 5: Commit**

```bash
git add src/components/panels/StorePanel.tsx src/components/panels/GridPanel.tsx src/components/panels/HeroPanel.tsx
git commit -m "app: link field labels and fix orphaned asset-upload labels in Store/Grid/Hero panels"
```

---

### Task 8: `PopupsPanel.tsx`, `SpellsPanel.tsx`, `AudioPanel.tsx`, `BackgroundPanel.tsx` — linked labels, orphaned-label cleanup

**Files:**
- Modify: `src/components/panels/PopupsPanel.tsx`
- Modify: `src/components/panels/SpellsPanel.tsx`
- Modify: `src/components/panels/AudioPanel.tsx`
- Modify: `src/components/panels/BackgroundPanel.tsx`

**Interfaces:**
- Consumes: `.field-label` class from Task 1.
- Produces: nothing new.

This task applies the exact same two patterns as Task 7 (real `<label htmlFor>`/`<input id>` pairs for genuine form controls; `<div className="field-label">` in place of a `<label>` that wraps an `AssetUpload`) across four files that are almost entirely `AssetUpload` fields plus a handful of number/color inputs. Work through each file in order:

- [ ] **Step 1: `BackgroundPanel.tsx`**

Both fields wrap `AssetUpload` — convert both `<label>Landscape Background</label>` and `<label>Portrait Background</label>` to `<div className="field-label">...</div>` (same text, same position).

- [ ] **Step 2: `AudioPanel.tsx`**

The `Background Music` field's `<label>Background Music</label>` wraps an `AssetUpload` → convert to `<div className="field-label">Background Music</div>`.

Inside the `AUDIO_EVENTS.map(ev => ...)` loop, `<label>{EVENT_LABELS[ev] ?? ev}</label>` also wraps an `AssetUpload` → convert to `<div className="field-label">{EVENT_LABELS[ev] ?? ev}</div>`.

- [ ] **Step 3: `SpellsPanel.tsx`**

Real form controls to link (both inside `SpellCard`):
- `Name` input → id `spell-name-${spell.id}`, matching `htmlFor`
- `Element` select → id `spell-element-${spell.id}`, matching `htmlFor`
- `Projectile Size` input → id `spell-projsize-${spell.id}`, matching `htmlFor`

The spellbook-enabled checkbox (top of the file) already correctly wraps its control — leave it.

`AssetUpload`-wrapping labels to convert to `<div className="field-label">`: `Melee`, `Ranged`, `Flying` (attack-type icons), `Projectile Image` (ranged projectile), `Closed (default state)`, `Open (when spells shown)` (spellbook icons), and inside `SpellCard`: `Spell Icon`, `Projectile Image (optional…)`, `SFX – Shoot`, `SFX – Hit`.

- [ ] **Step 4: `PopupsPanel.tsx`**

Real form controls to link:
- `Hint Text Color` input → id `popup-hint-color`, matching `htmlFor`
- `Landscape Y` / `Portrait Y` (hint layout) → ids `popup-hint-landscape-y`, `popup-hint-portrait-y`
- `Landscape font size` / `Portrait font size` (hint layout) → ids `popup-hint-landscape-fontsize`, `popup-hint-portrait-fontsize`
- `X (left)` / `Y (top)` / `Font size` under Speech Bubble → Landscape: ids `popup-speech-landscape-x`, `popup-speech-landscape-y`, `popup-speech-landscape-fontsize`; Portrait: ids `popup-speech-portrait-x`, `popup-speech-portrait-y`, `popup-speech-portrait-fontsize`

`AssetUpload`-wrapping labels to convert to `<div className="field-label">`: `Icon shown in win/defeat screens`, `Banner Image` (×2 — victory and defeat, these will have the same visible text but that's fine since they're plain `<div>`s now, no id collision risk since they're not linked to anything), `Board Image` (×2), `CTA Button Image`, `Retry Button Image`, `Store Button Image`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: open Popups, Spells, Audio, and Backgrounds panels. Confirm every field still looks identical and still reads/writes correctly — upload/change an asset in each panel, edit the hint-text color, edit a spell's name/element.

- [ ] **Step 6: Commit**

```bash
git add src/components/panels/PopupsPanel.tsx src/components/panels/SpellsPanel.tsx src/components/panels/AudioPanel.tsx src/components/panels/BackgroundPanel.tsx
git commit -m "app: link field labels and fix orphaned asset-upload labels in Popups/Spells/Audio/Background panels"
```

---

### Task 9: `LibraryPanel.tsx` — button label, live status region

**Files:**
- Modify: `src/components/LibraryPanel.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new.

- [ ] **Step 1: Announce the sync-failure banner**

Change:
```tsx
      {failed.length > 0 && (
        <div style={{ background: '#442222', border: '1px solid #663333', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
```
to:
```tsx
      {failed.length > 0 && (
        <div role="status" aria-live="polite" style={{ background: '#442222', border: '1px solid #663333', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
```

- [ ] **Step 2: Label the remove button**

Change:
```tsx
              <button
                className="lib-del-btn"
                title="Remove from library"
                onClick={() => removeFromLibrary(a.id)}
              >
                ✕
              </button>
```
to:
```tsx
              <button
                className="lib-del-btn"
                aria-label={`Remove ${a.fileName} from library`}
                title="Remove from library"
                onClick={() => removeFromLibrary(a.id)}
              >
                ✕
              </button>
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: open the Library panel, confirm it still renders and the remove button still works.

- [ ] **Step 4: Commit**

```bash
git add src/components/LibraryPanel.tsx
git commit -m "app: announce library sync failures, label the remove-from-library button"
```

---

### Task 10: `TemplatesModal.tsx` — remaining button labels, live status region

**Files:**
- Modify: `src/components/TemplatesModal.tsx`

**Interfaces:**
- Consumes: nothing new (Task 5 already added `role="dialog"`/Escape-close/focus to this file — this task is additive on top of that).
- Produces: nothing new.

- [ ] **Step 1: Announce the sync-failure banner**

Change:
```tsx
          {failedTemplates.length > 0 && (
            <div style={{ background: '#442222', border: '1px solid #663333', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
```
to:
```tsx
          {failedTemplates.length > 0 && (
            <div role="status" aria-live="polite" style={{ background: '#442222', border: '1px solid #663333', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
```

- [ ] **Step 2: Label the close and delete buttons**

Change:
```tsx
          <button className="asset-clear" style={{ fontSize: 18 }} onClick={onClose}>✕</button>
```
to:
```tsx
          <button className="asset-clear" aria-label="Close" style={{ fontSize: 18 }} onClick={onClose}>✕</button>
```

Change:
```tsx
                <button className="asset-clear" onClick={() => { if (confirm(`Delete shared template "${t.name}" for everyone? This can't be undone.`)) deleteTemplate(t.name); }}>✕</button>
```
to:
```tsx
                <button className="asset-clear" aria-label={`Delete ${t.name}`} onClick={() => { if (confirm(`Delete shared template "${t.name}" for everyone? This can't be undone.`)) deleteTemplate(t.name); }}>✕</button>
```

- [ ] **Step 3: Add an example placeholder to the save-name field**

Change:
```tsx
            <input
              className="project-name"
              style={{ flex: 1, maxWidth: 'none' }}
              value={saveName}
              placeholder="Template name"
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSave()}
            />
```
to:
```tsx
            <input
              className="project-name"
              style={{ flex: 1, maxWidth: 'none' }}
              value={saveName}
              placeholder="e.g. Boss Fight Lv.3…"
              autoComplete="off"
              onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSave()}
            />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: open Templates, confirm Save/Load/Delete all still work exactly as before (per the earlier session's own verification checklist: save with a name → appears in the list; Load → editor updates; Delete → removed from the list).

- [ ] **Step 5: Commit**

```bash
git add src/components/TemplatesModal.tsx
git commit -m "app: announce template sync failures, label close/delete buttons, improve save-name placeholder"
```

---

### Task 11: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check and test suite**

Run: `npx tsc --noEmit` and `npm test -- --run`.
Expected: no errors, all existing tests still passing.

- [ ] **Step 2: Full live-browser regression pass**

Start the dev server. Walk through every panel (Grid, Units, Heroes, Spells, Scenario in all 3 modes, Popups, Backgrounds, Store, Audio, Library) and confirm every field still reads and writes correctly — this plan touched every panel file, so this is the pass that catches any accidental behavior change.

Specifically re-verify:
- Uploading, saving-to-library, picking-from-library, and removing an asset (in at least 2 different panels).
- Undo/Redo still work.
- A unit card still expands/collapses on click AND on keyboard (Tab to it, press Enter or Space).
- Tab through the header buttons and at least one panel's fields — every focusable element shows a visible focus ring.
- Open and close all three dialogs (Export, a Library picker, Templates) via their close button, via clicking the backdrop, and via Escape.
- Save, Load, and Delete a shared template.
- Export a playable for at least one network and confirm the download still works.
- Make one edit, then attempt to close/reload the tab — confirm the browser's leave-confirmation prompt appears.

Report the outcome of each check. If anything regressed, find which task introduced it and fix it there before considering the plan complete.

No commit for this task — it's verification only.
