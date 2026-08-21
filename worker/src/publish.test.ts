import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishAssetToGithub, publishTemplateToGithub, deleteTemplateFromGithub } from './publish';
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
