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
