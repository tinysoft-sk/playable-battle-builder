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
