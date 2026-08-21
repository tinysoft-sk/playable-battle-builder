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
