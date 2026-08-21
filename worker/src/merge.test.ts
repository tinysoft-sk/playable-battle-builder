import { describe, it, expect } from 'vitest';
import { mergeLibrary, mergeRoleDefaults, LibraryAsset, upsertSharedTemplate, removeSharedTemplate } from './merge';

const asset: LibraryAsset = { id: 'abc-123', dataUri: 'data:image/png;base64,xyz', mimeType: 'image/png', fileName: 'archer.png' };

describe('mergeLibrary', () => {
  it('adds a new asset to an empty library', () => {
    const result = JSON.parse(mergeLibrary('[]', asset));
    expect(result).toEqual([asset]);
  });

  it('adds a new asset alongside existing ones', () => {
    const existing: LibraryAsset = { id: 'existing-1', dataUri: 'data:image/png;base64,aaa', mimeType: 'image/png', fileName: 'other.png' };
    const result = JSON.parse(mergeLibrary(JSON.stringify([existing]), asset));
    expect(result).toEqual([existing, asset]);
  });

  it('replaces an existing asset with the same id instead of duplicating it', () => {
    const updated: LibraryAsset = { ...asset, fileName: 'archer-v2.png' };
    const result = JSON.parse(mergeLibrary(JSON.stringify([asset]), updated));
    expect(result).toEqual([updated]);
  });

  it('treats an empty string as an empty library', () => {
    const result = JSON.parse(mergeLibrary('', asset));
    expect(result).toEqual([asset]);
  });
});

describe('mergeRoleDefaults', () => {
  it('sets a role default when roleKey is given', () => {
    const result = JSON.parse(mergeRoleDefaults('{}', 'unit:idle:archer', asset.id));
    expect(result).toEqual({ 'unit:idle:archer': asset.id });
  });

  it('adds alongside existing role defaults without touching them', () => {
    const existing = { 'unit:idle:hugo': 'other-id' };
    const result = JSON.parse(mergeRoleDefaults(JSON.stringify(existing), 'unit:idle:archer', asset.id));
    expect(result).toEqual({ 'unit:idle:hugo': 'other-id', 'unit:idle:archer': asset.id });
  });

  it('overwrites an existing default for the same role key', () => {
    const existing = { 'unit:idle:archer': 'old-asset-id' };
    const result = JSON.parse(mergeRoleDefaults(JSON.stringify(existing), 'unit:idle:archer', asset.id));
    expect(result).toEqual({ 'unit:idle:archer': asset.id });
  });

  it('leaves role defaults unchanged when roleKey is null', () => {
    const existing = { 'unit:idle:hugo': 'other-id' };
    const result = JSON.parse(mergeRoleDefaults(JSON.stringify(existing), null, asset.id));
    expect(result).toEqual(existing);
  });

  it('treats an empty string as empty role defaults', () => {
    const result = JSON.parse(mergeRoleDefaults('', 'unit:idle:archer', asset.id));
    expect(result).toEqual({ 'unit:idle:archer': asset.id });
  });
});

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
