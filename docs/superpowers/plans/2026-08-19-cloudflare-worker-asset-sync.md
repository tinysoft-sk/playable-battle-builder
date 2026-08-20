# Cloudflare Worker Asset-Sync Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Tasks 7-9 are the exception — see the note at the top of each: they require a human's live Cloudflare/GitHub credentials and cannot be dispatched to a blind subagent. The controller runs those directly with the human, not through the normal per-task dispatch loop.**

**Goal:** Build the Cloudflare Worker that receives a publish call from the
editor and commits the result to the shared GitHub repo for real, turning
the app-side asset library's currently-dormant "publish" call into an
actual working sync.

**Architecture:** A small, separate Cloudflare Worker project (`worker/`
at the repo root, not part of the Vite app's build) exposing one `POST
/publish` endpoint. It uses GitHub's Git Data API (blob → tree → commit →
ref) rather than the Contents API, since the seeded library already
contains a single asset (~2MB) that exceeds the Contents API's ~1MB
ceiling. Pure JSON-merge logic is isolated into its own testable module;
the GitHub API calls are thin, individually-testable wrappers; retry-on-
conflict lives in an orchestration layer between them.

**Tech Stack:** TypeScript, Cloudflare Workers (`wrangler`), Vitest for
unit tests (mocked `fetch`, no live network in tests).

## Global Constraints

- The Worker's request/response contract is already fixed by the existing
  client code (`publishAsset` in `src/store/battleStore.ts`, already
  built and merged): `POST` body `{ passphrase, roleKey, asset: { id,
  dataUri, mimeType, fileName } }`; the client only checks `res.ok`, so
  any 2xx means success and any non-2xx means failure — exact status
  codes beyond that distinction are this plan's own choice, not
  externally constrained.
- File paths committed to are fixed by the existing app: `public/library/library.json`
  and `public/library/role-defaults.json`.
- Never use the GitHub Contents API for reading or writing these files —
  both directions are size-limited (~1MB) and the seeded library already
  exceeds that on a single asset. Always use the Git Data API (refs,
  trees, blobs, commits) instead.
- `GITHUB_TOKEN` and `PUBLISH_PASSPHRASE` are Cloudflare Worker **secrets**
  (`wrangler secret put`) — never written to any committed file, never
  logged, never returned in a response body.
- The Worker is tested against a disposable throwaway GitHub repo first;
  only Task 9 points it at the real `tinysoft-sk/playable-battle-builder`.

---

### Task 1: Scaffold the Worker project

**Files:**
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/tsconfig.json`
- Create: `worker/vitest.config.ts`
- Create: `worker/.gitignore`
- Create: `worker/.dev.vars.example`

**Interfaces:**
- Produces: a `worker/` directory with its own independent Node project
  (own `package.json`, own `node_modules`), never built or imported by
  the main Vite app.

- [ ] **Step 1: Create the directory and `package.json`**

Create `worker/package.json`:

```json
{
  "name": "asset-sync-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Install dependencies**

Run, from inside `worker/`:

```bash
npm install -D wrangler @cloudflare/workers-types typescript vitest
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create `wrangler.toml`**

```toml
name = "playable-battle-builder-asset-sync"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
GITHUB_OWNER = "REPLACE_ME_TEST_OWNER"
GITHUB_REPO = "REPLACE_ME_TEST_REPO"
GITHUB_BRANCH = "main"

# Secrets are NOT set here — set them with:
#   wrangler secret put GITHUB_TOKEN
#   wrangler secret put PUBLISH_PASSPHRASE
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules/
.wrangler/
.dev.vars
```

- [ ] **Step 7: Create `.dev.vars.example`**

```
GITHUB_TOKEN=your-fine-grained-pat-here
PUBLISH_PASSPHRASE=choose-a-shared-secret-here
```

(This is the template for local `wrangler dev` testing — a real
`.dev.vars` file, gitignored, is created locally by whoever runs the
Worker locally, populated with real values. Never commit a real
`.dev.vars` file.)

- [ ] **Step 8: Verify install and config are sane**

Correction (caught during task review): `tsc --noEmit` actually fails
with `error TS18003: No inputs were found` when `include: ["src"]`
points at a missing/empty directory — this is standard TypeScript
behavior, not specific to any version. The original wording of this
step was wrong; don't create a placeholder `src/index.ts` to work
around it (that just leaves stub code sitting around until Task 6
overwrites it, and Task 1 is scoped to configuration files only). Skip
running `tsc --noEmit` in this task entirely — there is genuinely
nothing to type-check yet. Confirm the toolchain is wired correctly by
running `npx tsc --version` instead (prints the installed version,
proves the binary and config resolve without attempting to compile
anything).

Run: `npm test`
Expected: exits non-zero with "No test files found" — same expected
behavior as the main app's Vitest setup; this resolves once Task 2 adds
the first test file.

- [ ] **Step 9: Commit**

```bash
git add worker/package.json worker/package-lock.json worker/wrangler.toml worker/tsconfig.json worker/vitest.config.ts worker/.gitignore worker/.dev.vars.example
git commit -m "chore: scaffold the asset-sync Cloudflare Worker project"
```

---

### Task 2: Base64 ⇄ UTF-8 helpers

**Files:**
- Create: `worker/src/base64.ts`
- Test: `worker/src/base64.test.ts`

**Interfaces:**
- Produces:
  - `base64ToUtf8(b64: string): string`
  - `utf8ToBase64(str: string): string`

GitHub's Git Data API always returns blob content as base64 on read,
regardless of the encoding used to create it. These two functions convert
between that and the plain JSON text the rest of the Worker works with.
Cloudflare Workers provide `atob`/`btoa`/`TextEncoder`/`TextDecoder` as
standard globals — no extra dependency needed.

- [ ] **Step 1: Write the failing tests**

Create `worker/src/base64.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { base64ToUtf8, utf8ToBase64 } from './base64';

describe('utf8ToBase64 / base64ToUtf8', () => {
  it('round-trips plain ASCII JSON', () => {
    const original = '{"id":"abc","fileName":"test.png"}';
    expect(base64ToUtf8(utf8ToBase64(original))).toBe(original);
  });

  it('round-trips non-ASCII characters', () => {
    const original = '{"fileName":"Efreet_atäck_🔥.png"}';
    expect(base64ToUtf8(utf8ToBase64(original))).toBe(original);
  });

  it('base64ToUtf8 handles base64 content with embedded newlines (as GitHub returns it)', () => {
    const original = '{"a":1}';
    const withNewlines = utf8ToBase64(original).match(/.{1,4}/g)!.join('\n');
    expect(base64ToUtf8(withNewlines)).toBe(original);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `worker/`): `npm test`
Expected: FAIL — `Cannot find module './base64'`.

- [ ] **Step 3: Implement `worker/src/base64.ts`**

```ts
export function base64ToUtf8(b64: string): string {
  const cleaned = b64.replace(/\n/g, '');
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/base64.ts worker/src/base64.test.ts
git commit -m "feat: add base64/UTF-8 conversion helpers"
```

---

### Task 3: Pure merge logic

**Files:**
- Create: `worker/src/merge.ts`
- Test: `worker/src/merge.test.ts`

**Interfaces:**
- Produces:
  - `interface LibraryAsset { id: string; dataUri: string; mimeType: string; fileName: string; }`
  - `type RoleDefaults = Record<string, string>`
  - `mergeLibrary(currentJson: string, asset: LibraryAsset): string`
  - `mergeRoleDefaults(currentJson: string, roleKey: string | null, assetId: string): string`

These are pure string-in/string-out functions — no network, no
Cloudflare-specific APIs — so they're fully testable in isolation. This
is deliberately the same merge semantics as the app-side library's own
role-default logic: dedup by `id` (so a retried publish of the same
asset doesn't duplicate it), and only touch `role-defaults.json` when a
`roleKey` is actually given.

- [ ] **Step 1: Write the failing tests**

Create `worker/src/merge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeLibrary, mergeRoleDefaults, LibraryAsset } from './merge';

const asset: LibraryAsset = { id: 'abc-123', dataUri: 'data:image/png;base64,xyz', mimeType: 'image/png', fileName: 'archer.png' };

describe('mergeLibrary', () => {
  it('adds a new asset to an empty library', () => {
    const result = JSON.parse(mergeLibrary('[]', asset));
    expect(result).toEqual([asset]);
  });

  it('adds a new asset alongside existing ones', () => {
    const existing: LibraryAsset = { id: 'existing-1', dataUri: 'data:image/png;base64,aaa', mimeType: 'image/png', fileName: 'other.png' };
    const result = JSON.parse(mergeLibrary(JSON.stringify([existing]), asset));
    expect(result).toEqual([existing, asset]);
  });

  it('replaces an existing asset with the same id instead of duplicating it', () => {
    const updated: LibraryAsset = { ...asset, fileName: 'archer-v2.png' };
    const result = JSON.parse(mergeLibrary(JSON.stringify([asset]), updated));
    expect(result).toEqual([updated]);
  });

  it('treats an empty string as an empty library', () => {
    const result = JSON.parse(mergeLibrary('', asset));
    expect(result).toEqual([asset]);
  });
});

describe('mergeRoleDefaults', () => {
  it('sets a role default when roleKey is given', () => {
    const result = JSON.parse(mergeRoleDefaults('{}', 'unit:idle:archer', asset.id));
    expect(result).toEqual({ 'unit:idle:archer': asset.id });
  });

  it('adds alongside existing role defaults without touching them', () => {
    const existing = { 'unit:idle:hugo': 'other-id' };
    const result = JSON.parse(mergeRoleDefaults(JSON.stringify(existing), 'unit:idle:archer', asset.id));
    expect(result).toEqual({ 'unit:idle:hugo': 'other-id', 'unit:idle:archer': asset.id });
  });

  it('overwrites an existing default for the same role key', () => {
    const existing = { 'unit:idle:archer': 'old-asset-id' };
    const result = JSON.parse(mergeRoleDefaults(JSON.stringify(existing), 'unit:idle:archer', asset.id));
    expect(result).toEqual({ 'unit:idle:archer': asset.id });
  });

  it('leaves role defaults unchanged when roleKey is null', () => {
    const existing = { 'unit:idle:hugo': 'other-id' };
    const result = JSON.parse(mergeRoleDefaults(JSON.stringify(existing), null, asset.id));
    expect(result).toEqual(existing);
  });

  it('treats an empty string as empty role defaults', () => {
    const result = JSON.parse(mergeRoleDefaults('', 'unit:idle:archer', asset.id));
    expect(result).toEqual({ 'unit:idle:archer': asset.id });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './merge'`.

- [ ] **Step 3: Implement `worker/src/merge.ts`**

```ts
export interface LibraryAsset {
  id: string;
  dataUri: string;
  mimeType: string;
  fileName: string;
}

export type RoleDefaults = Record<string, string>;

export function mergeLibrary(currentJson: string, asset: LibraryAsset): string {
  const library: LibraryAsset[] = currentJson ? JSON.parse(currentJson) : [];
  const withoutExisting = library.filter(a => a.id !== asset.id);
  return JSON.stringify([...withoutExisting, asset], null, 2);
}

export function mergeRoleDefaults(currentJson: string, roleKey: string | null, assetId: string): string {
  const roleDefaults: RoleDefaults = currentJson ? JSON.parse(currentJson) : {};
  if (!roleKey) return JSON.stringify(roleDefaults, null, 2);
  return JSON.stringify({ ...roleDefaults, [roleKey]: assetId }, null, 2);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all 10 tests green (3 from Task 2 + 7 new).

- [ ] **Step 5: Commit**

```bash
git add worker/src/merge.ts worker/src/merge.test.ts
git commit -m "feat: add pure merge logic for library and role-default JSON"
```

---

### Task 4: GitHub Git Data API client

**Files:**
- Create: `worker/src/github.ts`
- Test: `worker/src/github.test.ts`

**Interfaces:**
- Consumes: `base64ToUtf8` (Task 2).
- Produces:
  - `interface GithubConfig { owner: string; repo: string; branch: string; token: string; }`
  - `interface TreeEntry { path: string; sha: string; }`
  - `getRefSha(cfg: GithubConfig): Promise<string>`
  - `getTree(cfg: GithubConfig, commitSha: string): Promise<{ treeSha: string; entries: TreeEntry[] }>`
  - `getBlobContent(cfg: GithubConfig, blobSha: string): Promise<string>`
  - `createBlob(cfg: GithubConfig, content: string): Promise<string>`
  - `createTree(cfg: GithubConfig, baseTreeSha: string, entries: { path: string; sha: string }[]): Promise<string>`
  - `createCommit(cfg: GithubConfig, treeSha: string, parentSha: string, message: string): Promise<string>`
  - `updateRef(cfg: GithubConfig, commitSha: string): Promise<boolean>` — `true` on success, `false` on a conflict (caller decides whether to retry).

Each function is a thin, single-purpose wrapper around one GitHub Git
Data API call. Tests stub the global `fetch` to verify each function
builds the right request and parses the right response, without any
real network call.

- [ ] **Step 1: Write the failing tests**

Create `worker/src/github.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRefSha, getTree, getBlobContent, createBlob, createTree, createCommit, updateRef, GithubConfig } from './github';

const cfg: GithubConfig = { owner: 'test-owner', repo: 'test-repo', branch: 'main', token: 'test-token' };

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('getRefSha', () => {
  it('fetches the correct URL and extracts the commit sha', async () => {
    mockFetchOnce(200, { object: { sha: 'commit-abc' } });
    const sha = await getRefSha(cfg);
    expect(sha).toBe('commit-abc');
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-owner/test-repo/git/refs/heads/main',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) })
    );
  });

  it('throws on a non-ok response', async () => {
    mockFetchOnce(404, {});
    await expect(getRefSha(cfg)).rejects.toThrow();
  });
});

describe('getTree', () => {
  it('fetches recursively and filters to blob entries', async () => {
    mockFetchOnce(200, {
      sha: 'tree-abc',
      tree: [
        { path: 'public/library/library.json', sha: 'blob-1', type: 'blob' },
        { path: 'public/library', sha: 'tree-2', type: 'tree' },
        { path: 'public/library/role-defaults.json', sha: 'blob-2', type: 'blob' },
      ],
    });
    const { treeSha, entries } = await getTree(cfg, 'commit-abc');
    expect(treeSha).toBe('tree-abc');
    expect(entries).toEqual([
      { path: 'public/library/library.json', sha: 'blob-1' },
      { path: 'public/library/role-defaults.json', sha: 'blob-2' },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/test-owner/test-repo/git/trees/commit-abc?recursive=1',
      expect.anything()
    );
  });
});

describe('getBlobContent', () => {
  it('decodes base64 blob content to UTF-8', async () => {
    mockFetchOnce(200, { content: Buffer.from('{"a":1}', 'utf-8').toString('base64'), encoding: 'base64' });
    const content = await getBlobContent(cfg, 'blob-1');
    expect(content).toBe('{"a":1}');
  });
});

describe('createBlob', () => {
  it('POSTs content with utf-8 encoding and returns the new sha', async () => {
    mockFetchOnce(201, { sha: 'new-blob-sha' });
    const sha = await createBlob(cfg, '{"a":1}');
    expect(sha).toBe('new-blob-sha');
    const call = (fetch as any).mock.calls[0];
    expect(call[0]).toBe('https://api.github.com/repos/test-owner/test-repo/git/blobs');
    expect(JSON.parse(call[1].body)).toEqual({ content: '{"a":1}', encoding: 'utf-8' });
  });
});

describe('createTree', () => {
  it('POSTs base_tree and entries with mode/type set correctly', async () => {
    mockFetchOnce(201, { sha: 'new-tree-sha' });
    const sha = await createTree(cfg, 'base-tree-sha', [{ path: 'a.json', sha: 'blob-a' }]);
    expect(sha).toBe('new-tree-sha');
    const call = (fetch as any).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({
      base_tree: 'base-tree-sha',
      tree: [{ path: 'a.json', mode: '100644', type: 'blob', sha: 'blob-a' }],
    });
  });
});

describe('createCommit', () => {
  it('POSTs tree/parents/message and returns the new commit sha', async () => {
    mockFetchOnce(201, { sha: 'new-commit-sha' });
    const sha = await createCommit(cfg, 'tree-sha', 'parent-sha', 'test message');
    expect(sha).toBe('new-commit-sha');
    const call = (fetch as any).mock.calls[0];
    expect(JSON.parse(call[1].body)).toEqual({ message: 'test message', tree: 'tree-sha', parents: ['parent-sha'] });
  });
});

describe('updateRef', () => {
  it('returns true when the PATCH succeeds', async () => {
    mockFetchOnce(200, { object: { sha: 'commit-sha' } });
    const result = await updateRef(cfg, 'commit-sha');
    expect(result).toBe(true);
    const call = (fetch as any).mock.calls[0];
    expect(call[1].method).toBe('PATCH');
    expect(JSON.parse(call[1].body)).toEqual({ sha: 'commit-sha', force: false });
  });

  it('returns false (not a throw) when the PATCH conflicts', async () => {
    mockFetchOnce(422, { message: 'not a fast forward' });
    const result = await updateRef(cfg, 'commit-sha');
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './github'`.

- [ ] **Step 3: Implement `worker/src/github.ts`**

```ts
import { base64ToUtf8 } from './base64';

export interface GithubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

export interface TreeEntry {
  path: string;
  sha: string;
}

const API_BASE = 'https://api.github.com';

function headers(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'playable-battle-builder-asset-sync-worker',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function jsonHeaders(token: string): Record<string, string> {
  return { ...headers(token), 'Content-Type': 'application/json' };
}

export async function getRefSha(cfg: GithubConfig): Promise<string> {
  const res = await fetch(
    `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${cfg.branch}`,
    { headers: headers(cfg.token) }
  );
  if (!res.ok) throw new Error(`getRefSha failed: ${res.status}`);
  const data = await res.json() as { object: { sha: string } };
  return data.object.sha;
}

export async function getTree(cfg: GithubConfig, commitSha: string): Promise<{ treeSha: string; entries: TreeEntry[] }> {
  const res = await fetch(
    `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/git/trees/${commitSha}?recursive=1`,
    { headers: headers(cfg.token) }
  );
  if (!res.ok) throw new Error(`getTree failed: ${res.status}`);
  const data = await res.json() as { sha: string; tree: { path: string; sha: string; type: string }[] };
  return {
    treeSha: data.sha,
    entries: data.tree.filter(e => e.type === 'blob').map(e => ({ path: e.path, sha: e.sha })),
  };
}

export async function getBlobContent(cfg: GithubConfig, blobSha: string): Promise<string> {
  const res = await fetch(
    `${API_BASE}/repos/${cfg.owner}/${cfg.repo}/git/blobs/${blobSha}`,
    { headers: headers(cfg.token) }
  );
  if (!res.ok) throw new Error(`getBlobContent failed: ${res.status}`);
  const data = await res.json() as { content: string };
  return base64ToUtf8(data.content);
}

export async function createBlob(cfg: GithubConfig, content: string): Promise<string> {
  const res = await fetch(`${API_BASE}/repos/${cfg.owner}/${cfg.repo}/git/blobs`, {
    method: 'POST',
    headers: jsonHeaders(cfg.token),
    body: JSON.stringify({ content, encoding: 'utf-8' }),
  });
  if (!res.ok) throw new Error(`createBlob failed: ${res.status}`);
  const data = await res.json() as { sha: string };
  return data.sha;
}

export async function createTree(cfg: GithubConfig, baseTreeSha: string, entries: { path: string; sha: string }[]): Promise<string> {
  const res = await fetch(`${API_BASE}/repos/${cfg.owner}/${cfg.repo}/git/trees`, {
    method: 'POST',
    headers: jsonHeaders(cfg.token),
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: entries.map(e => ({ path: e.path, mode: '100644', type: 'blob', sha: e.sha })),
    }),
  });
  if (!res.ok) throw new Error(`createTree failed: ${res.status}`);
  const data = await res.json() as { sha: string };
  return data.sha;
}

export async function createCommit(cfg: GithubConfig, treeSha: string, parentSha: string, message: string): Promise<string> {
  const res = await fetch(`${API_BASE}/repos/${cfg.owner}/${cfg.repo}/git/commits`, {
    method: 'POST',
    headers: jsonHeaders(cfg.token),
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
  if (!res.ok) throw new Error(`createCommit failed: ${res.status}`);
  const data = await res.json() as { sha: string };
  return data.sha;
}

export async function updateRef(cfg: GithubConfig, commitSha: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/repos/${cfg.owner}/${cfg.repo}/git/refs/heads/${cfg.branch}`, {
    method: 'PATCH',
    headers: jsonHeaders(cfg.token),
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
  return res.ok;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests green (10 from Tasks 2-3 + 10 new = 20).

- [ ] **Step 5: Commit**

```bash
git add worker/src/github.ts worker/src/github.test.ts
git commit -m "feat: add GitHub Git Data API client"
```

---

### Task 5: Publish orchestration with retry-on-conflict

**Files:**
- Create: `worker/src/publish.ts`
- Test: `worker/src/publish.test.ts`

**Interfaces:**
- Consumes: everything from `worker/src/github.ts` (Task 4) and `worker/src/merge.ts` (Task 3).
- Produces:
  - `interface PublishResult { ok: boolean; error?: string; }`
  - `publishAssetToGithub(cfg: GithubConfig, roleKey: string | null, asset: LibraryAsset): Promise<PublishResult>`

This is the sequence from the design doc: read ref → read tree → read
both blobs → merge → write both new blobs → write new tree → write new
commit → update ref; on a ref conflict (`updateRef` returns `false`),
start over from reading the ref again, up to 3 total attempts.

- [ ] **Step 1: Write the failing tests**

Create `worker/src/publish.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishAssetToGithub } from './publish';
import * as github from './github';
import { LibraryAsset } from './merge';

const cfg = { owner: 'o', repo: 'r', branch: 'main', token: 't' };
const asset: LibraryAsset = { id: 'asset-1', dataUri: 'data:image/png;base64,x', mimeType: 'image/png', fileName: 'a.png' };

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockHappyPath() {
  vi.spyOn(github, 'getRefSha').mockResolvedValue('commit-1');
  vi.spyOn(github, 'getTree').mockResolvedValue({
    treeSha: 'tree-1',
    entries: [
      { path: 'public/library/library.json', sha: 'lib-blob-1' },
      { path: 'public/library/role-defaults.json', sha: 'roles-blob-1' },
    ],
  });
  vi.spyOn(github, 'getBlobContent').mockImplementation(async (_cfg, sha) => {
    if (sha === 'lib-blob-1') return '[]';
    if (sha === 'roles-blob-1') return '{}';
    throw new Error('unexpected blob sha ' + sha);
  });
  vi.spyOn(github, 'createBlob').mockResolvedValue('new-blob-sha');
  vi.spyOn(github, 'createTree').mockResolvedValue('new-tree-sha');
  vi.spyOn(github, 'createCommit').mockResolvedValue('new-commit-sha');
}

describe('publishAssetToGithub', () => {
  it('succeeds on the happy path with no conflicts', async () => {
    mockHappyPath();
    vi.spyOn(github, 'updateRef').mockResolvedValue(true);

    const result = await publishAssetToGithub(cfg, 'unit:idle:archer', asset);

    expect(result).toEqual({ ok: true });
    expect(github.createCommit).toHaveBeenCalledWith(cfg, 'new-tree-sha', 'commit-1', expect.any(String));
  });

  it('retries once on a single ref conflict, then succeeds', async () => {
    mockHappyPath();
    const updateRefMock = vi.spyOn(github, 'updateRef')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await publishAssetToGithub(cfg, 'unit:idle:archer', asset);

    expect(result).toEqual({ ok: true });
    expect(updateRefMock).toHaveBeenCalledTimes(2);
    expect(github.getRefSha).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 attempts all conflicting', async () => {
    mockHappyPath();
    vi.spyOn(github, 'updateRef').mockResolvedValue(false);

    const result = await publishAssetToGithub(cfg, 'unit:idle:archer', asset);

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(github.updateRef).toHaveBeenCalledTimes(3);
  });

  it('returns a failure result (not a throw) when a GitHub call rejects', async () => {
    vi.spyOn(github, 'getRefSha').mockRejectedValue(new Error('network down'));

    const result = await publishAssetToGithub(cfg, 'unit:idle:archer', asset);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
  });

  it('treats a null roleKey as valid — does not throw, still publishes the asset', async () => {
    mockHappyPath();
    vi.spyOn(github, 'updateRef').mockResolvedValue(true);

    const result = await publishAssetToGithub(cfg, null, asset);

    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './publish'`.

- [ ] **Step 3: Implement `worker/src/publish.ts`**

```ts
import { getRefSha, getTree, getBlobContent, createBlob, createTree, createCommit, updateRef, GithubConfig } from './github';
import { mergeLibrary, mergeRoleDefaults, LibraryAsset } from './merge';

const LIBRARY_PATH = 'public/library/library.json';
const ROLE_DEFAULTS_PATH = 'public/library/role-defaults.json';
const MAX_ATTEMPTS = 3;

export interface PublishResult {
  ok: boolean;
  error?: string;
}

export async function publishAssetToGithub(
  cfg: GithubConfig,
  roleKey: string | null,
  asset: LibraryAsset
): Promise<PublishResult> {
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const commitSha = await getRefSha(cfg);
      const { treeSha, entries } = await getTree(cfg, commitSha);

      const libraryEntry = entries.find(e => e.path === LIBRARY_PATH);
      const roleDefaultsEntry = entries.find(e => e.path === ROLE_DEFAULTS_PATH);

      const currentLibrary = libraryEntry ? await getBlobContent(cfg, libraryEntry.sha) : '[]';
      const currentRoleDefaults = roleDefaultsEntry ? await getBlobContent(cfg, roleDefaultsEntry.sha) : '{}';

      const newLibrary = mergeLibrary(currentLibrary, asset);
      const newRoleDefaults = mergeRoleDefaults(currentRoleDefaults, roleKey, asset.id);

      const libraryBlobSha = await createBlob(cfg, newLibrary);
      const roleDefaultsBlobSha = await createBlob(cfg, newRoleDefaults);

      const newTreeSha = await createTree(cfg, treeSha, [
        { path: LIBRARY_PATH, sha: libraryBlobSha },
        { path: ROLE_DEFAULTS_PATH, sha: roleDefaultsBlobSha },
      ]);

      const newCommitSha = await createCommit(cfg, newTreeSha, commitSha, 'chore: publish asset via editor');
      const updated = await updateRef(cfg, newCommitSha);
      if (updated) return { ok: true };
      // conflict — loop retries from the top with a fresh ref read
    }
    return { ok: false, error: `exhausted ${MAX_ATTEMPTS} attempts after ref conflicts` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests green (20 from Tasks 2-4 + 5 new = 25).

- [ ] **Step 5: Commit**

```bash
git add worker/src/publish.ts worker/src/publish.test.ts
git commit -m "feat: add publish orchestration with retry-on-conflict"
```

---

### Task 6: Worker entrypoint (`fetch` handler)

**Files:**
- Create: `worker/src/index.ts`
- Test: `worker/src/index.test.ts`

**Interfaces:**
- Consumes: `publishAssetToGithub` (Task 5), `LibraryAsset` (Task 3).
- Produces: the default-exported Worker object Cloudflare's runtime
  invokes — `export default { fetch(request, env): Promise<Response> }`.

This is the actual HTTP surface: parses the incoming request, validates
the passphrase, calls the orchestration layer, and maps the result to an
HTTP response. Matches the client's contract exactly (`POST` body
`{ passphrase, roleKey, asset }`, any 2xx = success).

- [ ] **Step 1: Write the failing tests**

Create `worker/src/index.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, { Env } from './index';
import * as publish from './publish';

const env: Env = {
  GITHUB_TOKEN: 'token',
  PUBLISH_PASSPHRASE: 'correct-horse',
  GITHUB_OWNER: 'owner',
  GITHUB_REPO: 'repo',
  GITHUB_BRANCH: 'main',
};

const validAsset = { id: 'a1', dataUri: 'data:image/png;base64,x', mimeType: 'image/png', fileName: 'a.png' };

function postRequest(body: unknown): Request {
  return new Request('https://worker.example/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('worker fetch handler', () => {
  it('rejects non-POST requests with 405', async () => {
    const res = await worker.fetch(new Request('https://worker.example/publish', { method: 'GET' }), env);
    expect(res.status).toBe(405);
  });

  it('rejects malformed JSON with 400', async () => {
    const req = new Request('https://worker.example/publish', { method: 'POST', body: 'not json' });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('rejects a wrong passphrase with 401, without calling GitHub', async () => {
    const publishSpy = vi.spyOn(publish, 'publishAssetToGithub');
    const res = await worker.fetch(postRequest({ passphrase: 'wrong', roleKey: null, asset: validAsset }), env);
    expect(res.status).toBe(401);
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it('rejects a request missing required asset fields with 400', async () => {
    const res = await worker.fetch(postRequest({ passphrase: 'correct-horse', roleKey: null, asset: { fileName: 'a.png' } }), env);
    expect(res.status).toBe(400);
  });

  it('returns 200 when publishAssetToGithub succeeds', async () => {
    vi.spyOn(publish, 'publishAssetToGithub').mockResolvedValue({ ok: true });
    const res = await worker.fetch(postRequest({ passphrase: 'correct-horse', roleKey: 'unit:idle:archer', asset: validAsset }), env);
    expect(res.status).toBe(200);
  });

  it('returns a non-2xx when publishAssetToGithub fails, without leaking the error detail as a body a client parses', async () => {
    vi.spyOn(publish, 'publishAssetToGithub').mockResolvedValue({ ok: false, error: 'boom' });
    const res = await worker.fetch(postRequest({ passphrase: 'correct-horse', roleKey: null, asset: validAsset }), env);
    expect(res.ok).toBe(false);
  });

  it('passes the parsed roleKey and asset through to publishAssetToGithub', async () => {
    const publishSpy = vi.spyOn(publish, 'publishAssetToGithub').mockResolvedValue({ ok: true });
    await worker.fetch(postRequest({ passphrase: 'correct-horse', roleKey: 'unit:idle:archer', asset: validAsset }), env);
    expect(publishSpy).toHaveBeenCalledWith(
      { owner: 'owner', repo: 'repo', branch: 'main', token: 'token' },
      'unit:idle:archer',
      validAsset
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Implement `worker/src/index.ts`**

```ts
import { publishAssetToGithub } from './publish';
import type { LibraryAsset } from './merge';

export interface Env {
  GITHUB_TOKEN: string;
  PUBLISH_PASSPHRASE: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
}

interface PublishRequestBody {
  passphrase: string;
  roleKey: string | null;
  asset: LibraryAsset;
}

function isValidAsset(asset: unknown): asset is LibraryAsset {
  if (!asset || typeof asset !== 'object') return false;
  const a = asset as Record<string, unknown>;
  return typeof a.id === 'string' && typeof a.dataUri === 'string' && typeof a.mimeType === 'string' && typeof a.fileName === 'string';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let body: PublishRequestBody;
    try {
      const parsed = await request.json();
      if (typeof parsed !== 'object' || parsed === null) {
        return new Response('Bad Request', { status: 400 });
      }
      body = parsed as PublishRequestBody;
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    if (body.passphrase !== env.PUBLISH_PASSPHRASE) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!isValidAsset(body.asset)) {
      return new Response('Bad Request', { status: 400 });
    }

    const result = await publishAssetToGithub(
      { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH, token: env.GITHUB_TOKEN },
      body.roleKey ?? null,
      body.asset
    );

    return result.ok
      ? new Response('OK', { status: 200 })
      : new Response('Publish failed', { status: 502 });
  },
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests green (25 from Tasks 2-5 + 7 new = 32).

- [ ] **Step 5: Type-check**

Run (from `worker/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add worker/src/index.ts worker/src/index.test.ts
git commit -m "feat: add the Worker's fetch handler"
```

---

### Task 7: Guided human setup against a disposable test repo

**⚠️ Not a subagent task.** This is the controller working directly with
the human in the main session — creating accounts, generating tokens,
and running interactive CLI logins are all things only the human can do
(the controller cannot create accounts or hold credentials). The
controller's job here is to produce the exact commands and verify each
step's output as the human runs them, and to write the guide below to
`worker/SETUP.md` for future reference.

**Files:**
- Create: `worker/SETUP.md`

- [ ] **Step 1: Write `worker/SETUP.md`**

```markdown
# Asset-Sync Worker — Setup

## 1. Create a disposable test GitHub repo

Create a new, empty public repo under your own account (not the company
org) — e.g. `your-username/asset-sync-worker-test`. Add two files at these
exact paths, matching the real editor's shape:

`public/library/library.json`:
​```json
[]
​```

`public/library/role-defaults.json`:
​```json
{}
​```

Commit both to `main`.

## 2. Generate a GitHub token for the test repo

GitHub → Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token.

- Repository access: **Only select repositories** → pick your test repo.
- Permissions → Repository permissions → **Contents: Read and write**.
- Set an expiration (30 days is plenty for testing).

Copy the token now — GitHub only shows it once.

## 3. Log in to Cloudflare

From `worker/`:
​```bash
npx wrangler login
​```
Opens a browser window to authorize `wrangler` against your Cloudflare
account.

## 4. Point `wrangler.toml` at the test repo

Edit `worker/wrangler.toml`, replacing the placeholders:
​```toml
[vars]
GITHUB_OWNER = "your-username"
GITHUB_REPO = "asset-sync-worker-test"
GITHUB_BRANCH = "main"
​```

## 5. Set the secrets

From `worker/`:
​```bash
npx wrangler secret put GITHUB_TOKEN
# paste the token from step 2 when prompted

npx wrangler secret put PUBLISH_PASSPHRASE
# choose and paste any shared secret string
​```

## 6. Deploy

​```bash
npx wrangler deploy
​```
Wrangler prints the deployed Worker's URL
(`https://playable-battle-builder-asset-sync.<your-subdomain>.workers.dev`)
— save it, it's needed for live verification (Task 8) and for the real
app's env vars later (Task 9).
```

- [ ] **Step 2: Walk through Steps 1-6 live with the human**

The controller does not execute these — the human runs each command in
their own terminal (so the token and Cloudflare login never pass through
the controller). The controller confirms each step's expected output
(repo created, token generated, `wrangler login` succeeded, secrets set
without error, `wrangler deploy` prints a `workers.dev` URL) before
moving to the next.

- [ ] **Step 3: Commit the setup guide**

```bash
git add worker/SETUP.md
git commit -m "docs: add Worker setup guide"
```

---

### Task 8: Live verification against the deployed test Worker

**⚠️ Not a subagent task.** Once the human has a real deployed Worker URL
from Task 7, the controller can test it directly — hitting a public HTTPS
endpoint needs no special credentials, just the URL.

- [ ] **Step 1: Confirm the deployed test repo's starting state**

```bash
curl -s "https://raw.githubusercontent.com/<test-owner>/<test-repo>/main/public/library/library.json"
```
Expected: `[]`

- [ ] **Step 2: Send a real publish request**

```bash
curl -s -X POST "<deployed-worker-url>" \
  -H "Content-Type: application/json" \
  -d '{"passphrase":"<the-passphrase-from-setup>","roleKey":"unit:idle:testunit","asset":{"id":"test-asset-1","dataUri":"data:image/png;base64,iVBORw0KGgo=","mimeType":"image/png","fileName":"test.png"}}'
```
Expected: HTTP 200, body `OK`.

- [ ] **Step 3: Confirm a real commit landed**

```bash
curl -s "https://raw.githubusercontent.com/<test-owner>/<test-repo>/main/public/library/library.json"
curl -s "https://raw.githubusercontent.com/<test-owner>/<test-repo>/main/public/library/role-defaults.json"
```
Expected: `library.json` now contains the one asset with `id:
"test-asset-1"`; `role-defaults.json` contains `{"unit:idle:testunit":
"test-asset-1"}`.

- [ ] **Step 4: Verify the wrong-passphrase path**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "<deployed-worker-url>" \
  -H "Content-Type: application/json" \
  -d '{"passphrase":"wrong","roleKey":null,"asset":{"id":"x","dataUri":"data:image/png;base64,x","mimeType":"image/png","fileName":"x.png"}}'
```
Expected: `401`.

- [ ] **Step 5: Verify the retry-on-conflict path with two overlapping requests**

```bash
curl -s -X POST "<deployed-worker-url>" -H "Content-Type: application/json" \
  -d '{"passphrase":"<passphrase>","roleKey":null,"asset":{"id":"race-1","dataUri":"data:image/png;base64,x","mimeType":"image/png","fileName":"race1.png"}}' &
curl -s -X POST "<deployed-worker-url>" -H "Content-Type: application/json" \
  -d '{"passphrase":"<passphrase>","roleKey":null,"asset":{"id":"race-2","dataUri":"data:image/png;base64,x","mimeType":"image/png","fileName":"race2.png"}}' &
wait
```
Expected: both return `200`; `library.json` afterward contains **both**
`race-1` and `race-2` — neither request silently clobbered the other.

- [ ] **Step 6: Report the results**

No commit for this task — it's verification only, run against the
disposable test repo, not the codebase.

---

### Task 9: Point at the real repo and wire the real app's env vars

**⚠️ Not a subagent task.** Requires the human to generate a
production-scoped GitHub token and add repository secrets — the
controller prepares the exact steps and files but the human executes the
credential-holding parts.

**Files:**
- Modify: `worker/wrangler.toml`
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Generate a production GitHub token**

Same as Task 7 Step 2, but scoped to
`tinysoft-sk/playable-battle-builder` specifically — ideally created
under a dedicated bot/machine account if the org has one (see the
earlier discussion about token ownership), otherwise under an
appropriate admin's account with a clear note of who holds it.

- [ ] **Step 2: Update `worker/wrangler.toml`**

```toml
[vars]
GITHUB_OWNER = "tinysoft-sk"
GITHUB_REPO = "playable-battle-builder"
GITHUB_BRANCH = "main"
```

- [ ] **Step 3: Set the production secrets and redeploy**

```bash
npx wrangler secret put GITHUB_TOKEN
# paste the token from Step 1

npx wrangler secret put PUBLISH_PASSPHRASE
# choose a NEW passphrase, different from the test one

npx wrangler deploy
```

- [ ] **Step 4: Add the Worker URL and passphrase as GitHub Actions repository secrets**

In `tinysoft-sk/playable-battle-builder` → Settings → Secrets and
variables → Actions → New repository secret. Add two:
`ASSET_SYNC_WORKER_URL` (the deployed `workers.dev` URL) and
`ASSET_SYNC_PASSPHRASE` (the same passphrase set in Step 3).

These are needed as **build-time** values — Vite's
`import.meta.env.VITE_*` variables are baked into the production bundle
at build time, and the production build runs inside
`.github/workflows/deploy.yml`, not on anyone's laptop, so the values
must reach that workflow step.

- [ ] **Step 5: Wire the secrets into the build step**

Modify `.github/workflows/deploy.yml`. Find the `- run: npm run build`
step and add an `env:` block:

```yaml
      - run: npm run build
        env:
          GITHUB_ACTIONS: true
          VITE_LIBRARY_WORKER_URL: ${{ secrets.ASSET_SYNC_WORKER_URL }}
          VITE_LIBRARY_PUBLISH_PASSPHRASE: ${{ secrets.ASSET_SYNC_PASSPHRASE }}
```

(`GITHUB_ACTIONS: true` is the existing env var already set on this
step — keep it, just add the two new lines alongside it.)

Note on the passphrase and the built bundle: once built, this value is
present in the client-side JavaScript anyone can view — that's an
accepted, documented tradeoff (see the shared-asset-library design doc's
"Known limitations"), not a new leak introduced here. Storing it as a
GitHub Actions secret rather than a committed file keeps it out of the
repo's source and git history, which is the actual goal of this step.

- [ ] **Step 6: Commit the workflow change**

```bash
git add worker/wrangler.toml .github/workflows/deploy.yml
git commit -m "chore: point the Worker at the real repo and wire its URL into the production build"
```

- [ ] **Step 7: Verify end-to-end on the real, deployed site**

Push this commit, wait for `deploy.yml` to finish, open the live
GitHub Pages site, upload a real asset, confirm (same method as Task 8)
that a real commit appears in `tinysoft-sk/playable-battle-builder`.
Then open the site in a second browser/incognito window and confirm the
uploaded asset is visible there too, once the resulting redeploy
completes — this is the actual end-to-end proof of the original goal.

## Self-Review Notes

- **Spec coverage:** the Git Data API flow (Tasks 4-5), the endpoint
  contract matching the existing client (Task 6), the disposable-test-repo
  testing plan (Tasks 7-8), and the real-repo cutover with build-time env
  wiring (Task 9) all trace directly to the design doc's sections.
- **Type consistency:** `LibraryAsset`, `GithubConfig`, `PublishResult`,
  and the exact function signatures are defined once (Tasks 3-5) and
  reused identically in every later task that consumes them.
- **Out of scope for this plan (per the design doc):** template/scenario
  sharing (a separate follow-up), real authentication, pruning old
  library assets.
