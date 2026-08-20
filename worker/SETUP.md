# Asset-Sync Worker — Setup

## 1. Create a disposable test GitHub repo

Create a new, empty public repo under your own account (not the company
org) — e.g. `your-username/asset-sync-worker-test`. Add two files at these
exact paths, matching the real editor's shape:

`public/library/library.json`:
```json
[]
```

`public/library/role-defaults.json`:
```json
{}
```

Commit both to `main`.

## 2. Generate a GitHub token for the test repo

GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token.

- Repository access: **Only select repositories** → pick your test repo.
- Permissions → Repository permissions → **Contents: Read and write**.
- Set an expiration (30 days is plenty for testing).

Copy the token now — GitHub only shows it once.

## Windows / PowerShell notes (learned the hard way during testing)

- PowerShell blocks `npx` (a `.ps1` script) by default. Use `npx.cmd`
  instead of `npx` for every command below — same behavior, no execution
  policy to change.
- **Always `cd` into `worker/` first.** Running any `wrangler` command
  from the wrong directory fails with `Required Worker name missing`
  because it can't find `wrangler.toml`.
- **Don't paste secret values into the interactive `wrangler secret put`
  prompt** — for long values (like a ~90-character GitHub token) it can
  silently corrupt the paste, character-by-character, with no error and
  no way to tell from the "Success!" message that anything went wrong.
  Pipe the value in instead, which sends it as one write instead of
  simulated keystrokes:
  ```powershell
  echo 'PASTE_VALUE_HERE' | npx.cmd wrangler secret put SECRET_NAME
  ```
  This confirmed reliable in testing; the interactive prompt did not.

## 3. Log in to Cloudflare

From `worker/`:
```powershell
npx.cmd wrangler login
```
Opens a browser window to authorize `wrangler` against your Cloudflare
account. (Also happens automatically the first time you run any command
that needs it, e.g. the secret commands below.)

## 4. Point `wrangler.toml` at the test repo

Edit `worker/wrangler.toml`, replacing the placeholders:
```toml
[vars]
GITHUB_OWNER = "your-username"
GITHUB_REPO = "asset-sync-worker-test"
GITHUB_BRANCH = "main"
```

## 5. Set the secrets

From `worker/`:
```powershell
echo 'PASTE_YOUR_GITHUB_TOKEN_HERE' | npx.cmd wrangler secret put GITHUB_TOKEN
echo 'choose-any-shared-secret-string' | npx.cmd wrangler secret put PUBLISH_PASSPHRASE
```

If a publish request later fails with a 401 from GitHub specifically
(check with `npx.cmd wrangler tail` while re-sending the request — it'll
say `getRefSha failed: 401`), the token value itself is suspect first:
confirm it's valid by testing it directly against GitHub's API,
independent of the Worker:
```powershell
curl.exe -H "Authorization: Bearer PASTE_TOKEN_HERE" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/OWNER/REPO"
```
Real repo JSON back → the token's fine, re-set the Cloudflare secret
(piped, not interactive). A 401 here too → the token itself is bad,
fix it at the GitHub end before touching wrangler again.

## 6. Deploy

```powershell
npx.cmd wrangler deploy
```
First deploy asks you to pick a `workers.dev` subdomain (a one-time,
account-wide choice — not specific to this Worker) if you haven't
already got one; any lowercase name works.

Wrangler prints the deployed Worker's URL
(`https://playable-battle-builder-asset-sync.<your-subdomain>.workers.dev`)
— save it, it's needed for live verification (Task 8) and for the real
app's env vars later (Task 9).

## Verifying a publish actually landed

`raw.githubusercontent.com` is CDN-cached and can lag a few minutes
behind a real commit — don't trust it alone to judge whether something
worked. To see the true current state, use the GitHub API directly:
```powershell
curl.exe "https://api.github.com/repos/OWNER/REPO/contents/public/library/library.json?ref=main" -H "Accept: application/vnd.github.raw+json"
```
or check the commit history:
```powershell
curl.exe "https://api.github.com/repos/OWNER/REPO/commits?per_page=10"
```

## Production configuration (already done, documented for future reference)

The Worker is deployed pointing at the real repo (`tinysoft-sk/playable-battle-builder`), not the test repo from the steps above. Two things to know if you ever touch this again:

- **Two GitHub Actions repository secrets** exist on `tinysoft-sk/playable-battle-builder` (Settings → Secrets and variables → Actions): `ASSET_SYNC_WORKER_URL` (the deployed Worker's URL) and `ASSET_SYNC_PASSPHRASE` (must match the Cloudflare `PUBLISH_PASSPHRASE` secret exactly). These are wired into `.github/workflows/deploy.yml`'s build step as `VITE_LIBRARY_WORKER_URL`/`VITE_LIBRARY_PUBLISH_PASSPHRASE`, since Vite bakes `import.meta.env.VITE_*` values in at build time.
- **The passphrase lives in two places that must be changed together.** Rotating it means updating the Cloudflare secret (`wrangler secret put PUBLISH_PASSPHRASE`, piped, not the interactive prompt) AND the `ASSET_SYNC_PASSPHRASE` GitHub Actions secret, then re-running the Pages deploy. Doing only one silently breaks every publish with a 401 and no server-side alarm.
- **The production GitHub token has an expiration date.** When it expires, publishing dies silently (users only see a retry banner in the Library panel). Note who generated it and when it expires so it can be rotated before that happens.
