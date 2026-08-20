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
  if (res.ok) return true;
  if (res.status === 409 || res.status === 422) return false;
  throw new Error(`updateRef failed: ${res.status}`);
}
