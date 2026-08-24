# Visual & Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved color/typography redesign and three panel layout regroupings from `docs/superpowers/specs/2026-08-21-visual-redesign-design.md`, as real source changes (the design was iterated live via a temporary, now-discarded preview script — nothing from that mechanism should appear in this branch).

**Architecture:** Task 1 is a CSS-and-fonts-only change (`src/App.css` replaced wholesale, one `<link>` added to `index.html`) — no component logic changes, so it can't break any interaction. Tasks 2-4 each restructure one panel's JSX for grouping/collapsibility, reusing the existing CSS classes Task 1 defines and the existing keyboard-accessible collapsible-header pattern already established in `UnitsPanel.tsx` (built in an earlier branch this one is based on) — no new interaction patterns invented.

**Tech Stack:** React 18, TypeScript, Vite, plain CSS (no new dependencies). Fonts loaded via a Google Fonts `<link>`.

## Global Constraints

- No field is added, removed, renamed, or has its `value`/`onChange`/validation logic changed anywhere in this plan — every task is presentation/grouping only.
- Every existing `id`/`htmlFor`/`aria-label`/`role`/keyboard-handler from the prior accessibility work must be preserved exactly where it already exists, and any NEW collapsible section this plan adds must use the identical pattern (`role="button"`, `tabIndex={0}`, `aria-expanded`, `onKeyDown` handling Enter/Space with an `e.target === e.currentTarget` guard) already proven in `UnitsPanel.tsx`'s `UnitCard`.
- Every task ends with `npx tsc --noEmit` and `npm test -- --run` passing, plus a live manual check.

---

### Task 1: Color palette & typography (`src/App.css`, `index.html`)

**Files:**
- Modify: `index.html`
- Modify: `src/App.css` (full-file replacement)

**Interfaces:**
- Consumes: nothing new.
- Produces: new CSS custom properties `--chrome`, `--accent2`, `--border-accent` on `:root`, alongside the existing `--bg`/`--surface`/`--surface2`/`--accent`/`--text`/`--text-muted`/`--border`/`--radius` (now with new values). Tasks 2-4 don't need any of these directly — they only add new elements that inherit these rules through existing classes (`.section-title`, `.popup-section`, etc.), so no new class names are introduced by this task.

- [ ] **Step 1: Add the font `<link>`**

In `index.html`, change:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Battle Playable Editor</title>
  </head>
```

to:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Battle Playable Editor</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  </head>
```

- [ ] **Step 2: Replace `src/App.css` in full**

Replace the entire contents of `src/App.css` with:

```css
:root {
  --bg: #232a45;
  --chrome: #1b2038;
  --surface: #2f3a5f;
  --surface2: #3d4a78;
  --accent: #e94560;
  --accent2: #4ecdc4;
  --text: #f7f8fc;
  --text-muted: #c7cee0;
  --border: #5a6ba0;
  --border-accent: #7c93d6;
  --radius: 8px;
}

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

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  height: 100vh;
  overflow: hidden;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

/* ── Header ── */
.app-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: var(--chrome);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.app-logo { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: 0.01em; white-space: nowrap; }
.project-name {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  padding: 4px 10px;
  max-width: 280px;
}
.header-actions { display: flex; gap: 6px; margin-left: auto; }
.header-actions button {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  cursor: pointer;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
}
.header-actions button:disabled { opacity: 0.35; cursor: default; }
.header-actions button:not(:disabled):hover { background: #4a5a94; border-color: #4af; }
.btn-export {
  background: var(--accent) !important;
  border-color: var(--accent) !important;
  font-weight: 600;
}
.btn-export:not(:disabled):hover { background: #d63850 !important; }

/* ── Body ── */
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* ── Nav ── */
.app-nav {
  width: 110px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--chrome);
  border-right: 1px solid var(--border);
  padding: 8px 0;
  gap: 2px;
  overflow-y: auto;
}
.app-nav button {
  background: none;
  border: none;
  border-radius: 0;
  color: var(--text-muted);
  cursor: pointer;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  padding: 9px 14px;
  text-align: left;
  transition: background 0.12s, color 0.12s;
}
.app-nav button:hover { background: var(--surface); color: var(--text); }
.app-nav button.active { background: var(--surface2); color: #fff; font-weight: 600; box-shadow: inset 3px 0 0 var(--border-accent); }

/* ── Config panel ── */
.app-config {
  flex: 0 0 40%;
  overflow-y: auto;
  padding: 16px;
  border-right: 1px solid var(--border);
}

/* ── Preview ── */
.app-preview {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Shared form controls ── */
.panel-title { font-family: 'Sora', sans-serif; font-size: 19px; font-weight: 700; letter-spacing: -0.01em; margin-bottom: 14px; }
.section-title { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; margin: 14px 0 8px; color: var(--accent2); }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field label,
.field .field-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.field input[type="text"],
.field input[type="number"],
.field input[type="url"],
.field input[type="color"],
.field select,
.field textarea {
  background: var(--chrome);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  padding: 5px 8px;
  width: 100%;
}
.field input[type="number"] {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
.field textarea { resize: vertical; min-height: 60px; }
.field input[type="color"] { height: 32px; padding: 2px 4px; cursor: pointer; }

.row { display: flex; gap: 10px; }
.row .field { flex: 1; }

/* ── Asset upload ── */
.asset-upload {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--chrome);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  padding: 6px 8px;
  cursor: pointer;
  transition: border-color 0.15s;
}
.asset-upload:hover { border-color: #4af; }
.asset-upload.has-asset { border-style: solid; border-color: #4af; }
.asset-upload input { display: none; }
.asset-thumb {
  width: 36px;
  height: 36px;
  object-fit: contain;
  border-radius: 4px;
  flex-shrink: 0;
}
.asset-thumb-audio {
  width: 36px;
  height: 36px;
  border-radius: 4px;
  background: var(--surface2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.asset-info { flex: 1; min-width: 0; }
.asset-info .name { font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.asset-info .hint { font-size: 10px; color: var(--text-muted); }
.asset-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  flex-shrink: 0;
}
.asset-clear:hover { color: var(--accent); }

/* ── Unit card ── */
.unit-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-accent);
  border-radius: var(--radius);
  margin-bottom: 10px;
  overflow: hidden;
}
.unit-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  background: var(--surface2);
}
.unit-card-header:hover { background: #4a5a94; }
.unit-card-header:focus-visible {
  outline-offset: -2px;
}
.unit-card-title { font-family: 'Sora', sans-serif; flex: 1; font-weight: 600; font-size: 13px; }
.unit-card-type { font-size: 11px; color: var(--text-muted); }
.unit-card-body { padding: 10px; display: none; }
.unit-card-body.open { display: block; }
.unit-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}
.unit-remove:hover { color: var(--accent); }

/* ── Add button ── */
.btn-add {
  background: var(--surface2);
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  cursor: pointer;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 500;
  padding: 7px;
  text-align: center;
  width: 100%;
  margin-bottom: 6px;
  transition: color 0.12s, border-color 0.12s;
}
.btn-add:hover:not(:disabled) { color: #4af; border-color: #4af; }
.btn-add:disabled { opacity: 0.35; cursor: default; }

/* ── Two-col units layout ── */
.units-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.units-col-title { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; color: var(--accent2); margin-bottom: 8px; }

/* ── Resist checkboxes ── */
.resist-row { display: flex; gap: 12px; align-items: center; }
.resist-row label { display: flex; align-items: center; gap: 4px; cursor: pointer; font-size: 12px; }

/* ── Scenario step ── */
.step-card {
  background: #262d4c;
  border: 1px solid #4a5a8c;
  border-radius: var(--radius);
  padding: 8px 10px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-order { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 11px; color: var(--text-muted); width: 18px; flex-shrink: 0; }

/* ── Fail condition card ── */
.fail-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-accent);
  border-radius: var(--radius);
  padding: 10px;
  margin-bottom: 8px;
}
.fail-card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.fail-id { background: var(--accent2); color: #0a2a28; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-weight: 700; font-size: 11px; padding: 2px 7px; border-radius: 4px; }

/* ── Retaliation card ── */
.ret-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-accent);
  border-radius: var(--radius);
  padding: 10px;
  margin-bottom: 8px;
}

/* ── Popup section ── */
.popup-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-accent);
  border-radius: var(--radius);
  padding: 10px;
  margin-bottom: 12px;
}
.popup-section-title { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; margin-bottom: 10px; color: var(--accent2); }

/* ── Audio grid ── */
.audio-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* ── Export dialog ── */
.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.75);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 24px;
  width: 420px;
  max-height: 80vh;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.dialog h2 { font-family: 'Sora', sans-serif; font-weight: 600; font-size: 16px; margin-bottom: 16px; }
.dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.btn-primary {
  background: var(--accent);
  border: none;
  border-radius: var(--radius);
  color: #fff;
  cursor: pointer;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 16px;
}
.btn-secondary {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  cursor: pointer;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 16px;
}
.btn-primary:hover { background: #d63850; }
.btn-secondary:hover { border-color: #4af; }

/* ── Network row ── */
.network-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.network-row:last-child { border-bottom: none; }
.network-name { width: 110px; font-weight: 600; }
.network-size { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; font-size: 11px; color: var(--text-muted); flex: 1; }
.size-ok  { color: #4c4; }
.size-bad { color: var(--accent); }

/* ── Live preview ── */
.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--chrome);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.preview-toolbar span { font-size: 11px; color: var(--text-muted); }
.preview-toolbar button {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  cursor: pointer;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 11px;
  padding: 3px 8px;
}
.preview-toolbar button:hover { border-color: #4af; }
.preview-frame {
  flex: 1;
  border: none;
  background: #000;
  width: 100%;
  height: 100%;
}
.preview-wrap {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ── Asset upload wrap (library button) ── */
.asset-upload-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.asset-lib-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  padding: 0 2px;
  text-align: left;
  text-decoration: underline;
}
.asset-lib-btn:hover { color: #4af; }
.asset-action-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 2px 3px;
  flex-shrink: 0;
}
.asset-action-btn:hover { color: #4af; }

/* ── Library grid ── */
.library-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 8px;
}
.library-item {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px;
  transition: border-color 0.12s;
  position: relative;
  overflow: hidden;
  text-align: center;
}
.library-item:hover { border-color: #4af; }
.library-item img {
  width: 70px;
  height: 60px;
  object-fit: contain;
  border-radius: 4px;
}
.lib-audio-icon {
  width: 70px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  background: var(--surface2);
  border-radius: 4px;
}
.lib-item-name {
  font-size: 9px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
}
.library-item-manage { cursor: default; }
.library-item-manage:hover { border-color: var(--border); }
.lib-del-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  background: rgba(0,0,0,.6);
  border: none;
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 10px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lib-del-btn:hover { color: var(--accent); }

/* ── Lib picker dialog ── */
.lib-picker-dialog { width: 520px; max-height: 70vh; }

/* ── Templates ── */
.template-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border);
}
.template-item:last-child { border-bottom: none; }
.template-name { flex: 1; font-size: 13px; }
.template-date { font-size: 10px; color: var(--text-muted); }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both must be green (CSS/HTML-only change, existing suite is the regression check).

Manually: start the dev server, load the editor, confirm the fonts visibly load (panel titles noticeably bolder/different from body text — that's Sora; number fields like HP/Grid Col look monospaced — that's IBM Plex Mono). Click through every nav item once to confirm nothing is visually broken (overlapping text, unreadable contrast, a section that lost its background). Open each of the three dialogs. Confirm the nav's active item still shows its highlight, unit card headers still show on hover.

- [ ] **Step 4: Commit**

```bash
git add index.html src/App.css
git commit -m "app: apply lighter structured color palette and Sora/IBM Plex type system"
```

---

### Task 2: `UnitsPanel.tsx` — sub-group fields within each unit card

**Files:**
- Modify: `src/components/panels/UnitsPanel.tsx`

**Interfaces:**
- Consumes: `.section-title` CSS class from Task 1 (already exists, reused here as a sub-heading — no new CSS needed).
- Produces: nothing new — same `UnitCard` component, same props, same fields.

- [ ] **Step 1: Insert four sub-headings, regrouping the existing fields**

No field's markup changes — only four new `<div className="section-title">Label</div>` lines are inserted at group boundaries, and the field order is unchanged (it already happens to match the desired grouping order).

In `src/components/panels/UnitsPanel.tsx`, inside `UnitCard`'s return statement, change:

```tsx
      <div className={`unit-card-body${open ? ' open' : ''}`}>
        <div className="field">
          <label htmlFor={`unit-name-${unit.id}`}>Name</label>
          <input id={`unit-name-${unit.id}`} type="text" value={unit.name} onChange={e => onUpdate({ name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`unit-type-${unit.id}`}>Type</label>
          <select id={`unit-type-${unit.id}`} value={unit.type} onChange={e => onUpdate({ type: e.target.value as UnitConfig['type'] })}>
            <option value="melee">Melee</option>
            <option value="ranged">Ranged</option>
            <option value="flying">Flying</option>
          </select>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor={`unit-hp-${unit.id}`}>HP</label>
            <input id={`unit-hp-${unit.id}`} type="number" min={1} value={unit.hp} onChange={e => onUpdate({ hp: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-basedamage-${unit.id}`}>Base Damage</label>
            <input id={`unit-basedamage-${unit.id}`} type="number" min={0} value={unit.baseDamage} onChange={e => onUpdate({ baseDamage: +e.target.value })} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor={`unit-defense-${unit.id}`}>Defense</label>
            <input id={`unit-defense-${unit.id}`} type="number" min={0} value={unit.defense} onChange={e => onUpdate({ defense: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-dmgmult-${unit.id}`}>Dmg Multiplier</label>
            <input id={`unit-dmgmult-${unit.id}`} type="number" min={0} step={0.1} value={unit.damageMultiplier} onChange={e => onUpdate({ damageMultiplier: +e.target.value })} />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label htmlFor={`unit-gridcol-${unit.id}`}>Grid Col</label>
            <input id={`unit-gridcol-${unit.id}`} type="number" min={0} max={gridCols - 1} value={unit.gridCol} onChange={e => onUpdate({ gridCol: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-gridrow-${unit.id}`}>Grid Row</label>
            <input id={`unit-gridrow-${unit.id}`} type="number" min={0} max={gridRows - 1} value={unit.gridRow} onChange={e => onUpdate({ gridRow: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-displaywidth-${unit.id}`}>Display Width</label>
            <input id={`unit-displaywidth-${unit.id}`} type="number" min={40} max={300} value={unit.displayWidth} onChange={e => onUpdate({ displayWidth: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-moverange-${unit.id}`}>Move Range</label>
            <input id={`unit-moverange-${unit.id}`} type="number" min={1} max={8} value={unit.moveRange ?? 2} onChange={e => onUpdate({ moveRange: +e.target.value })} title="Max hexes per turn" />
          </div>
        </div>

        <div className="field">
          <div className="field-label">Resist To</div>
          <div className="resist-row">
            {(['fire', 'ice'] as SpellElement[]).map(el => (
              <label key={el}>
                <input
                  type="checkbox"
                  checked={unit.resistTo.includes(el)}
                  onChange={ev => {
                    const next = ev.target.checked
                      ? [...unit.resistTo, el]
                      : unit.resistTo.filter(r => r !== el);
                    onUpdate({ resistTo: next });
                  }}
                />
                {el.charAt(0).toUpperCase() + el.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field-label">Idle Image</div>
          <AssetUpload
            label="Idle sprite"
            asset={unit.assets.idle}
            roleKey={unitRoleKey('idle', unit.name)}
            onChange={a => onUpdate({ assets: { ...unit.assets, idle: a } })}
          />
        </div>
        <div className="field">
          <div className="field-label">Attack Image</div>
          <AssetUpload
            label="Attack sprite"
            asset={unit.assets.attack}
            roleKey={unitRoleKey('attack', unit.name)}
            onChange={a => onUpdate({ assets: { ...unit.assets, attack: a } })}
          />
        </div>
        {unit.type === 'ranged' && (
          <>
            <div className="field">
              <div className="field-label">Projectile Image</div>
              <AssetUpload
                label="Projectile"
                asset={unit.assets.projectile ?? null}
                roleKey={unitRoleKey('projectile', unit.name)}
                onChange={a => onUpdate({ assets: { ...unit.assets, projectile: a } })}
              />
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor={`unit-projsize-${unit.id}`}>Projectile Size</label>
              <input id={`unit-projsize-${unit.id}`} type="number" min={16} max={200} value={unit.projectileSize ?? 60}
                onChange={e => onUpdate({ projectileSize: +e.target.value })} />
            </div>
          </>
        )}
      </div>
```

to:

```tsx
      <div className={`unit-card-body${open ? ' open' : ''}`}>
        <div className="section-title" style={{ marginTop: 0 }}>Identity</div>
        <div className="field">
          <label htmlFor={`unit-name-${unit.id}`}>Name</label>
          <input id={`unit-name-${unit.id}`} type="text" value={unit.name} onChange={e => onUpdate({ name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor={`unit-type-${unit.id}`}>Type</label>
          <select id={`unit-type-${unit.id}`} value={unit.type} onChange={e => onUpdate({ type: e.target.value as UnitConfig['type'] })}>
            <option value="melee">Melee</option>
            <option value="ranged">Ranged</option>
            <option value="flying">Flying</option>
          </select>
        </div>

        <div className="section-title">Combat</div>
        <div className="row">
          <div className="field">
            <label htmlFor={`unit-hp-${unit.id}`}>HP</label>
            <input id={`unit-hp-${unit.id}`} type="number" min={1} value={unit.hp} onChange={e => onUpdate({ hp: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-basedamage-${unit.id}`}>Base Damage</label>
            <input id={`unit-basedamage-${unit.id}`} type="number" min={0} value={unit.baseDamage} onChange={e => onUpdate({ baseDamage: +e.target.value })} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor={`unit-defense-${unit.id}`}>Defense</label>
            <input id={`unit-defense-${unit.id}`} type="number" min={0} value={unit.defense} onChange={e => onUpdate({ defense: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-dmgmult-${unit.id}`}>Dmg Multiplier</label>
            <input id={`unit-dmgmult-${unit.id}`} type="number" min={0} step={0.1} value={unit.damageMultiplier} onChange={e => onUpdate({ damageMultiplier: +e.target.value })} />
          </div>
        </div>
        <div className="field">
          <div className="field-label">Resist To</div>
          <div className="resist-row">
            {(['fire', 'ice'] as SpellElement[]).map(el => (
              <label key={el}>
                <input
                  type="checkbox"
                  checked={unit.resistTo.includes(el)}
                  onChange={ev => {
                    const next = ev.target.checked
                      ? [...unit.resistTo, el]
                      : unit.resistTo.filter(r => r !== el);
                    onUpdate({ resistTo: next });
                  }}
                />
                {el.charAt(0).toUpperCase() + el.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="section-title">Position &amp; Size</div>
        <div className="row">
          <div className="field">
            <label htmlFor={`unit-gridcol-${unit.id}`}>Grid Col</label>
            <input id={`unit-gridcol-${unit.id}`} type="number" min={0} max={gridCols - 1} value={unit.gridCol} onChange={e => onUpdate({ gridCol: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-gridrow-${unit.id}`}>Grid Row</label>
            <input id={`unit-gridrow-${unit.id}`} type="number" min={0} max={gridRows - 1} value={unit.gridRow} onChange={e => onUpdate({ gridRow: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-displaywidth-${unit.id}`}>Display Width</label>
            <input id={`unit-displaywidth-${unit.id}`} type="number" min={40} max={300} value={unit.displayWidth} onChange={e => onUpdate({ displayWidth: +e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor={`unit-moverange-${unit.id}`}>Move Range</label>
            <input id={`unit-moverange-${unit.id}`} type="number" min={1} max={8} value={unit.moveRange ?? 2} onChange={e => onUpdate({ moveRange: +e.target.value })} title="Max hexes per turn" />
          </div>
        </div>

        <div className="section-title">Art</div>
        <div className="field">
          <div className="field-label">Idle Image</div>
          <AssetUpload
            label="Idle sprite"
            asset={unit.assets.idle}
            roleKey={unitRoleKey('idle', unit.name)}
            onChange={a => onUpdate({ assets: { ...unit.assets, idle: a } })}
          />
        </div>
        <div className="field">
          <div className="field-label">Attack Image</div>
          <AssetUpload
            label="Attack sprite"
            asset={unit.assets.attack}
            roleKey={unitRoleKey('attack', unit.name)}
            onChange={a => onUpdate({ assets: { ...unit.assets, attack: a } })}
          />
        </div>
        {unit.type === 'ranged' && (
          <>
            <div className="field">
              <div className="field-label">Projectile Image</div>
              <AssetUpload
                label="Projectile"
                asset={unit.assets.projectile ?? null}
                roleKey={unitRoleKey('projectile', unit.name)}
                onChange={a => onUpdate({ assets: { ...unit.assets, projectile: a } })}
              />
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label htmlFor={`unit-projsize-${unit.id}`}>Projectile Size</label>
              <input id={`unit-projsize-${unit.id}`} type="number" min={16} max={200} value={unit.projectileSize ?? 60}
                onChange={e => onUpdate({ projectileSize: +e.target.value })} />
            </div>
          </>
        )}
      </div>
```

(Note: the `Resist To` field moved to sit right after the Combat row's `HP`/`Base Damage`/`Defense`/`Dmg Multiplier` fields, ahead of where it originally sat — this is the intended regrouping, since Resist To is a combat property.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: open Units, expand a unit card, confirm you now see four labeled clusters (Identity, Combat, Position & Size, Art) in that order, and every field still reads and writes correctly — edit the name, HP, grid column, and upload an idle sprite.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/UnitsPanel.tsx
git commit -m "app: group unit card fields into Identity/Combat/Position/Art clusters"
```

---

### Task 3: `ScenarioPanel.tsx` — collapsible Alternating-mode sections

**Files:**
- Modify: `src/components/panels/ScenarioPanel.tsx`

**Interfaces:**
- Consumes: the existing `.popup-section`/`.popup-section-title` CSS classes (Task 1 already styles them; no new CSS needed — the click/keyboard behavior is added via a wrapper `<div>` around the existing title, following `UnitCard`'s already-proven pattern).
- Produces: nothing new — same fields, same `useBattleStore` actions.

- [ ] **Step 1: Add local expand/collapse state**

`ScenarioPanel` is a function component with no existing `useState`. Add one, right after the existing destructuring block (after the line `const gridRows = config.grid?.rows ?? 4;`):

```tsx
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    firstTurn: true,
    playerTurns: true,
    enemyTurns: true,
    reactions: true,
  });
  function toggleSection(key: string) {
    setOpenSections(s => ({ ...s, [key]: !s[key] }));
  }
```

Add the import at the top of the file (currently `import { useBattleStore } from '../../store/battleStore';` is the first line):

```tsx
import { useState } from 'react';
import { useBattleStore } from '../../store/battleStore';
```

- [ ] **Step 2: Make each of the four Alternating-mode section headers collapsible**

Change the four `<div className="popup-section-title">...</div>` lines in the `{/* ── ALTERNATING MODE ── */}` block, and wrap each section's body content in a conditional, following this exact pattern (shown for the first section — apply the identical structural change to all four):

For **Who starts?** (currently):
```tsx
          <div className="popup-section" style={{ marginBottom: 12 }}>
            <div className="popup-section-title">Who starts?</div>
            <div className="resist-row">
              <label>
                <input type="radio" name="firstTurn" value="player"
                  checked={(alt?.firstTurn ?? 'player') === 'player'}
                  onChange={() => setScenario({ alternating: { ...alt, firstTurn: 'player' } })} />
                &nbsp;Player
              </label>
              <label>
                <input type="radio" name="firstTurn" value="enemy"
                  checked={(alt?.firstTurn ?? 'player') === 'enemy'}
                  onChange={() => setScenario({ alternating: { ...alt, firstTurn: 'enemy' } })} />
                &nbsp;Enemy
              </label>
            </div>
          </div>
```
becomes:
```tsx
          <div className="popup-section" style={{ marginBottom: 12 }}>
            <div
              className="popup-section-title"
              role="button"
              tabIndex={0}
              aria-expanded={openSections.firstTurn}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => toggleSection('firstTurn')}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                  e.preventDefault();
                  toggleSection('firstTurn');
                }
              }}
            >
              <span>Who starts?</span>
              <span aria-hidden="true">{openSections.firstTurn ? '▾' : '▸'}</span>
            </div>
            {openSections.firstTurn && (
              <div className="resist-row">
                <label>
                  <input type="radio" name="firstTurn" value="player"
                    checked={(alt?.firstTurn ?? 'player') === 'player'}
                    onChange={() => setScenario({ alternating: { ...alt, firstTurn: 'player' } })} />
                  &nbsp;Player
                </label>
                <label>
                  <input type="radio" name="firstTurn" value="enemy"
                    checked={(alt?.firstTurn ?? 'player') === 'enemy'}
                    onChange={() => setScenario({ alternating: { ...alt, firstTurn: 'enemy' } })} />
                  &nbsp;Enemy
                </label>
              </div>
            )}
          </div>
```

For **Player Turn Order**: change `<div className="popup-section-title">Player Turn Order</div>` to the same header pattern using `openSections.playerTurns` / `toggleSection('playerTurns')` / `<span>Player Turn Order</span>`, and wrap everything between that title and the section's closing `</div>` (the descriptive `<p>`, the `(alt?.playerTurns ?? []).map(...)` block, and the `+ Add Turn` button) in `{openSections.playerTurns && ( <> ... </> )}`.

For **Enemy Turn Sequence**: change `<div className="popup-section-title">Enemy Turn Sequence</div>` to the same header pattern using `openSections.enemyTurns` / `toggleSection('enemyTurns')` / `<span>Enemy Turn Sequence</span>`, and wrap everything between that title and the section's closing `</div>` (the descriptive `<p>`, the `(alt?.enemyTurns ?? []).map(...)` block, and the `+ Add Enemy Turn` button) in `{openSections.enemyTurns && ( <> ... </> )}`.

For **Attack Reactions** (title text is `Enemy Reactions (when player attacks)`): change `<div className="popup-section-title">Enemy Reactions (when player attacks)</div>` to the same header pattern using `openSections.reactions` / `toggleSection('reactions')` / `<span>Enemy Reactions (when player attacks)</span>`, and wrap everything between that title and the section's closing `</div>` (the descriptive `<p>` and the `allReactions.map(...)` block) in `{openSections.reactions && ( <> ... </> )}`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green.

Manually: switch Battle Mode to Alternating. Confirm all four sections start expanded (matching current behavior). Click each section's header (and separately, Tab to each header and press Enter, then Space) and confirm it collapses/expands, and that its ▾/▸ indicator flips. With a section collapsed, confirm the fields inside it are genuinely hidden (not just visually collapsed but still tabbable). Add/remove a player turn, an enemy turn, and toggle an enemy's Retaliates checkbox — confirm all still work exactly as before. Confirm the Puzzle and Guided modes (untouched by this task) still render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/panels/ScenarioPanel.tsx
git commit -m "app: make alternating-mode scenario sections collapsible"
```

---

### Task 4: `AudioPanel.tsx` — categorize the 19 sound-effect slots

**Files:**
- Modify: `src/components/panels/AudioPanel.tsx`

**Interfaces:**
- Consumes: the existing `.section-title`/`.audio-grid` CSS classes (Task 1 styles `.section-title`; no new CSS needed).
- Produces: nothing new.

- [ ] **Step 1: Replace the flat `AUDIO_EVENTS.map(...)` with 6 categorized groups**

Change:

```tsx
      <div className="section-title">Sound Effects</div>
      <div className="audio-grid">
        {AUDIO_EVENTS.map(ev => (
          <div key={ev} className="field">
            <div className="field-label">{EVENT_LABELS[ev] ?? ev}</div>
            <AssetUpload
              label={EVENT_LABELS[ev] ?? ev}
              asset={config.audio.sfxMap[ev] ?? null}
              accept="audio/*"
              roleKey={audioRoleKey(ev)}
              onChange={a => setSfx(ev, a)}
            />
          </div>
        ))}
      </div>
```

to:

```tsx
      {SFX_GROUPS.map(group => (
        <div key={group.label}>
          <div className="section-title">{group.label}</div>
          <div className="audio-grid">
            {group.events.map(ev => (
              <div key={ev} className="field">
                <div className="field-label">{EVENT_LABELS[ev] ?? ev}</div>
                <AssetUpload
                  label={EVENT_LABELS[ev] ?? ev}
                  asset={config.audio.sfxMap[ev] ?? null}
                  accept="audio/*"
                  roleKey={audioRoleKey(ev)}
                  onChange={a => setSfx(ev, a)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
```

Add `SFX_GROUPS` above the `EVENT_LABELS` constant (so it's defined before use). Add, directly above `const EVENT_LABELS: Record<string, string> = {`:

```tsx
const SFX_GROUPS: { label: string; events: AudioEvent[] }[] = [
  { label: 'UI Sounds', events: ['spellbook_open', 'spell_select', 'grid_select'] },
  { label: 'Movement', events: ['walk'] },
  { label: 'Spells', events: ['spell1_shoot', 'spell1_hit', 'spell2_shoot', 'spell2_hit'] },
  { label: 'Player Combat', events: ['player_attack', 'player_ranged_attack', 'player_flying_attack', 'player_death'] },
  { label: 'Enemy Combat', events: ['flying_attack', 'flying_death', 'ranged_attack', 'ranged_death', 'melee_attack', 'melee_death'] },
  { label: 'Other', events: ['fail'] },
];
```

This covers all 19 entries of `AUDIO_EVENTS` (verify against `src/types/battle.ts:199-219` — `spellbook_open, spell_select, walk, grid_select, spell1_shoot, spell1_hit, spell2_shoot, spell2_hit, player_attack, player_ranged_attack, player_flying_attack, player_death, flying_attack, flying_death, ranged_attack, ranged_death, melee_attack, melee_death, fail`); every one appears in exactly one group above.

Since `SFX_GROUPS` now fully replaces the direct `AUDIO_EVENTS.map(...)` call, the `AUDIO_EVENTS` value import is no longer used — only the `AudioEvent` type is needed. Change the existing import line:
```tsx
import { AUDIO_EVENTS } from '../../types/battle';
```
to:
```tsx
import type { AudioEvent } from '../../types/battle';
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` and `npm test -- --run`. Both green. (`tsc` will catch it directly if any event was left out of every group — a leftover reference to the removed `AUDIO_EVENTS` import, or a TS error on `SFX_GROUPS`'s type, would fail the build. As an extra check: count the total events across all 6 groups in `SFX_GROUPS` and confirm it's 19.)

Manually: open Audio, confirm the SFX section now shows 6 labeled groups (UI Sounds, Movement, Spells, Player Combat, Enemy Combat, Other) instead of one flat list, and every one of the 19 slots is present exactly once across the groups. Upload a sound to one slot in each of two different groups and confirm both save correctly.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/AudioPanel.tsx
git commit -m "app: group Audio panel's sound effects into categories"
```

---

### Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check and test suite**

Run: `npx tsc --noEmit` and `npm test -- --run`.
Expected: no errors, all existing tests passing.

- [ ] **Step 2: Full live-browser regression pass**

Start the dev server. Walk through every panel and confirm:
- Colors/fonts (Task 1) look correct and consistent everywhere, not just the panels Tasks 2-4 touched — check Grid, Heroes, Spells, Popups, Store, Backgrounds, Library too, since Task 1 is a global CSS change.
- Units panel: the four field clusters (Task 2) render correctly for both a player and an enemy unit, for both melee/flying (no Projectile Image group) and ranged (with it) unit types.
- Scenario panel: all four Alternating-mode sections (Task 3) collapse/expand correctly via mouse and keyboard, and Puzzle/Guided modes are unaffected.
- Audio panel: all 6 SFX groups (Task 4) render with the correct events in each, and uploading still works.
- Nothing from any earlier accessibility work regressed: unit card keyboard toggle, dialog Escape-close, focus rings, label-click-to-focus.
- Save/Load/Delete a shared template, to confirm the config round-trips through this visual change with no data-shape issues (this plan never touched `battleStore.ts` or any type, so this should be a pure formality, but confirm it).

Report the outcome of each check. If anything regressed, find which task introduced it and fix it there before considering the plan complete.

No commit for this task — it's verification only.
