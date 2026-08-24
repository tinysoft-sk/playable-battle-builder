import { describe, it, expect } from 'vitest';
import { SFX_GROUPS } from './AudioPanel';
import { AUDIO_EVENTS } from '../../types/battle';

describe('SFX_GROUPS', () => {
  it('covers every AUDIO_EVENT exactly once', () => {
    const grouped = SFX_GROUPS.flatMap(g => g.events);
    expect([...grouped].sort()).toEqual([...AUDIO_EVENTS].sort());
  });
});
