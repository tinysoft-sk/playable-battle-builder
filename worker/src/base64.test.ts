import { describe, it, expect } from 'vitest';
import { base64ToUtf8, utf8ToBase64 } from './base64';

describe('utf8ToBase64 / base64ToUtf8', () => {
  it('round-trips plain ASCII JSON', () => {
    const original = '{"id":"abc","fileName":"test.png"}';
    expect(base64ToUtf8(utf8ToBase64(original))).toBe(original);
  });

  it('round-trips non-ASCII characters', () => {
    const original = '{"fileName":"Efreet_atäck_🔥.png"}';
    expect(base64ToUtf8(utf8ToBase64(original))).toBe(original);
  });

  it('base64ToUtf8 handles base64 content with embedded newlines (as GitHub returns it)', () => {
    const original = '{"a":1}';
    const withNewlines = utf8ToBase64(original).match(/.{1,4}/g)!.join('\n');
    expect(base64ToUtf8(withNewlines)).toBe(original);
  });
});
