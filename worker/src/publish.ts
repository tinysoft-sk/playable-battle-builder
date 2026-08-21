import { getRefSha, getTree, getBlobContent, createBlob, createTree, createCommit, updateRef, GithubConfig } from './github';
import { mergeLibrary, mergeRoleDefaults, LibraryAsset, upsertSharedTemplate, removeSharedTemplate } from './merge';

const LIBRARY_PATH = 'public/library/library.json';
const ROLE_DEFAULTS_PATH = 'public/library/role-defaults.json';
const SHARED_TEMPLATES_PATH = 'public/templates/shared-templates.json';
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
