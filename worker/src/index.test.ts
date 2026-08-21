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

  it('rejects a JSON body of literal null with 400 instead of throwing', async () => {
    const req = new Request('https://worker.example/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('rejects a JSON array body with 400', async () => {
    const req = new Request('https://worker.example/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '[]',
    });
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

  it('responds to an OPTIONS preflight with 204 and CORS headers', async () => {
    const req = new Request('https://worker.example/publish', { method: 'OPTIONS' });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://tinysoft-sk.github.io');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('includes CORS headers on a successful response', async () => {
    vi.spyOn(publish, 'publishAssetToGithub').mockResolvedValue({ ok: true });
    const res = await worker.fetch(postRequest({ passphrase: 'correct-horse', roleKey: null, asset: validAsset }), env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://tinysoft-sk.github.io');
  });

  it('includes CORS headers on a 401 response', async () => {
    const res = await worker.fetch(postRequest({ passphrase: 'wrong', roleKey: null, asset: validAsset }), env);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://tinysoft-sk.github.io');
  });

  it('rejects with 401 when PUBLISH_PASSPHRASE is unset and the request omits passphrase', async () => {
    const badEnv = { ...env, PUBLISH_PASSPHRASE: undefined as unknown as string };
    const res = await worker.fetch(postRequest({ roleKey: null, asset: validAsset }), badEnv);
    expect(res.status).toBe(401);
  });

  it('returns 500 when GITHUB_TOKEN is unset', async () => {
    const badEnv = { ...env, GITHUB_TOKEN: undefined as unknown as string };
    const res = await worker.fetch(postRequest({ passphrase: 'correct-horse', roleKey: null, asset: validAsset }), badEnv);
    expect(res.status).toBe(500);
  });
});

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
