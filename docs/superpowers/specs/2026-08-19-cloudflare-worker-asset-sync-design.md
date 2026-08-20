# Cloudflare Worker Asset-Sync Bridge — Design

**Status:** Proposed.

## Purpose

The app-side shared asset library (see
`docs/superpowers/specs/2026-08-18-shared-asset-library-design.md`) is fully
built and working, but every "publish" call is currently a harmless local
no-op — nothing actually reaches the shared repo, so uploads never leave
the uploader's own browser. This design builds the missing piece: a small
Cloudflare Worker that receives a publish call from the editor and commits
the result to `tinysoft-sk/playable-battle-builder` for real, so an asset
one person uploads is visible to the next person who opens the editor.

Template/scenario sharing (making "Saved Templates" carry over between
users, not just assets) is an explicit follow-up, out of scope here — see
"Out of scope" below.

## Background

- The existing design already specifies the shape of this bridge: a single
  `POST /publish` endpoint, a shared passphrase, and committing
  `public/library/library.json` + `public/library/role-defaults.json` via
  GitHub's API. The client side (`publishAsset` in
  `src/store/battleStore.ts`) already calls this exact contract — it's
  been dormant since `VITE_LIBRARY_WORKER_URL` has never been set.
- **What's changed since that design was written:** the seeded
  `library.json` is already ~4.5MB, and one individual asset inside it
  (a music track) is already ~2MB on its own. GitHub's Contents API — the
  simple "read/write one whole file" endpoint the original design assumed
  — only handles file content up to ~1MB in either direction (both
  reading and writing). That rules out the Contents API entirely, not
  just for the writes the original design worried about.
- **The fix:** use GitHub's Git Data API instead — the lower-level API
  that manages blobs, trees, commits, and refs directly. A blob (a single
  file's raw content) has no practical size limit here (GitHub's git
  blob ceiling is ~100MB). This changes nothing about the file layout
  (`library.json` / `role-defaults.json` stay exactly as they are) or how
  the editor reads them (still a plain `fetch()` of a static file, which
  was never subject to the Contents API's limit in the first place) — it
  only changes how the *Worker* talks to GitHub.
- The app is deployed via `.github/workflows/deploy.yml` on every push to
  `main`, so a commit landing via this Worker triggers an automatic
  redeploy — both "someone runs `git pull` locally" and "someone opens
  the live site" pick up a publish within one redeploy cycle.

## Architecture

```
Editor (browser)
  → POST {WORKER_URL}  { passphrase, roleKey, asset }
      ↓
Cloudflare Worker
  1. Check passphrase → 401 if wrong
  2. Read current library.json + role-defaults.json content + their blob SHAs
     (via the repo's current commit tree, recursively)
  3. Merge in the new asset (+ role-default pointer, if roleKey given)
  4. Create a new blob for each changed file
  5. Create a new tree referencing the new blob(s), based on the current tree
  6. Create a new commit on top of the current HEAD
  7. Move the branch ref to the new commit
     — on conflict (ref moved since step 2), re-read and retry, up to 3 times
      ↓
GitHub repo (tinysoft-sk/playable-battle-builder)
  → new commit on main
      ↓
.github/workflows/deploy.yml (already exists, unchanged)
  → redeploys GitHub Pages
```

## Worker endpoint contract (unchanged from the existing client code)

`POST /publish`

```json
{
  "passphrase": "string",
  "roleKey": "string | null",
  "asset": { "id": "string", "dataUri": "string", "mimeType": "string", "fileName": "string" }
}
```

- Passphrase mismatch → `401`.
- Success → `200`.
- Any other failure (GitHub API error after retries exhausted, malformed
  request) → non-2xx. The client already treats any non-`ok` response as
  "publish failed," marks the upload `pending`/`failed`, and offers a
  retry — no client changes needed for this.

## GitHub Git Data API calls the Worker makes

All calls authenticate with a single fine-grained Personal Access Token
(repo-scoped, Contents: Read and write), held as a Cloudflare Worker
secret — never sent to or visible from the browser.

1. `GET /repos/{owner}/{repo}/git/refs/heads/{branch}` — current commit SHA.
2. `GET /repos/{owner}/{repo}/git/trees/{commit_sha}?recursive=1` — find
   the blob SHAs for `public/library/library.json` and
   `public/library/role-defaults.json`.
3. `GET /repos/{owner}/{repo}/git/blobs/{blob_sha}` (once per file) —
   full base64 content, decoded and JSON-parsed by the Worker.
4. Merge: push the new asset object into the `library.json` array; if
   `roleKey` is present, set `role-defaults[roleKey] = asset.id`. (Same
   merge semantics as the existing design — first-class dedup by `id`,
   nothing pruned.)
5. `POST /repos/{owner}/{repo}/git/blobs` — one call per changed file,
   with the new full JSON content, `encoding: "utf-8"`.
6. `POST /repos/{owner}/{repo}/git/trees` — `base_tree` set to the tree
   from step 2, with the changed file(s) pointed at their new blob SHAs
   from step 5.
7. `POST /repos/{owner}/{repo}/git/commits` — new commit, `tree` from
   step 6, `parents: [current_commit_sha]`, a fixed message (e.g.
   `chore: publish asset via editor`).
8. `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}` — `sha` set to
   the new commit from step 7, `force: false` (so a genuine conflict is
   rejected, not silently overwritten).
9. If step 8 returns a conflict (the ref moved since step 1), start over
   from step 1 with a short backoff, up to 3 total attempts. On the 3rd
   failure, return a non-2xx to the client — the client's existing
   retry-banner UI (already built, Task 15 of the asset-library plan)
   handles it from there.

## Cloudflare Worker configuration

- **Secrets** (`wrangler secret put`, never committed): `GITHUB_TOKEN`,
  `PUBLISH_PASSPHRASE`.
- **Vars** (plain config, safe to commit in `wrangler.toml`):
  `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` — this is what makes
  pointing the same code at a throwaway test repo first, then the real
  repo later, a config change rather than a code change.
- **Deployment:** `wrangler deploy` from the Worker's own project
  directory (a new, separate small project — not part of the
  `playable-battle-builder` Vite app's build).

## Testing plan

1. Build and deploy the Worker against a disposable test GitHub repo
   (created fresh, a couple of placeholder `library.json`/
   `role-defaults.json` files seeded in matching the real shape).
2. Verify the full loop by hand: `curl`/Postman a `POST /publish` call
   directly at the deployed Worker URL, confirm a real commit appears in
   the test repo with the expected merge applied.
3. Verify the retry-on-conflict path deliberately: fire two overlapping
   publish calls, confirm both eventually land as two separate commits
   (not one clobbering the other, not a crash).
4. Only once both are solid: point `GITHUB_OWNER`/`GITHUB_REPO` at
   `tinysoft-sk`/`playable-battle-builder`, redeploy the Worker, and set
   `VITE_LIBRARY_WORKER_URL` / `VITE_LIBRARY_PUBLISH_PASSPHRASE` in the
   editor's real build so the app-side code (already built, dormant since
   Task 6) starts actually publishing for real.

## Known limitations (accepted, carried over from the original design)

- The passphrase is a deterrent against casual misuse of the public
  GitHub Pages URL, not real authentication.
- `library.json` grows monotonically — nothing here prunes old,
  superseded assets. Still an accepted future concern, unchanged from
  the original design.

## Out of scope

- Making "Saved Templates" shared/synced between users — a real,
  currently-unaddressed gap (templates today live only in memory, not
  even persisted to the uploader's own browser), but a distinct piece of
  client-side work layered on top of this Worker. Follow-up design, not
  part of this one.
- Real user authentication.
- Pruning old library assets.
