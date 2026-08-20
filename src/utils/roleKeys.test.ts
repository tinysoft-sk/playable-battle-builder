import { describe, it, expect } from 'vitest';
import { unitRoleKey, spellRoleKey, audioRoleKey, FIXED_ROLE_KEYS } from './roleKeys';

describe('unitRoleKey', () => {
  it('builds a lowercase, trimmed key', () => {
    expect(unitRoleKey('idle', '  Archer  ')).toBe('unit:idle:archer');
    expect(unitRoleKey('attack', 'Archer')).toBe('unit:attack:archer');
    expect(unitRoleKey('projectile', 'Archer')).toBe('unit:projectile:archer');
  });

  it('returns null for a blank name', () => {
    expect(unitRoleKey('idle', '')).toBeNull();
    expect(unitRoleKey('idle', '   ')).toBeNull();
  });
});

describe('spellRoleKey', () => {
  it('builds a lowercase, trimmed key', () => {
    expect(spellRoleKey('asset', 'Fireball')).toBe('spell:asset:fireball');
    expect(spellRoleKey('projectileAsset', 'Fireball')).toBe('spell:projectileAsset:fireball');
  });

  it('returns null for a blank name', () => {
    expect(spellRoleKey('asset', '')).toBeNull();
  });
});

describe('audioRoleKey', () => {
  it('namespaces the event id', () => {
    expect(audioRoleKey('player_attack')).toBe('audio:player_attack');
  });
});

describe('FIXED_ROLE_KEYS', () => {
  it('has no duplicate values', () => {
    const values = Object.values(FIXED_ROLE_KEYS);
    expect(new Set(values).size).toBe(values.length);
  });
});
