# Shared Asset Library & Role Defaults — Design

**Status:** Proposed.

## Purpose

Every new person who gets this repo starts with an empty Asset Library and
blank unit/spell/hero/UI art, and has to manually re-source and re-upload
sprites, projectiles, and audio that are already "standard" across the
team's playables. This repeats for every new person and every new project.

This design bakes a **shared, auto-syncing asset library** into the repo so
that: (1) the library is pre-populated for anyone who opens the editor, (2)
a new (or renamed) unit/spell/etc. automatically uses the current default
art for its name, and (3) an exported playable can never ship with a
genuinely missing sprite.

## Background

- `AssetUpload.tsx` encodes an uploaded file to a data URI (`encodeFile` in
  `assetEncoder.ts`) and calls `onChange`. A 💾 button lets the user
  manually save that asset to a "library" (`addToLibrary` in
  `battleStore.ts`), which is persisted only to `localStorage`
  (`battle-editor-library` key) — per-browser, never shared, never
  committed.
- `DEFAULT_CONFIG` (`battleStore.ts`) already ships with named-but-blank
  slots — player unit "Frostwolf", enemies "Valkyrie"/"Armored Giant",
  spells "Fireball"/"Ice Shard" — every asset field `null`.
- The 4 bundled templates (`public/templates/*.json`) already embed real
  production art as base64 data URIs, and reuse **byte-identical** art
  across templates under matching unit/spell names (confirmed: "Archer",
  "Hugo", "Efreet", "HellFire", "Imp"/"Imp2"/"Imp3" all match exactly
  across the templates that use them). Using a unit/spell's name as a
  stable "role" key already reflects how the team works informally today.
- The app is a static Vite/React SPA with no backend, deployed to GitHub
  Pages by `.github/workflows/deploy.yml` on every push to `main`.
- **Distribution:** the hosted GitHub Pages URL is the primary way
  non-technical teammates use the editor — open a link, no git/Node/clone
  required, and it's always current within a redeploy cycle (~1–2 minutes)
  of a publish. `run-editor.bat` / `.claude/launch.json` remain purely a
  local dev convenience (this repo's own contributors iterating on the
  editor's code), not a distribution mechanism for end users of the tool.

## Data model changes

### `src/types/battle.ts`

- New type `RoleDefaults = Record<string, string>` — maps a **role key**
  to a library asset's `id`.

### `src/store/battleStore.ts`

- New store state: `roleDefaults: RoleDefaults` (alongside the existing
  `library: LibraryAsset[]`).
- New role-key resolver, one key per asset slot in the whole config:
  - Unit sprite: `` unit:{idle|attack|projectile}:{name.trim().toLowerCase()} ``
  - Spell asset: `` spell:{asset|projectileAsset}:{name.trim().toLowerCase()} ``
  - Hero portrait: `hero:heroLeft` / `hero:heroRight`
  - Popup art: `` popup:{victory.banner|victory.board|victory.cta|defeat.banner|defeat.board|defeat.retry|defeat.store} ``
  - Background: `background:landscape` / `background:portrait`
  - UI asset: `` ui:{spellbookClosed|spellbookOpen|meleeIcon|rangedIcon|flyingIcon|rangedProjectile} ``
  - Grid tile: `gridTile:walkable` / `gridTile:active`
  - App icon: `appIcon`
  - Audio: `` audio:{AudioEvent} `` / `audio:music`

  Unit/spell keys are derived from their own free-text `name` field (no new
  UI field). Everything else uses its fixed schema path, which is stable by
  construction.
- New actions:
  - `setRoleDefault(roleKey, assetId)` — local state update.
  - `resolveAsset(roleKey): AssetData | null` — looks up the current
    default for a role key via `roleDefaults` → `library`.
  - `publishAsset(roleKey, asset)` — fire-and-forget sync to the shared
    repo copy (see **Auto-publish sync bridge** below).

## Auto-save + role-default on upload

`AssetUpload.tsx` gains an optional `roleKey?: string` prop. Every panel
that renders it for a role-eligible slot (Units, Spells, Hero, Popups,
Background, Grid, Audio) computes and passes the relevant key.

On a **fresh file upload** (not a library-picker selection, which already
points at an existing library entry):

1. Add the asset to `library` and set it as `roleDefaults[roleKey]`,
   locally and immediately — the uploader's own editor uses it right away,
   offline-safe.
2. Call `publishAsset(roleKey, asset)` in the background.

The previous default for that role key is never deleted — it stays in
`library`, just no longer pointed to, so it's still pickable via the
📚 Library picker.

## Resolving defaults into a config

New pure utility, `resolveDefaults(config, roleDefaults, library): BattleConfig`,
walks every asset slot in a config and fills any `null` slot whose role key
has a match in `roleDefaults`. It never overwrites a slot that already has
an asset.

Called in two places:

1. **App startup** — applied to `DEFAULT_CONFIG` right after the shared
   library loads, so a brand-new project starts populated instead of blank
   (this is what makes a separate "Default Starter" template unnecessary —
   the existing default project, once resolved, already does the job).
2. **`ExportDialog.tsx`** — applied to a non-persisted copy of the current
   project's config immediately before `generateHtml(config)` runs, so
   export always fills any remaining gaps without silently changing what's
   shown in the editor.

Because `resolveDefaults` only ever fills `null` slots, it is also safe to
re-run whenever a unit/spell is renamed or created — if the new name
matches a role with defaults and the slot is still empty, it fills in; if
the unit already has art assigned, renaming never touches it. (Every
config-mutating store action re-runs it for exactly this reason —
otherwise renaming a second "Archer" after uploading art for a first one
would set `roleDefaults` correctly but never surface it.)

**Important:** the placeholder-fallback tier below must NOT be part of
this editor-facing resolution — see below.

## Bundled fallback assets (last resort)

A new `src/assets/defaults/` folder holds a handful of generic placeholder
images, imported at build time (e.g. `placeholder-unit-idle.png`,
`placeholder-unit-attack.png`, `placeholder-projectile.png`,
`placeholder-icon.png`) — **not** part of the git-synced library.

`resolveDefaults` falls back to these, keyed by asset *kind*, only when no
`roleDefaults` entry exists at all for that role key — i.e. a genuinely new
name nobody has ever uploaded art for. This guarantees an exported playable
never has a literally missing image. Audio slots have no bundled fallback;
a missing sound stays silent rather than being faked.

**This tier is export-only.** `resolveDefaults` takes a 4th parameter,
`includePlaceholders` (default `false`), gating the placeholder tier
specifically. Every editor-facing call (app startup, and every unit/spell
create-or-rename per the section above) uses the default `false` — an
unmatched slot stays genuinely `null` ("no art yet"), which is what keeps
it eligible for a real default to fill in later. Only the export-time
call (`ExportDialog.tsx`) passes `true`. Applying the placeholder tier to
the live editor's own state was tried and found to break the rename-
triggers-autofill behavior above: a placeholder is a real, non-null
`AssetData`, so once one lands in a slot at startup or creation,
`resolveDefaults`'s own "never overwrite a filled slot" rule permanently
blocks a later real default from ever reaching it.

## Fetching the shared library on load

`public/library/library.json` (the asset list) and
`public/library/role-defaults.json` (the role-key map) live alongside
`public/templates/*.json` and follow the same shape/convention. They're
fetched once at store initialization and merged into local state: the
committed data is the baseline, and any local-only entries left over from a
previously failed publish are layered on top and retried (see below).

## Auto-publish sync bridge

### Cloudflare Worker (new — lives outside this app, e.g. a `worker/`
directory or its own small repo)

- Single endpoint, `POST /publish`.
- Body: `{ passphrase, roleKey, asset: { id, dataUri, mimeType, fileName } }`.
- Rejects with 401 if `passphrase` doesn't match a Worker secret.
- Fetches the current `public/library/library.json` and
  `public/library/role-defaults.json` via the GitHub Contents API (with
  their current `sha`), merges in the new asset + role-default mapping,
  and commits both back via the Contents API `PUT`.
- On a 409 (stale `sha` — a concurrent publish landed first), re-fetches
  and retries, up to 3 attempts with a short backoff.
- Holds a GitHub Personal Access Token (scoped to just this repo's
  contents) as a Worker secret — it is never sent to or stored in the
  browser.
- A commit to `main` triggers the existing `deploy.yml` automatically, so
  both "next person runs `git pull`" and "next person opens the deployed
  site" pick up the change without any extra step.

### App-side integration

- Two build-time env vars: `VITE_LIBRARY_WORKER_URL` and
  `VITE_LIBRARY_PUBLISH_PASSPHRASE` (documented in a new `.env.example`).
- `publishAsset` tracks per-asset sync status (`syncing | synced | failed`)
  in store state. The asset is already usable locally regardless of this
  status.
- On failure, the asset is flagged `failed` with a small retry affordance
  in the Library panel (e.g. "2 uploads not yet synced — Retry"). Failed
  entries also auto-retry once on the next app load.

## Known limitations (accepted, not blocking)

- The passphrase is visible in the built client bundle — it's a deterrent
  against random passersby on the public GitHub Pages URL, not real
  authentication. Documented as-is; real auth is out of scope.
- `library.json` grows monotonically (old superseded defaults are never
  pruned). Acceptable for now; revisit if it becomes a real size problem.

## Out of scope

- Deleting/pruning old library assets.
- Real user authentication for the publish endpoint.
- Auto-defaulting anything outside the role-key scheme above.
- The flying-unit attack animation/positioning project discussed earlier
  in this session — separate spec, not started.
