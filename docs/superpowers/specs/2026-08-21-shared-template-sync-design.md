# Shared Template Sync — Design

**Status:** Proposed.

## Purpose

"Saved Templates" (`TemplateEntry[]` in `battleStore.ts`) are currently
session-only — pure in-memory state, never persisted, lost on refresh. The
UI literally labels the section "Saved templates (this session)". This
means a full battle-scenario savefile (unit placements, AI behavior, spell
setups, etc.) can't be handed off between people the same way assets
already can't be — the exact problem the shared asset library solved for
individual sprites/audio.

This design extends that same shared-sync model to templates: saving a
template publishes it for everyone, and anyone who opens the editor sees
the current shared template list, matching the existing "upload an asset,
it's there for the next person" behavior.

## Background

- A `BattleConfig` embeds every asset slot's full data directly
  (`AssetData { dataUri, mimeType, fileName }`) — never a reference to a
  library asset. This is why the 4 bundled templates in `public/templates/`
  are 2–3.5MB each even though most of their art is byte-identical to art
  already in the shared library (confirmed in the original asset-library
  design doc). Syncing templates the same way assets are synced (whole
  file, embedded data) would make the shared repo balloon by multiple MB
  per saved template.
- `AssetUpload.tsx`/`battleStore.ts`/`resolveDefaults.ts` already know the
  originating `LibraryAsset.id` at all three points a slot's asset gets
  set (fresh upload, library-picker pick, auto-default fill) — that id
  just isn't currently kept on the slot.
- The Cloudflare Worker (`worker/`) already has a proven fetch→merge→
  commit→retry-on-conflict pipeline against the GitHub Git Data API, a
  passphrase gate, and CORS locked to the GitHub Pages origin. This design
  reuses that Worker and its patterns rather than standing up anything new.
- Assets are small (tens of KB) and cheap to eager-fetch in full at
  startup. Templates, even slimmed, are structural JSON (positions, names,
  AI settings, numeric fields) — expected to land in the tens of KB range
  per template, same order of magnitude as assets, so the same eager-fetch
  approach applies without a lazy-loading scheme.

## Data model changes

### `src/types/battle.ts`

- `AssetData` gains one new optional field: `libraryAssetId?: string`.
  Populated whenever a slot's asset is set from a known library asset
  (upload, library-picker selection, or `resolveDefaults` auto-fill).
  Absent only for a slot that somehow never got tied to a library entry.

### `src/utils/templateSlim.ts` (new)

Two pure functions, reusing the same asset-slot walk already established
in `resolveDefaults.ts`/`roleKeys.ts`:

- `slimTemplate(config: BattleConfig, library: LibraryAsset[]): unknown` —
  walks every asset slot; if the slot's `libraryAssetId` matches an id
  present in `library`, replaces it with `{ libraryAssetId }` (a few
  bytes); otherwise keeps the full embedded `AssetData` as a fallback (so
  a genuinely one-off, not-yet-synced asset is never silently dropped).
  Output is a plain JSON-serializable value, not typed as `BattleConfig`,
  since slimmed slots don't carry `dataUri`.
- `hydrateTemplate(slim: unknown, library: LibraryAsset[], roleDefaults: RoleDefaults): BattleConfig` —
  reverses the transform: resolves each `{ libraryAssetId }` slot back to
  its full `AssetData` from `library`. Immediately runs the existing
  `resolveDefaults(config, roleDefaults, library)` over the result, so any
  slot whose reference is missing (broken link, asset never synced) falls
  back through the same gap-filling safety net a brand-new project already
  gets — never a hard failure, just a default/placeholder in that slot.

## Storage & Worker changes

One new file, `public/templates/shared-templates.json`, an array of
`{ name: string, savedAt: number, config: unknown /* slim */ }` —
structurally the same pattern as `library.json`, but supporting
upsert-by-name and delete instead of append-only growth.

Per-template-file + manifest storage (mirroring `library.json` +
`role-defaults.json`'s split) was considered and rejected: that split
only earns its cost at multi-MB sizes, and slimming already keeps
templates in the same small-file regime as assets, so a single JSON array
is simpler and reuses more of the existing, already-tested merge logic.

### `worker/src/merge.ts`

Two new functions alongside the existing `mergeLibrary`/`mergeRoleDefaults`:

- `upsertSharedTemplate(currentJson, name, savedAt, config)` — replaces
  the entry with an exact, case-sensitive `name` match if one exists
  (including its `savedAt`), otherwise appends a new entry.
- `removeSharedTemplate(currentJson, name)` — filters out the entry with
  that `name`.

### `worker/src/publish.ts`

Two new functions, `publishTemplateToGithub(cfg, name, savedAt, config)`
and `deleteTemplateFromGithub(cfg, name)`, following the exact same
fetch-ref → fetch-tree → fetch-blob → merge → create-blob → create-tree →
create-commit → update-ref pattern as `publishAssetToGithub`, retried up
to 3 attempts with a fresh re-read on each attempt — just operating on the
single `shared-templates.json` blob instead of two blobs.

### `worker/src/index.ts`

Two new routes on the same Worker, branching on `new URL(request.url).pathname`:

- `POST /publish-template` — body `{ passphrase, name, config }`.
- `POST /delete-template` — body `{ passphrase, name }`.

Both reuse the existing passphrase check, CORS headers (including the
`OPTIONS` preflight handling), and origin allowlist. The existing root
`/` asset-publish endpoint and its behavior are unchanged.

## App-side integration

- `battleStore.ts`: the current in-memory `templates: TemplateEntry[]` is
  replaced by `sharedTemplates: SharedTemplateEntry[]`
  (`{ name, savedAt, config: BattleConfig }`, already hydrated), fetched
  in full at startup alongside the asset library (extends the existing
  `initLibrary` flow, or a sibling `initSharedTemplates` called at the
  same point).
- `saveTemplate(name)` — slims the current config via `slimTemplate`,
  updates local state immediately (optimistic, matching the asset-upload
  UX), fires `POST /publish-template` in the background. On failure, uses
  the same `pendingPublishes`-style retry bookkeeping and "not yet synced
  — Retry" affordance already built for assets, including retry-on-load.
- `deleteTemplate(name)` — removes locally immediately, fires
  `POST /delete-template` in the background with the same retry pattern.
- `loadTemplate(name)` — the entry is already hydrated in local state
  (hydration happens once, at fetch time), so loading just applies it to
  `config` like today.
- `TemplatesModal.tsx` — the "Saved templates (this session)" section
  becomes "Shared templates"; the session caveat no longer applies. Save/
  Load/Delete wire to the new store actions above. The "Built-in
  templates" section (the 4 bundled `public/templates/*.json` files) and
  the "JSON config file" Export/Import buttons are untouched — both
  already produce/consume fully self-contained configs and are unrelated
  to this sync feature.

## Error handling / edge cases

- Conflict retry: identical to the asset Worker's 3-attempt, fresh-re-read
  pattern — no new logic, same proven code shape.
- Missing/broken `libraryAssetId` reference on load: handled by
  `resolveDefaults`'s existing gap-filling, never a hard failure.
- Passphrase remains a deterrent, not real authentication — same accepted
  limitation as the asset library, not revisited here.

## Known limitations (accepted, not blocking)

- No rename — renaming a shared template requires deleting the old name
  and saving under the new one.
- No private/local-only template tier — every save is shared, matching
  how asset uploads already work.
- No version history — overwriting a shared template by name is
  destructive; the previous version is not recoverable through the app.

## Out of scope

- Any change to the 4 bundled "Built-in templates" or the local JSON
  Export/Import flow.
- Deleting/pruning old library assets (already out of scope from the
  original asset-library design).
- Real user authentication for either Worker endpoint.
