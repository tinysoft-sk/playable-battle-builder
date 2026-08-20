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

  it('throws (does not silently return false) on a non-conflict error status', async () => {
    mockFetchOnce(401, { message: 'Bad credentials' });
    await expect(updateRef(cfg, 'commit-sha')).rejects.toThrow('updateRef failed: 401');
  });
});
