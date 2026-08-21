# Shared Template Sync — Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new routes to the existing Cloudflare Worker (`worker/`) so it can publish (upsert-by-name) and delete shared battle-scenario templates in the same GitHub repo it already syncs assets to.

**Architecture:** One new JSON file in the target repo, `public/templates/shared-templates.json`, holding an array of `{ name, savedAt, config }`. Two new Worker functions (`publishTemplateToGithub`, `deleteTemplateFromGithub`) reuse the exact fetch-ref → fetch-tree → fetch-blob → merge → create-blob → create-tree → create-commit → update-ref-with-retry pipeline already proven in `publishAssetToGithub`, operating on this one file instead of the two asset files. Two new pure merge functions (`upsertSharedTemplate`, `removeSharedTemplate`) do the actual list editing. The Worker's `fetch` handler gains pathname-based routing (`/publish-template`, `/delete-template`); the existing root/`/publish` asset-publish behavior is untouched.

**Tech Stack:** TypeScript, Cloudflare Workers, Vitest, GitHub Git Data REST API (same as the existing Worker).

## Global Constraints

- Every response must carry the existing CORS headers (`Access-Control-Allow-Origin: https://tinysoft-sk.github.io`) — copied verbatim from `worker/src/index.ts`'s `CORS_HEADERS`.
- Auth is the same `PUBLISH_PASSPHRASE` secret already used by the asset endpoint — no new secret.
- Retry on ref conflict: exactly 3 attempts, fresh re-read of the ref/tree/blob on every attempt — matching `publishAssetToGithub`'s existing behavior exactly.
- The existing root (`/`) asset-publish endpoint and all of its current tests must keep passing unchanged.

---

### Task 1: `upsertSharedTemplate` / `removeSharedTemplate` in `merge.ts`

**Files:**
- Modify: `worker/src/merge.ts`
- Test: `worker/src/merge.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export interface SharedTemplate { name: string; savedAt: number; config: unknown; }`
  - `export function upsertSharedTemplate(currentJson: string, name: string, savedAt: number, config: unknown): string` — replaces the entry with an exact-name match if one exists, otherwise appends. Empty string is treated as `[]`.
  - `export function removeSharedTemplate(currentJson: string, name: string): string` — filters out the entry with that exact name. Empty string is treated as `[]`.
  - Both return pretty-printed (`JSON.stringify(..., null, 2)`) JSON, matching `mergeLibrary`/`mergeRoleDefaults`.

- [ ] **Step 1: Write the failing tests**

Append to `worker/src/merge.test.ts` (keep the existing `mergeLibrary`/`mergeRoleDefaults` describe blocks above this, and add the import):

```ts
import { mergeLibrary, mergeRoleDefaults, LibraryAsset, upsertSharedTemplate, removeSharedTemplate } from './merge';
```

(replace the existing `import { mergeLibrary, mergeRoleDefaults, LibraryAsset } from './merge';` line at the top of the file with the line above)

```ts
describe('upsertSharedTemplate', () => {
  it('adds a new template to an empty list', () => {
    const result = JSON.parse(upsertSharedTemplate('[]', 'Arena Fight', 1000, { foo: 'bar' }));
    expect(result).toEqual([{ name: 'Arena Fight', savedAt: 1000, config: { foo: 'bar' } }]);
  });

  it('adds a new template alongside existing ones', () => {
    const existing = { name: 'Other', savedAt: 500, config: { a: 1 } };
    const result = JSON.parse(upsertSharedTemplate(JSON.stringify([existing]), 'Arena Fight', 1000, { foo: 'bar' }));
    expect(result).toEqual([existing, { name: 'Arena Fight', savedAt: 1000, config: { foo: 'bar' } }]);
  });

  it('replaces an existing template with the same name instead of duplicating it', () => {
    const original = { name: 'Arena Fight', savedAt: 500, config: { v: 1 } };
    const result = JSON.parse(upsertSharedTemplate(JSON.stringify([original]), 'Arena Fight', 1000, { v: 2 }));
    expect(result).toEqual([{ name: 'Arena Fight', savedAt: 1000, config: { v: 2 } }]);
  });

  it('treats an empty string as an empty list', () => {
    const result = JSON.parse(upsertSharedTemplate('', 'Arena Fight', 1000, { foo: 'bar' }));
    expect(result).toEqual([{ name: 'Arena Fight', savedAt: 1000, config: { foo: 'bar' } }]);
  });
});

describe('removeSharedTemplate', () => {
  it('removes the template with a matching name', () => {
    const list = [{ name: 'Arena Fight', savedAt: 1000, config: {} }, { name: 'Other', savedAt: 500, config: {} }];
    const result = JSON.parse(removeSharedTemplate(JSON.stringify(list), 'Arena Fight'));
    expect(result).toEqual([{ name: 'Other', savedAt: 500, config: {} }]);
  });

  it('leaves the list unchanged when the name is not found', () => {
    const list = [{ name: 'Other', savedAt: 500, config: {} }];
    const result = JSON.parse(removeSharedTemplate(JSON.stringify(list), 'Nonexistent'));
    expect(result).toEqual(list);
  });

  it('treats an empty string as an empty list', () => {
    const result = JSON.parse(removeSharedTemplate('', 'Arena Fight'));
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from the `worker/` directory): `npm test -- --run`
Expected: FAIL — `upsertSharedTemplate`/`removeSharedTemplate` are not exported from `./merge`.

- [ ] **Step 3: Implement**

Append to `worker/src/merge.ts` (below the existing `mergeRoleDefaults` function):

```ts
export interface SharedTemplate {
  name: string;
  savedAt: number;
  config: unknown;
}

export function upsertSharedTemplate(currentJson: string, name: string, savedAt: number, config: unknown): string {
  const templates: SharedTemplate[] = currentJson ? JSON.parse(currentJson) : [];
  const withoutExisting = templates.filter(t => t.name !== name);
  return JSON.stringify([...withoutExisting, { name, savedAt, config }], null, 2);
}

export function removeSharedTemplate(currentJson: string, name: string): string {
  const templates: SharedTemplate[] = currentJson ? JSON.parse(currentJson) : [];
  return JSON.stringify(templates.filter(t => t.name !== name), null, 2);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run`
Expected: PASS — all tests in `merge.test.ts` (existing and new) green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/merge.ts worker/src/merge.test.ts
git commit -m "worker: add upsertSharedTemplate/removeSharedTemplate to merge.ts"
```

---

### Task 2: `publishTemplateToGithub` / `deleteTemplateFromGithub` in `publish.ts`

**Files:**
- Modify: `worker/src/publish.ts`
- Test: `worker/src/publish.test.ts`

**Interfaces:**
- Consumes: `upsertSharedTemplate`, `removeSharedTemplate` from Task 1; `getRefSha`, `getTree`, `getBlobContent`, `createBlob`, `createTree`, `createCommit`, `updateRef`, `GithubConfig` from `worker/src/github.ts` (all already exist, unchanged).
- Produces:
  - `export async function publishTemplateToGithub(cfg: GithubConfig, name: string, savedAt: number, config: unknown): Promise<PublishResult>`
  - `export async function deleteTemplateFromGithub(cfg: GithubConfig, name: string): Promise<PublishResult>`
  - Both reuse the existing `PublishResult` interface (`{ ok: boolean; error?: string }`) already defined in this file.

- [ ] **Step 1: Write the failing tests**

Append to `worker/src/publish.test.ts` (add `upsertSharedTemplate`-independent helper and new describe blocks; keep everything already in the file):

```ts
import { publishAssetToGithub, publishTemplateToGithub, deleteTemplateFromGithub } from './publish';
```

(replace the existing `import { publishAssetToGithub } from './publish';` line at the top of the file with the line above)

```ts
function mockTemplateHappyPath(currentTemplatesJson = '[]') {
  vi.spyOn(github, 'getRefSha').mockResolvedValue('commit-1');
  vi.spyOn(github, 'getTree').mockResolvedValue({
    treeSha: 'tree-1',
    entries: [{ path: 'public/templates/shared-templates.json', sha: 'templates-blob-1' }],
  });
  vi.spyOn(github, 'getBlobContent').mockImplementation(async (_cfg, sha) => {
    if (sha === 'templates-blob-1') return currentTemplatesJson;
    throw new Error('unexpected blob sha ' + sha);
  });
  vi.spyOn(github, 'createBlob').mockResolvedValue('new-blob-sha');
  vi.spyOn(github, 'createTree').mockResolvedValue('new-tree-sha');
  vi.spyOn(github, 'createCommit').mockResolvedValue('new-commit-sha');
}

describe('publishTemplateToGithub', () => {
  it('succeeds on the happy path with no conflicts', async () => {
    mockTemplateHappyPath();
    vi.spyOn(github, 'updateRef').mockResolvedValue(true);

    const result = await publishTemplateToGithub(cfg, 'Arena Fight', 1000, { foo: 'bar' });

    expect(result).toEqual({ ok: true });
    expect(github.createTree).toHaveBeenCalledWith(cfg, 'tree-1', [
      { path: 'public/templates/shared-templates.json', sha: 'new-blob-sha' },
    ]);
  });

  it('retries once on a single ref conflict, then succeeds', async () => {
    mockTemplateHappyPath();
    const updateRefMock = vi.spyOn(github, 'updateRef')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await publishTemplateToGithub(cfg, 'Arena Fight', 1000, { foo: 'bar' });

    expect(result).toEqual({ ok: true });
    expect(updateRefMock).toHaveBeenCalledTimes(2);
    expect(github.getRefSha).toHaveBeenCalledTimes(2);
  });

  it('gives up after 3 attempts all conflicting', async () => {
    mockTemplateHappyPath();
    vi.spyOn(github, 'updateRef').mockResolvedValue(false);

    const result = await publishTemplateToGithub(cfg, 'Arena Fight', 1000, { foo: 'bar' });

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    expect(github.updateRef).toHaveBeenCalledTimes(3);
  });

  it('returns a failure result (not a throw) when a GitHub call rejects', async () => {
    vi.spyOn(github, 'getRefSha').mockRejectedValue(new Error('network down'));

    const result = await publishTemplateToGithub(cfg, 'Arena Fight', 1000, { foo: 'bar' });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
  });

  it('overwrites an existing template with the same name rather than duplicating it', async () => {
    mockTemplateHappyPath(JSON.stringify([{ name: 'Arena Fight', savedAt: 500, config: { v: 1 } }]));
    vi.spyOn(github, 'updateRef').mockResolvedValue(true);
    const createBlobSpy = vi.spyOn(github, 'createBlob');

    await publishTemplateToGithub(cfg, 'Arena Fight', 1000, { v: 2 });

    const written = JSON.parse(createBlobSpy.mock.calls[0][1]);
    expect(written).toEqual([{ name: 'Arena Fight', savedAt: 1000, config: { v: 2 } }]);
  });
});

describe('deleteTemplateFromGithub', () => {
  it('succeeds on the happy path with no conflicts', async () => {
    mockTemplateHappyPath(JSON.stringify([{ name: 'Arena Fight', savedAt: 1000, config: {} }]));
    vi.spyOn(github, 'updateRef').mockResolvedValue(true);

    const result = await deleteTemplateFromGithub(cfg, 'Arena Fight');

    expect(result).toEqual({ ok: true });
  });

  it('writes the template list without the deleted entry', async () => {
    mockTemplateHappyPath(JSON.stringify([
      { name: 'Arena Fight', savedAt: 1000, config: {} },
      { name: 'Other', savedAt: 500, config: {} },
    ]));
    vi.spyOn(github, 'updateRef').mockResolvedValue(true);
    const createBlobSpy = vi.spyOn(github, 'createBlob');

    await deleteTemplateFromGithub(cfg, 'Arena Fight');

    const written = JSON.parse(createBlobSpy.mock.calls[0][1]);
    expect(written).toEqual([{ name: 'Other', savedAt: 500, config: {} }]);
  });

  it('retries once on a single ref conflict, then succeeds', async () => {
    mockTemplateHappyPath();
    const updateRefMock = vi.spyOn(github, 'updateRef')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await deleteTemplateFromGithub(cfg, 'Arena Fight');

    expect(result).toEqual({ ok: true });
    expect(updateRefMock).toHaveBeenCalledTimes(2);
  });

  it('returns a failure result (not a throw) when a GitHub call rejects', async () => {
    vi.spyOn(github, 'getRefSha').mockRejectedValue(new Error('network down'));

    const result = await deleteTemplateFromGithub(cfg, 'Arena Fight');

    expect(result.ok).toBe(false);
    expect(result.error).toContain('network down');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run`
Expected: FAIL — `publishTemplateToGithub`/`deleteTemplateFromGithub` are not exported from `./publish`.

- [ ] **Step 3: Implement**

In `worker/src/publish.ts`, change the top import line from:

```ts
import { mergeLibrary, mergeRoleDefaults, LibraryAsset } from './merge';
```

to:

```ts
import { mergeLibrary, mergeRoleDefaults, LibraryAsset, upsertSharedTemplate, removeSharedTemplate } from './merge';
```

Add this constant near the top, alongside `LIBRARY_PATH`/`ROLE_DEFAULTS_PATH`/`MAX_ATTEMPTS`:

```ts
const SHARED_TEMPLATES_PATH = 'public/templates/shared-templates.json';
```

Append these two functions at the end of the file (after `publishAssetToGithub`):

```ts
export async function publishTemplateToGithub(
  cfg: GithubConfig,
  name: string,
  savedAt: number,
  config: unknown
): Promise<PublishResult> {
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const commitSha = await getRefSha(cfg);
      const { treeSha, entries } = await getTree(cfg, commitSha);

      const templatesEntry = entries.find(e => e.path === SHARED_TEMPLATES_PATH);
      const currentTemplates = templatesEntry ? await getBlobContent(cfg, templatesEntry.sha) : '[]';
      const newTemplates = upsertSharedTemplate(currentTemplates, name, savedAt, config);

      const blobSha = await createBlob(cfg, newTemplates);
      const newTreeSha = await createTree(cfg, treeSha, [{ path: SHARED_TEMPLATES_PATH, sha: blobSha }]);
      const newCommitSha = await createCommit(cfg, newTreeSha, commitSha, `chore: publish template "${name}" via editor`);

      const updated = await updateRef(cfg, newCommitSha);
      if (updated) return { ok: true };
      // conflict — loop retries from the top with a fresh ref read
    }
    return { ok: false, error: `exhausted ${MAX_ATTEMPTS} attempts after ref conflicts` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteTemplateFromGithub(cfg: GithubConfig, name: string): Promise<PublishResult> {
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const commitSha = await getRefSha(cfg);
      const { treeSha, entries } = await getTree(cfg, commitSha);

      const templatesEntry = entries.find(e => e.path === SHARED_TEMPLATES_PATH);
      const currentTemplates = templatesEntry ? await getBlobContent(cfg, templatesEntry.sha) : '[]';
      const newTemplates = removeSharedTemplate(currentTemplates, name);

      const blobSha = await createBlob(cfg, newTemplates);
      const newTreeSha = await createTree(cfg, treeSha, [{ path: SHARED_TEMPLATES_PATH, sha: blobSha }]);
      const newCommitSha = await createCommit(cfg, newTreeSha, commitSha, `chore: delete template "${name}" via editor`);

      const updated = await updateRef(cfg, newCommitSha);
      if (updated) return { ok: true };
    }
    return { ok: false, error: `exhausted ${MAX_ATTEMPTS} attempts after ref conflicts` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run`
Expected: PASS — all tests in `publish.test.ts` (existing and new) green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/publish.ts worker/src/publish.test.ts
git commit -m "worker: add publishTemplateToGithub/deleteTemplateFromGithub to publish.ts"
```

---

### Task 3: Route `/publish-template` and `/delete-template` in `index.ts`

**Files:**
- Modify: `worker/src/index.ts`
- Test: `worker/src/index.test.ts`

**Interfaces:**
- Consumes: `publishTemplateToGithub`, `deleteTemplateFromGithub` from Task 2.
- Produces: the same exported `default { fetch }` Worker object and `Env` interface, now routing on `new URL(request.url).pathname`. No change to the existing `PublishRequestBody`/`isValidAsset`/asset-publish behavior — every existing test in `index.test.ts` must still pass unmodified.

- [ ] **Step 1: Write the failing tests**

Append to `worker/src/index.test.ts` (keep everything already in the file; this only adds new tests below the existing `describe('worker fetch handler', ...)` block — close that block's existing `)` and open two new sibling `describe` blocks):

```ts
describe('POST /publish-template', () => {
  function templateRequest(body: unknown): Request {
    return new Request('https://worker.example/publish-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('rejects a wrong passphrase with 401, without calling GitHub', async () => {
    const spy = vi.spyOn(publish, 'publishTemplateToGithub');
    const res = await worker.fetch(templateRequest({ passphrase: 'wrong', name: 'Arena Fight', config: {} }), env);
    expect(res.status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a missing/blank name with 400', async () => {
    const res = await worker.fetch(templateRequest({ passphrase: 'correct-horse', name: '  ', config: {} }), env);
    expect(res.status).toBe(400);
  });

  it('rejects a missing config with 400', async () => {
    const res = await worker.fetch(templateRequest({ passphrase: 'correct-horse', name: 'Arena Fight' }), env);
    expect(res.status).toBe(400);
  });

  it('rejects an array config with 400', async () => {
    const res = await worker.fetch(templateRequest({ passphrase: 'correct-horse', name: 'Arena Fight', config: [] }), env);
    expect(res.status).toBe(400);
  });

  it('returns 200 and passes name/config through when publishTemplateToGithub succeeds', async () => {
    const spy = vi.spyOn(publish, 'publishTemplateToGithub').mockResolvedValue({ ok: true });
    const res = await worker.fetch(templateRequest({ passphrase: 'correct-horse', name: 'Arena Fight', config: { foo: 'bar' } }), env);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      { owner: 'owner', repo: 'repo', branch: 'main', token: 'token' },
      'Arena Fight',
      expect.any(Number),
      { foo: 'bar' }
    );
  });

  it('returns a non-2xx when publishTemplateToGithub fails', async () => {
    vi.spyOn(publish, 'publishTemplateToGithub').mockResolvedValue({ ok: false, error: 'boom' });
    const res = await worker.fetch(templateRequest({ passphrase: 'correct-horse', name: 'Arena Fight', config: {} }), env);
    expect(res.ok).toBe(false);
  });

  it('returns 500 when GITHUB_TOKEN is unset', async () => {
    const badEnv = { ...env, GITHUB_TOKEN: undefined as unknown as string };
    const res = await worker.fetch(templateRequest({ passphrase: 'correct-horse', name: 'Arena Fight', config: {} }), badEnv);
    expect(res.status).toBe(500);
  });

  it('includes CORS headers on a successful response', async () => {
    vi.spyOn(publish, 'publishTemplateToGithub').mockResolvedValue({ ok: true });
    const res = await worker.fetch(templateRequest({ passphrase: 'correct-horse', name: 'Arena Fight', config: {} }), env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://tinysoft-sk.github.io');
  });
});

describe('POST /delete-template', () => {
  function deleteRequest(body: unknown): Request {
    return new Request('https://worker.example/delete-template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('rejects a wrong passphrase with 401, without calling GitHub', async () => {
    const spy = vi.spyOn(publish, 'deleteTemplateFromGithub');
    const res = await worker.fetch(deleteRequest({ passphrase: 'wrong', name: 'Arena Fight' }), env);
    expect(res.status).toBe(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a missing/blank name with 400', async () => {
    const res = await worker.fetch(deleteRequest({ passphrase: 'correct-horse', name: '' }), env);
    expect(res.status).toBe(400);
  });

  it('returns 200 and passes the name through when deleteTemplateFromGithub succeeds', async () => {
    const spy = vi.spyOn(publish, 'deleteTemplateFromGithub').mockResolvedValue({ ok: true });
    const res = await worker.fetch(deleteRequest({ passphrase: 'correct-horse', name: 'Arena Fight' }), env);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith(
      { owner: 'owner', repo: 'repo', branch: 'main', token: 'token' },
      'Arena Fight'
    );
  });

  it('returns a non-2xx when deleteTemplateFromGithub fails', async () => {
    vi.spyOn(publish, 'deleteTemplateFromGithub').mockResolvedValue({ ok: false, error: 'boom' });
    const res = await worker.fetch(deleteRequest({ passphrase: 'correct-horse', name: 'Arena Fight' }), env);
    expect(res.ok).toBe(false);
  });

  it('returns 500 when GITHUB_TOKEN is unset', async () => {
    const badEnv = { ...env, GITHUB_TOKEN: undefined as unknown as string };
    const res = await worker.fetch(deleteRequest({ passphrase: 'correct-horse', name: 'Arena Fight' }), badEnv);
    expect(res.status).toBe(500);
  });
});
```

No import change is needed in the test file itself — it already has `import * as publish from './publish';` at the top (used by the existing `vi.spyOn(publish, 'publishAssetToGithub')` calls), which covers the new `publish.publishTemplateToGithub`/`publish.deleteTemplateFromGithub` spies too.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run`
Expected: FAIL — requests to `/publish-template` and `/delete-template` currently fall through to the asset-publish logic and get rejected as invalid assets (400), not routed to `publishTemplateToGithub`/`deleteTemplateFromGithub`.

- [ ] **Step 3: Implement**

Replace the entire contents of `worker/src/index.ts` with:

```ts
import { publishAssetToGithub, publishTemplateToGithub, deleteTemplateFromGithub } from './publish';
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

interface PublishTemplateRequestBody {
  passphrase: string;
  name: string;
  config: unknown;
}

interface DeleteTemplateRequestBody {
  passphrase: string;
  name: string;
}

function isValidAsset(asset: unknown): asset is LibraryAsset {
  if (!asset || typeof asset !== 'object') return false;
  const a = asset as Record<string, unknown>;
  return typeof a.id === 'string' && typeof a.dataUri === 'string' && typeof a.mimeType === 'string' && typeof a.fileName === 'string';
}

function isValidTemplateName(name: unknown): name is string {
  return typeof name === 'string' && name.trim().length > 0;
}

function isValidTemplateConfig(config: unknown): boolean {
  return typeof config === 'object' && config !== null && !Array.isArray(config);
}

const ALLOWED_ORIGIN = 'https://tinysoft-sk.github.io';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(body: BodyInit | null, init: ResponseInit): Response {
  return new Response(body, { ...init, headers: { ...(init.headers ?? {}), ...CORS_HEADERS } });
}

async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    const parsed = await request.json();
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

function checkPassphrase(env: Env, passphrase: string): boolean {
  return Boolean(env.PUBLISH_PASSPHRASE) && passphrase === env.PUBLISH_PASSPHRASE;
}

async function handlePublishAsset(request: Request, env: Env): Promise<Response> {
  const body = await parseJsonBody<PublishRequestBody>(request);
  if (!body) return corsResponse('Bad Request', { status: 400 });
  if (!checkPassphrase(env, body.passphrase)) return corsResponse('Unauthorized', { status: 401 });
  if (!isValidAsset(body.asset)) return corsResponse('Bad Request', { status: 400 });
  if (!env.GITHUB_TOKEN) return corsResponse('Server misconfigured', { status: 500 });

  const result = await publishAssetToGithub(
    { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH, token: env.GITHUB_TOKEN },
    body.roleKey ?? null,
    body.asset
  );

  if (!result.ok) console.error('publish failed:', result.error);
  return result.ok ? corsResponse('OK', { status: 200 }) : corsResponse('Publish failed', { status: 502 });
}

async function handlePublishTemplate(request: Request, env: Env): Promise<Response> {
  const body = await parseJsonBody<PublishTemplateRequestBody>(request);
  if (!body) return corsResponse('Bad Request', { status: 400 });
  if (!checkPassphrase(env, body.passphrase)) return corsResponse('Unauthorized', { status: 401 });
  if (!isValidTemplateName(body.name)) return corsResponse('Bad Request', { status: 400 });
  if (!isValidTemplateConfig(body.config)) return corsResponse('Bad Request', { status: 400 });
  if (!env.GITHUB_TOKEN) return corsResponse('Server misconfigured', { status: 500 });

  const result = await publishTemplateToGithub(
    { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH, token: env.GITHUB_TOKEN },
    body.name,
    Date.now(),
    body.config
  );

  if (!result.ok) console.error('publish-template failed:', result.error);
  return result.ok ? corsResponse('OK', { status: 200 }) : corsResponse('Publish failed', { status: 502 });
}

async function handleDeleteTemplate(request: Request, env: Env): Promise<Response> {
  const body = await parseJsonBody<DeleteTemplateRequestBody>(request);
  if (!body) return corsResponse('Bad Request', { status: 400 });
  if (!checkPassphrase(env, body.passphrase)) return corsResponse('Unauthorized', { status: 401 });
  if (!isValidTemplateName(body.name)) return corsResponse('Bad Request', { status: 400 });
  if (!env.GITHUB_TOKEN) return corsResponse('Server misconfigured', { status: 500 });

  const result = await deleteTemplateFromGithub(
    { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH, token: env.GITHUB_TOKEN },
    body.name
  );

  if (!result.ok) console.error('delete-template failed:', result.error);
  return result.ok ? corsResponse('OK', { status: 200 }) : corsResponse('Publish failed', { status: 502 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return corsResponse('Method Not Allowed', { status: 405 });
    }

    const path = new URL(request.url).pathname;
    if (path === '/publish-template') return handlePublishTemplate(request, env);
    if (path === '/delete-template') return handleDeleteTemplate(request, env);
    return handlePublishAsset(request, env);
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run`
Expected: PASS — every test in `index.test.ts` (existing asset-publish tests, unmodified, plus the new `/publish-template` and `/delete-template` tests) green.

- [ ] **Step 5: Commit**

```bash
git add worker/src/index.ts worker/src/index.test.ts
git commit -m "worker: route /publish-template and /delete-template"
```

---

### Task 4: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Type-check**

Run (from `worker/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full test suite**

Run (from `worker/`): `npm test -- --run`
Expected: all tests pass — the original asset-publish suite plus every test added in Tasks 1–3.

- [ ] **Step 3: Report**

No commit for this task — it's verification only. If either check fails, fix the root cause in the relevant earlier task and re-run both checks before considering the plan complete.
