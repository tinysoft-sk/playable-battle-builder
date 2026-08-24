# Visual & Layout Redesign — Design

**Status:** Approved (iterated live against the running editor, not on static mockups).

## Purpose

The Battle Editor Audit (published as an Artifact earlier this session) flagged the editor's visual identity as generic (system-ui only, one accent color, low-contrast dark surfaces that don't visually separate) and its information architecture as flat in several places (dense panels with no sub-grouping or progressive disclosure). This design fixes both, informed by hands-on feedback: "very dark, low contrast, hard to navigate."

## Process note

This was designed by injecting a live, switchable CSS override directly into the running dev server (a temporary `public/ui-variant-preview.js`, never committed) and iterating three rounds against the user's direct reactions, rather than static mockups. The values below are the final approved state from that process. That preview mechanism has been discarded; this plan re-implements the same result as real source changes.

## Color

The palette moves from near-black navy to a lighter slate-navy, still a dark theme (not full light mode — not requested), with a monotonic lightness ramp so "more nested" reliably reads as "lighter":

| Token | Old | New |
|---|---|---|
| `--bg` (page floor) | `#1a1a2e` | `#232a45` |
| `--surface` (cards, sections) | `#16213e` | `#2f3a5f` |
| `--surface2` (raised: card headers, nav-active) | `#0f3460` | `#3d4a78` |
| `--border` | `#2a2a4a` | `#5a6ba0` |
| `--text` | `#eaeaea` | `#f7f8fc` |
| `--text-muted` | `#888` | `#c7cee0` |
| `--accent` (primary CTA, unchanged) | `#e94560` | `#e94560` |
| new: `--accent2` (structural/secondary — section titles, hover states) | — | `#4ecdc4` |

Additional structural color moves, not expressible as simple token swaps:
- Chrome (`.app-header`, `.app-nav`, dialog toolbars) gets its own darker tone (`#1b2038`) distinct from content surfaces (`--surface`), so persistent UI reads as a frame around the content rather than blending into it.
- Every top-level container (`.popup-section`, `.unit-card`, `.fail-card`, `.ret-card`) gets a real, visible border (`--border`, not the old near-invisible `#2a2a4a`-on-`#16213e` pairing) plus a 3px left accent stripe (`#7c93d6`) so the eye can anchor "a section starts here."
- Inputs sit in a well one step darker than their card (`#1b2038` on a `--surface` card), reinforcing "recessed = editable, raised = container."

## Typography

Currently the entire app is `system-ui` at two weights (400/600). New pairing, three roles:

- **Display** (used sparingly — panel titles, section titles, unit-card titles, dialog `<h2>`s): **Sora**, 600–700 weight. More character than the generic Inter/Space Grotesk default, reads well at the sizes this app uses for headings.
- **Body** (labels, buttons, running text, form inputs): **IBM Plex Sans**, 400/500/600. Built for dense technical UI, wide weight range gives real hierarchy without everything being bold-or-not.
- **Numeric/utility** (every `<input type="number">`, the Fail ID badge, step-order numbers, network-size byte comparisons): **IBM Plex Mono** with `font-variant-numeric: tabular-nums`, so columns of digits (HP, damage, grid coordinates) actually align — this also closes a Minor finding from the original Web Interface Guidelines audit.

Loaded via a Google Fonts `<link>` in `index.html` (`Sora:wght@600;700`, `IBM+Plex+Sans:wght@400;500;600`, `IBM+Plex+Mono:wght@400;500;600`).

## Layout & grouping

Three panels get restructured; nothing else changes shape.

### `UnitsPanel.tsx`

Each unit card's body is currently one flat list of 11 fields. Split into four labeled clusters, in this order, each using the existing `.section-title` treatment as a sub-heading within the card:
1. **Identity** — Name, Type
2. **Combat** — HP, Base Damage, Defense, Dmg Multiplier, Resist To
3. **Position & Size** — Grid Col, Grid Row, Display Width, Move Range
4. **Art** — Idle Image, Attack Image, (Projectile Image, if ranged)

No field is added, removed, or renamed — purely a visual regrouping of the existing fields.

### `ScenarioPanel.tsx` (Alternating mode)

The four `.popup-section` blocks (Who starts?, Player Turn Order, Enemy Turn Sequence, Attack Reactions) are currently always fully expanded — the longest continuous scroll in the app. Each becomes independently collapsible, using the same interaction pattern already established for unit cards elsewhere in this app (clickable header with `role="button"`, `tabIndex={0}`, `aria-expanded`, `onKeyDown` handling Enter/Space) — consistent with the app's existing accessibility work, not a new pattern. Default state: all four start expanded (matching current behavior on first load), so nothing appears different until a user actually collapses one.

### `AudioPanel.tsx`

The 19 sound-effect slots (`AUDIO_EVENTS`) are currently one flat 2-column grid. Grouped under sub-headings (same `.section-title` treatment), in this order:
1. **UI Sounds** — spellbook_open, spell_select, grid_select
2. **Movement** — walk
3. **Spells** — spell1_shoot, spell1_hit, spell2_shoot, spell2_hit
4. **Player Combat** — player_attack, player_ranged_attack, player_flying_attack, player_death
5. **Enemy Combat** — flying_attack, flying_death, ranged_attack, ranged_death, melee_attack, melee_death
6. **Other** — fail

Every event's own upload slot, label text, and role-key wiring stays exactly as-is — only the grouping/headings are new.

## Out of scope

- A light-mode theme (explicitly declined — dark, just lighter).
- Any change to Store/Grid/Hero/Popups/Spells/Backgrounds panels' layout — these were already reasonably grouped per the earlier audit.
- Any change to icons (still emoji) — not raised in this pass.
- Any change to the exported playable's own visual design — this is the editor tool's UI only.
