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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return corsResponse('Method Not Allowed', { status: 405 });
    }

    let body: PublishRequestBody;
    try {
      const parsed = await request.json();
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return corsResponse('Bad Request', { status: 400 });
      }
      body = parsed as PublishRequestBody;
    } catch {
      return corsResponse('Bad Request', { status: 400 });
    }

    if (!env.PUBLISH_PASSPHRASE || body.passphrase !== env.PUBLISH_PASSPHRASE) {
      return corsResponse('Unauthorized', { status: 401 });
    }

    if (!isValidAsset(body.asset)) {
      return corsResponse('Bad Request', { status: 400 });
    }

    if (!env.GITHUB_TOKEN) {
      return corsResponse('Server misconfigured', { status: 500 });
    }

    const result = await publishAssetToGithub(
      { owner: env.GITHUB_OWNER, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH, token: env.GITHUB_TOKEN },
      body.roleKey ?? null,
      body.asset
    );

    if (!result.ok) {
      console.error('publish failed:', result.error);
    }

    return result.ok
      ? corsResponse('OK', { status: 200 })
      : corsResponse('Publish failed', { status: 502 });
  },
};
